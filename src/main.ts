import { base64 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { Metaplex } from '@metaplex-foundation/js';
import { Connection } from '@solana/web3.js';
import { run } from '@subsquid/batch-processor';
import { augmentBlock } from '@subsquid/solana-objects';
import { DataSourceBuilder, LogMessage, SolanaRpcClient } from '@subsquid/solana-stream';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { CreatePersonalPositionEvent, DecreaseLiquidityEvent, IncreaseLiquidityEvent, LiquidityChangeEvent, PoolCreatedEvent, SwapEvent } from './abi/generated/amm_v3/events';
import { createPool, decreaseLiquidity, decreaseLiquidityV2, increaseLiquidity, increaseLiquidityV2, openPosition, openPositionV2, openPositionWithToken22Nft, swap, swapRouterBaseIn, swapV2 } from './abi/generated/amm_v3/instructions';
import { CreatePersonalPositionEvent as CreatePersonalPosition, DecreaseLiquidityEvent as DecreaseLiquidity, IncreaseLiquidityEvent as IncreaseLiquidity } from './abi/generated/amm_v3/types';
import { Hook, ModifyLiquidityReccord, Pool, Position } from './model/generated';
import { ManagerStore } from './store/ManagerStore';
import { PairRecordStore } from './store/PairRecordStore';
import { PoolStore } from './store/PoolStore';
import { PositionStore } from './store/PositionStore';
import { SwapRecordStore } from './store/SwapRecordStore';
import { TokenStore } from './store/TokenStore';
import { WalletStore } from './store/WalletStore';


const rpcClient = new Connection(process.env.SOLANA_NODE ?? "https://api.mainnet-beta.solana.com");
const metaplex = Metaplex.make(rpcClient);


const LAMPORTS = 1_000_000_000;
const INT_MAX = 2_147_483_647;
const RaydiumCLMMProgram = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
// const RinataToken = "EsXEUNEEWpAzSdY5o4iEZK57VVWqxGPen7ePASSWpump";
// const CupseyToken = "5PsnNwPmMtsGZgG6ZqMoDJJi28BR5xpAotXHHiQhpump";

// First we create a DataSource - component,
// that defines where to get the data and what data should we get.
const dataSource = new DataSourceBuilder()
    // Provide Subsquid Network Gateway URL.
    .setGateway('https://v2.archive.subsquid.io/network/solana-mainnet')
    // Subsquid Network is always about 1000 blocks behind the head.
    // We must use regular RPC endpoint to get through the last mile
    // and stay on top of the chain.
    // This is a limitation, and we promise to lift it in the future!
    .setRpc(process.env.SOLANA_NODE == null ? undefined : {
        client: new SolanaRpcClient({
            url: process.env.SOLANA_NODE,
            rateLimit: 1 // requests per sec
        }),
        strideConcurrency: 1
    })
    // Currently only blocks from 254_625_450 and above are stored in Subsquid Network.
    // When we specify it, we must also limit the range of requested blocks.
    //
    // Same applies to RPC endpoint of a node that cleanups its history.
    //
    // NOTE, that block ranges are specified in heights, not in slots !!!
    //
    // .setBlockRange({ from: 254_625_450 })
    .setBlockRange({ from: 289_819_150 })
    // .setBlockRange({ from: 278_257_649 })


    //
    // Block data returned by the data source has the following structure:
    //
    // interface Block {
    //     header: BlockHeader
    //     transactions: Transaction[]
    //     instructions: Instruction[]
    //     logs: LogMessage[]
    //     balances: Balance[]
    //     tokenBalances: TokenBalance[]
    //     rewards: Reward[]
    // }
    //
    // For each block item we can specify a set of fields we want to fetch via `.setFields()` method.
    // Think about it as of SQL projection.
    //
    // Accurate selection of only required fields can have a notable positive impact
    // on performance when data is sourced from Subsquid Network.
    //
    // We do it below only for illustration as all fields we've selected
    // are fetched by default.
    //
    // It is possible to override default selection by setting undesired fields to `false`.
    .setFields({
        block: { // block header fields
            timestamp: true
        },
        transaction: { // transaction fields
            signatures: true
        },
        instruction: { // instruction fields
            programId: true,
            accounts: true,
            data: true

        }
    })
    // By default, block can be skipped if it doesn't contain explicitly requested items.
    //
    // We request items via `.addXxx()` methods.
    //
    // Each `.addXxx()` method accepts item selection criteria
    // and also allows to request related items.
    //
    .addInstruction({
        where: {
            programId: [RaydiumCLMMProgram],
            d8: [
                // createAmmConfig.d8,
                // updateAmmConfig.d8,
                createPool.d8,
                // updatePoolStatus.d8,
                // initializeReward.d8,
                // collectRemainingRewards.d8,
                // updateRewardInfos.d8,
                // setRewardParams.d8,
                // collectProtocolFee.d8,
                // collectFundFee.d8,
                openPosition.d8,
                openPositionV2.d8,
                openPositionWithToken22Nft.d8,
                // closePosition.d8,
                increaseLiquidity.d8,
                increaseLiquidityV2.d8,
                decreaseLiquidity.d8,
                decreaseLiquidityV2.d8,
                swap.d8,
                swapV2.d8,
                swapRouterBaseIn.d8,
            ],

        },
        include: {
            transaction: true,
            logs: true,
            // transactionTokenBalances: true,
            // innerInstructions: true,
        }
    })
    .build()


function bigIntPercentage(value: bigint, percentage: number, precision: number): bigint {
    const scaleFactor = 10n ** BigInt(precision);
    const scaledPercentage = BigInt(Math.round(percentage * Number(scaleFactor)));
    const scaledValue = value * scaledPercentage;
    const result = scaledValue / (100n * scaleFactor);
    return result;
}

function getCreatePositionEvent(logs: LogMessage[]): CreatePersonalPosition | undefined {
    for (let log of logs) {
        try {
            const event = CreatePersonalPositionEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

function getIncreaseLiquidityEvent(logs: LogMessage[]): IncreaseLiquidity | undefined {
    for (let log of logs) {
        try {
            const event = IncreaseLiquidityEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

function getDecreaseLiquidityEvent(logs: LogMessage[]): DecreaseLiquidity | undefined {
    for (let log of logs) {
        try {
            const event = DecreaseLiquidityEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

// Once we've prepared a data source we can start fetching the data right away:
//
// for await (let batch of dataSource.getBlockStream()) {
//     for (let block of batch) {
//         console.log(block)
//     }
// }
//
// However, Subsquid SDK can also help to decode and persist the data.
//

// Data processing in Subsquid SDK is defined by four components:
//
//  1. Data source (such as we've created above)
//  2. Database
//  3. Data handler
//  4. Processor
//
// Database is responsible for persisting the work progress (last processed block)
// and for providing storage API to the data handler.
//
// Data handler is a user defined function which accepts consecutive block batches,
// storage API and is responsible for entire data transformation.
//
// Processor connects and executes above three components.
//

// Below we create a `TypeormDatabase`.
//
// It provides restricted subset of [TypeORM EntityManager API](https://typeorm.io/working-with-entity-manager)
// as a persistent storage interface and works with any Postgres-compatible database.
//
// Note, that we don't pass any database connection parameters.
// That's because `TypeormDatabase` expects a certain project structure
// and environment variables to pick everything it needs by convention.
// Companion `@subsquid/typeorm-migration` tool works in the same way.
//
// For full configuration details please consult
// https://github.com/subsquid/squid-sdk/blob/278195bd5a5ed0a9e24bfb99ee7bbb86ff94ccb3/typeorm/typeorm-config/src/config.ts#L21
const database = new TypeormDatabase({})

let placeholderInited = false;
const HookPlaceHolder = new Hook({
    id: '0x',
    isWhitelisted: true,
    isBlacklisted: false,
    chainId: 0,
    hookAddress: '0x',
    blockNumber: 0n,
    timestamp: 0n
});

// Now we are ready to start data processing
run(dataSource, database, async ctx => {
    // Block items that we get from `ctx.blocks` are flat JS objects.
    //
    // We can use `augmentBlock()` function from `@subsquid/solana-objects`
    // to enrich block items with references to related objects and
    // with convenient getters for derived data (e.g. `Instruction.d8`).
    let blocks = ctx.blocks.map(augmentBlock);

    const managerStore: ManagerStore = new ManagerStore(ctx.store, RaydiumCLMMProgram);
    const positionStore: PositionStore = new PositionStore(ctx.store);
    const poolStore: PoolStore = new PoolStore(ctx.store, rpcClient);
    const walletStore: WalletStore = new WalletStore(ctx.store);
    const tokenStore: TokenStore = new TokenStore(ctx.store, rpcClient);
    const liquidityRecords: Record<string, ModifyLiquidityReccord> = {};
    const pairRecordStore: PairRecordStore = new PairRecordStore(ctx.store, rpcClient);
    const swapRecordStore: SwapRecordStore = new SwapRecordStore(ctx.store, pairRecordStore);

    if (!placeholderInited) {
        await ctx.store.upsert(HookPlaceHolder);
        placeholderInited = true;
    }


    for (let block of blocks) {
        for (let inst of block.instructions) {
            if (inst.programId === RaydiumCLMMProgram && !inst.transaction?.err && inst.isCommitted) {

                // if (inst.d8 === createAmmConfig.d8) {
                //     const params = createAmmConfig.decode(inst);
                //     let ammConfig = ammConfigs[params.accounts.ammConfig] ?? await ctx.store.findOneBy(AMMConfig, { id: params.accounts.ammConfig });
                //     if (!ammConfig) {
                //         ammConfigs[params.accounts.ammConfig] = new AMMConfig({
                //             id: params.accounts.ammConfig,
                //             bump: 0,
                //             index: params.data.index,
                //             owner: params.accounts.owner,
                //             protocolFeeRate: params.data.protocolFeeRate,
                //             tradeFeeRate: params.data.tradeFeeRate,
                //             tickSpacing: params.data.tickSpacing,
                //             fundFeeRate: params.data.fundFeeRate,
                //             fundOwner: ''
                //         });
                //     } else {
                //         ammConfig.protocolFeeRate = params.data.protocolFeeRate;
                //         ammConfig.tradeFeeRate = params.data.tradeFeeRate;
                //         ammConfig.tickSpacing = params.data.tickSpacing;
                //         ammConfig.fundFeeRate = params.data.fundFeeRate;
                //         ammConfigs[params.accounts.ammConfig] = ammConfig;
                //     }
                // }

                // if (inst.d8 === updateAmmConfig.d8) {
                //     const params = updateAmmConfig.decode(inst);
                //     const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                //     if (log) {
                //         const event = ConfigChangeEvent.decodeData(base64.decode(log.message));
                //         let ammConfig = ammConfigs[params.accounts.ammConfig] ?? await ctx.store.findOneBy(AMMConfig, { id: params.accounts.ammConfig });
                //         if (ammConfig) {
                //             ammConfig.fundFeeRate = event.fundFeeRate;
                //             ammConfig.fundOwner = event.fundOwner
                //             ammConfig.index = event.index
                //             ammConfig.owner = event.owner
                //             ammConfig.protocolFeeRate = event.protocolFeeRate
                //             ammConfig.tickSpacing = event.tickSpacing
                //             ammConfig.tradeFeeRate = event.tradeFeeRate
                //             ammConfigs[params.accounts.ammConfig] = ammConfig
                //         }

                //     }
                //     console.dir(["updateAmmConfig", inst.getTransaction().signatures,], { depth: null });
                // }

                // if (inst.d8 === updatePoolStatus.d8) {
                //     const params = updatePoolStatus.decode(inst);
                //     const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                //     if (pool) {
                //         pool.status = params.data.status;
                //         pools[params.accounts.poolState] = pool;
                //     }
                // }

                // if (inst.d8 === collectProtocolFee.d8)
                //     console.dir(["collectProtocolFee", inst.getTransaction().signatures, collectProtocolFee.decode(inst)], { depth: null });

                // if (inst.d8 === collectFundFee.d8)
                //     console.dir(["collectFundFee", inst.getTransaction().signatures, collectFundFee.decode(inst)], { depth: null });

                // if (inst.d8 === closePosition.d8) {
                //     const params = closePosition.decode(inst);
                //     // const posKey = `${params.accounts.positionNftOwner}-${params.data.tickLowerIndex}-${params.data.tickUpperIndex}-${params.accounts.poolState}`;
                //     const position = positions[params.accounts.personalPosition] ?? await ctx.store.findOneBy(Position, { id: params.accounts.personalPosition });
                //     if (position) {
                //         // position.closed = true;
                //         positions[params.accounts.personalPosition] = position;
                //     }
                // }


                if (inst.d8 === createPool.d8) {
                    console.log("createPool");
                    const params = createPool.decode(inst);
                    const pool = await poolStore.get(params.accounts.poolState);

                    if (!pool) {
                        const ammConfig = await poolStore.fetchAMMConfig(params.accounts.ammConfig);
                        const token0 = await tokenStore.ensure(params.accounts.tokenMint0);
                        const token1 = await tokenStore.ensure(params.accounts.tokenMint1);

                        const newPool = new Pool({
                            id: params.accounts.poolState,
                            token0Id: token0.id,
                            token0: token0,
                            token1Id: token1.id,
                            hookId: HookPlaceHolder.id,
                            token1: token1,
                            token0Decimals: token0.decimals,
                            token1Decimals: token1.decimals,
                            amount0: 0n,
                            amount0D: '0',
                            amount1: 0n,
                            amount1D: '0',
                            price0: 0,
                            price1: 0,
                            poolAddress: params.accounts.poolState,
                            // fee: ammConfig.tradeFeeRate / 1000,
                            fee: ammConfig.tradeFeeRate,
                            sqrtPriceX96: params.data.sqrtPriceX64,
                            currentTick: 0,
                            liquidity: 0n,
                            volumeToken0: 0n,
                            volumeToken0D: '',
                            volumeToken1D: '',
                            volumeToken1: 0n,
                            volumeUSD: 0,
                            collectedFeesToken0: 0n,
                            collectedFeesToken1: 0n,
                            collectedFeesUSD: 0,
                            tvlUSD: 0,
                            tickSpacing: 0,
                            batchBlockMinimumTick: 0,
                            batchBlockMaximumTick: 0,
                            swapCount: 0n,
                            chainId: 0,
                            blockNumber: BigInt(inst.block.height),
                            timestamp: BigInt(inst.block.timestamp),
                            createdAtTimestamp: BigInt(inst.block.timestamp),
                            createdAtBlockNumber: BigInt(inst.block.height),
                            // positions: Position[],
                            // poolDayDatas: PoolDayData[],
                            // poolHourDatas: PoolHourData[]
                        });

                        token0.poolCount += 1;
                        token1.poolCount += 1;
                        await pairRecordStore.insert(newPool.id, newPool.token0Id, newPool.token1Id, new Date(inst.block.timestamp), params.data.sqrtPriceX64);
                        await tokenStore.save(token0, token1);
                        await walletStore.ensure(params.accounts.poolCreator);
                        await poolStore.save(newPool);
                    }
                }

                if (inst.d8 === openPositionWithToken22Nft.d8 || inst.d8 === openPosition.d8 || inst.d8 === openPositionV2.d8) {
                    let poolId, ownerId, positionId: string;
                    let tickLower, tickUpper: number;
                    let liquidity: bigint;
                    if (inst.d8 === openPositionWithToken22Nft.d8) {
                        const { accounts, data } = openPositionWithToken22Nft.decode(inst);
                        [poolId, ownerId, positionId] = [accounts.poolState, accounts.positionNftOwner, accounts.personalPosition];
                        [tickLower, tickUpper, liquidity] = [data.tickLowerIndex, data.tickUpperIndex, data.liquidity];
                    } else if (inst.d8 === openPosition.d8) {
                        const { accounts, data } = openPosition.decode(inst);
                        [poolId, ownerId, positionId] = [accounts.poolState, accounts.positionNftOwner, accounts.personalPosition];
                        [tickLower, tickUpper, liquidity] = [data.tickLowerIndex, data.tickUpperIndex, data.liquidity];
                    } else {
                        const { accounts, data } = openPositionV2.decode(inst);
                        [poolId, ownerId, positionId] = [accounts.poolState, accounts.positionNftOwner, accounts.personalPosition];
                        [tickLower, tickUpper, liquidity] = [data.tickLowerIndex, data.tickUpperIndex, data.liquidity];
                    }

                    const pool = await poolStore.get(poolId);
                    if (pool) {
                        const owner = await walletStore.ensure(ownerId);
                        const manager = await managerStore.getManager();
                        const position = await positionStore.get(positionId);
                        if (!position) {
                            const token0 = await tokenStore.ensure(pool.token0Id);
                            const token1 = await tokenStore.ensure(pool.token0Id);
                            const newPosition = new Position({
                                id: positionId,
                                nftId: 0n,
                                lowerTick: tickLower,
                                upperTick: tickUpper,
                                liquidity: liquidity,
                                amount0: 0n,
                                amount0D: '',
                                amount1: 0n,
                                amount1D: '',
                                token0Id: pool.token0Id,
                                token0: token0,
                                token1Id: pool.token1Id,
                                token1: token1,
                                coreTotalUSD: 0,
                                managerId: RaydiumCLMMProgram,
                                manager: manager,
                                poolId: pool.id,
                                pool: pool,
                                ownerId: owner.id,
                                owner: owner,
                                ratio: 0,
                                chainId: 0,
                                blockNumber: BigInt(inst.block.height),
                                timestamp: BigInt(inst.block.timestamp)
                            });

                            const event = getCreatePositionEvent(block.logs);
                            if (event) {
                                newPosition.liquidity = event.liquidity;
                                newPosition.amount0 = event.depositAmount0;
                                newPosition.amount1 = event.depositAmount1;
                                newPosition.ratio = Number(event.depositAmount0 / event.depositAmount1);
                                pool.liquidity += event.liquidity;
                                pool.amount0 += event.depositAmount0;
                                pool.amount1 += event.depositAmount1;
                            }

                            if (!owner.positions) owner.positions = []
                            owner.positions.push(newPosition);
                            await walletStore.save(owner);
                            await positionStore.save(newPosition);
                            await poolStore.save(pool);
                            await managerStore.addPosition(newPosition);
                            await managerStore.incPoolCount();
                        }
                    }
                }

                // if (inst.d8 === swap.d8) {
                //     const params = swap.decode(inst);
                //     const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                //     if (pool) {
                //         pool.swapCount += 1n;
                //         pools[params.accounts.poolState] = pool;
                //     }
                // }

                // if (inst.d8 === swapV2.d8) {
                //     const params = swapV2.decode(inst);
                //     const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                //     if (pool) {
                //         pool.swapCount += 1n;
                //         pools[params.accounts.poolState] = pool;
                //     }
                // }

                // if (inst.d8 === swapRouterBaseIn.d8) {
                //     const params = swapRouterBaseIn.decode(inst);
                //     console.dir(["swapRouterBaseIn", inst.getTransaction().signatures, params], { depth: null });
                // }

                // if (inst.d8 === setRewardParams.d8) {
                //     const params = setRewardParams.decode(inst);
                //     const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                //     if (pool) {
                //         const rewardId = `${params.accounts.poolState}-${params.data.rewardIndex}`;
                //         const reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                //         if (reward) {
                //             reward.emissionsPerSecondX64 = params.data.emissionsPerSecondX64;
                //             reward.openTime = new Date(Number(params.data.openTime));
                //             reward.endTime = new Date(Number(params.data.endTime));
                //             rewards[rewardId] = reward;
                //             pools[params.accounts.poolState] = pool;
                //         }
                //     }
                // }

                // if (inst.d8 === initializeReward.d8) {
                //     const params = initializeReward.decode(inst);
                //     console.dir([inst.transaction?.signatures, params], { depth: null });
                //     const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                //     if (pool) {
                //         // I can ensure the index reward will be related to pool token0, token1
                //         // for now we assume reward index will be based order of initialization.
                //         let storedRewards = Object.values(rewards).filter(a => a.poolId === params.accounts.poolState) ?? [];
                //         if (storedRewards.length < 1) {
                //             storedRewards = await ctx.store.findBy(Reward, { poolId: params.accounts.poolState }) ?? [];
                //             storedRewards.forEach(a => (rewards[a.id] = a));
                //         }
                //         const rewardId = `${params.accounts.poolState}-${storedRewards.length}`;
                //         const reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                //         if (!reward) rewards[params.accounts.poolState] =
                //             new Reward({
                //                 id: rewardId,
                //                 index: storedRewards.length,
                //                 rewardFunder: params.accounts.rewardFunder,
                //                 ammConfig: params.accounts.ammConfig,
                //                 poolId: params.accounts.poolState,
                //                 rewardToken: params.accounts.rewardTokenMint,
                //                 openTime: new Date(Number(params.data.param.openTime)),
                //                 endTime: new Date(Number(params.data.param.endTime)),
                //                 emissionsPerSecondX64: params.data.param.emissionsPerSecondX64,
                //                 hash: inst.transaction?.signatures[0],
                //                 collected: false
                //             });
                //     }
                // }

                // if (inst.d8 === collectRemainingRewards.d8) {
                //     const params = collectRemainingRewards.decode(inst);
                //     const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                //     if (pool) {
                //         const rewardId = `${params.accounts.poolState}-${params.data.rewardIndex}`;
                //         const reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                //         if (reward) {
                //             reward.collected = true;
                //             rewards[rewardId] = reward;
                //             pools[params.accounts.poolState] = pool;
                //         }
                //     }
                // }

                // if (inst.d8 === updateRewardInfos.d8) {
                //     const params = updateRewardInfos.decode(inst);
                //     // since log of this instruction doesn't have poolId, so we fetch the log here rather in separate process.
                //     const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                //     if (log) {
                //         const event = UpdateRewardInfosEvent.decodeData(base64.decode(log.message));
                //         for (let i = 0; i < event.rewardGrowthGlobalX64.length; i++) {
                //             const rewardId = `${params.accounts.poolState}-${i}`
                //             let reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                //             if (reward) {
                //                 reward.emissionsPerSecondX64 = event.rewardGrowthGlobalX64[i]
                //                 rewards[rewardId] = reward;
                //             }
                //         }
                //     }
                // }


                if (inst.d8 === increaseLiquidity.d8 || inst.d8 === increaseLiquidityV2.d8) {
                    let poolId, positionId: string;
                    if (inst.d8 === increaseLiquidity.d8) {
                        const { accounts } = increaseLiquidity.decode(inst);
                        poolId = accounts.poolState;
                        positionId = accounts.personalPosition;
                    } else {
                        const { accounts } = increaseLiquidityV2.decode(inst);
                        poolId = accounts.poolState;
                        positionId = accounts.personalPosition;
                    }

                    const pool = await poolStore.get(poolId);
                    if (pool) {
                        const position = await positionStore.get(positionId);
                        if (position) {
                            const event = getIncreaseLiquidityEvent(block.logs);
                            if (event) {
                                position.liquidity = event.liquidity;
                                position.amount0 += event.amount0;
                                position.amount1 += event.amount1;
                                position.ratio = Number(position.amount0 / position.amount1);
                                pool.liquidity += event.liquidity;
                                pool.amount0 += event.amount0;
                                pool.amount1 += event.amount1;
                            }
                            await poolStore.save(pool);
                            await positionStore.save(position);
                        }
                    }
                }


                if (inst.d8 === decreaseLiquidity.d8 || inst.d8 === decreaseLiquidityV2.d8) {
                    let poolId, positionId: string;
                    if (inst.d8 === decreaseLiquidity.d8) {
                        const { accounts } = decreaseLiquidity.decode(inst);
                        [poolId, positionId] = [accounts.poolState, accounts.personalPosition];
                    } else {
                        const { accounts } = decreaseLiquidityV2.decode(inst);
                        [poolId, positionId] = [accounts.poolState, accounts.personalPosition];
                    }

                    const pool = await poolStore.get(poolId);
                    if (pool) {
                        const position = await positionStore.get(positionId);
                        if (position) {
                            const event = getDecreaseLiquidityEvent(block.logs);
                            if (event) {
                                position.liquidity = event.liquidity;
                                position.amount0 -= event.decreaseAmount0;
                                position.amount1 -= event.decreaseAmount1;
                                position.ratio = Number(position.amount0 / position.amount1);
                                pool.liquidity -= event.liquidity;
                                pool.amount0 -= event.decreaseAmount0;
                                pool.amount1 -= event.decreaseAmount1;
                            }
                            await poolStore.save(pool);
                            await positionStore.save(position);
                        }
                    }
                }
            }
        }

        for (let log of block.logs) {
            if (log.programId === RaydiumCLMMProgram) {

                try {
                    const event = PoolCreatedEvent.decodeData(base64.decode(log.message));
                    const pool = await poolStore.get(event.poolState);
                    if (pool) {
                        pool.currentTick = event.tick;
                        pool.tickSpacing = event.tickSpacing;
                        poolStore.save(pool);
                    }
                } catch (_) { }

                try {
                    const event = LiquidityChangeEvent.decodeData(base64.decode(log.message));
                    const pool = await poolStore.get(event.poolState);
                    if (pool) {
                        pool.currentTick = event.tick;
                        pool.batchBlockMinimumTick = event.tickLower;
                        pool.batchBlockMaximumTick = event.tickUpper;
                        pool.liquidity = event.liquidityAfter;
                        pool.timestamp = BigInt(log.block.timestamp);
                        pool.blockNumber = BigInt(log.block.height);
                        await poolStore.save(pool);

                        const sender = await walletStore.ensure(log.getInstruction().accounts[0]);

                        const recordId = `${log.id}-${log.logIndex}`
                        liquidityRecords[recordId] = new ModifyLiquidityReccord({
                            id: recordId,
                            poolId: pool.id,
                            poolEntityId: pool.id,
                            poolEntity: pool,
                            liquidityDelta: event.liquidityBefore - event.liquidityAfter,
                            senderId: sender.id,
                            sender: sender,
                            tickLower: event.tickLower,
                            tickUpper: event.tickUpper,
                            hash: log.transaction?.signatures[0],
                            txAtTimestamp: BigInt(log.block.timestamp),
                            txAtBlockNumber: BigInt(log.block.height)
                        })
                    }
                } catch (_) { }

                try {
                    const event = SwapEvent.decodeData(base64.decode(log.message));
                    const pool = await poolStore.get(event.poolState);
                    if (pool) {
                        pairRecordStore.insert(pool.id, pool.token0Id, pool.token1Id, new Date(log.block.timestamp), event.sqrtPriceX64);
                        pool.liquidity = event.liquidity;
                        await poolStore.save(pool);

                        const token0 = await tokenStore.ensure(pool.token0Id);
                        const token1 = await tokenStore.ensure(pool.token1Id);
                        const sender = await walletStore.ensure(event.sender);
                        const recordId = `${log.id}-${log.logIndex}`;

                        const token = await swapRecordStore.record(recordId, log.transaction?.signatures[0] ?? '', pool, token0, token1, sender, event, log.block);

                        pool.swapCount += 1n;
                        if (event.zeroForOne) {
                            pool.amount0 += event.amount0;
                            pool.amount1 -= event.amount1
                        } else {
                            pool.amount0 -= event.amount0;
                            pool.amount1 += event.amount1
                        }
                        pool.volumeToken0 += event.amount0;
                        pool.volumeToken1 += event.amount1;

                        pool.timestamp = BigInt(log.block.timestamp);
                        pool.blockNumber = BigInt(log.block.height);
                        await managerStore.incSwapCount();
                        await tokenStore.save(token);
                        await poolStore.save(pool);
                    } else {
                        // pairRecordStore.withPoolFetch(event.poolState, new Date(log.block.timestamp), event.sqrtPriceX64);
                    }
                } catch (_) { }

                // try {
                //     const event = LiquidityCalculateEvent.decodeData(base64.decode(log.message));

                //     console.dir(["success decode: LiquidityCalculateEvent", log.transaction?.signatures[0], event], { depth: null });
                // } catch (_) { }

                // try {
                //     const event = CollectPersonalFeeEvent.decodeData(base64.decode(log.message));
                //     console.dir(["success decode: CollectPersonalFeeEvent", event], { depth: null });
                // } catch (_) { }

                // try {
                //     const event = CollectProtocolFeeEvent.decodeData(base64.decode(log.message));
                //     console.dir(["success decode: CollectProtocolFeeEvent", event], { depth: null });
                // } catch (_) { }

            }
        }
    }
    await tokenStore.flush();
    await walletStore.flush();
    await poolStore.flush();
    await positionStore.flush();
    await managerStore.flush();
    await swapRecordStore.flush();

    // await ctx.store.upsert(Object.values(wallets));
    // console.dir(["pool", Object.values(pools)], { depth: null });
    // await ctx.store.upsert(Object.values(pools));

    // await ctx.store.upsert(Object.values(positions));
    // await ctx.store.upsert(Object.values(poolDays));
    // await ctx.store.upsert(Object.values(poolHours));
    // await ctx.store.upsert(Object.values(swapRecords));
    // await ctx.store.upsert(Object.values(liquidityRecords));
})