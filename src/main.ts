import { base64 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { Metaplex } from '@metaplex-foundation/js';
import { Connection, PublicKey } from '@solana/web3.js';
import { run } from '@subsquid/batch-processor';
import { Src } from '@subsquid/borsh';
import { augmentBlock } from '@subsquid/solana-objects';
import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { CollectPersonalFeeEvent, CollectProtocolFeeEvent, ConfigChangeEvent, CreatePersonalPositionEvent, DecreaseLiquidityEvent, IncreaseLiquidityEvent, LiquidityCalculateEvent, LiquidityChangeEvent, PoolCreatedEvent, SwapEvent, UpdateRewardInfosEvent } from './abi/generated/amm_v3/events';
import { closePosition, collectFundFee, collectProtocolFee, collectRemainingRewards, createAmmConfig, createPool, decreaseLiquidity, decreaseLiquidityV2, increaseLiquidity, increaseLiquidityV2, initializeReward, openPosition, openPositionV2, openPositionWithToken22Nft, setRewardParams, swap, swapRouterBaseIn, swapV2, updateAmmConfig, updatePoolStatus, updateRewardInfos } from './abi/generated/amm_v3/instructions';
import { AmmConfig } from './abi/generated/amm_v3/types';
import { Pool, Position } from './model';
import { AMMConfig } from './model/amm_config.model';
import { Reward } from './model/reward.model';
import { Volume } from './model/volume.model';


const rpcClient = new Connection(process.env.SOLANA_NODE ?? "https://api.mainnet-beta.solana.com");
const metaplex = Metaplex.make(rpcClient);


const LAMPORTS = 1_000_000_000;
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

        },
        tokenBalance: { // token balance record fields
            // preAmount: true,
            // postAmount: true,
            // preOwner: true,
            postOwner: true
        },
        balance: {
            // pre: true,
            // post: true,
        }
    })
    // By default, block can be skipped if it doesn't contain explicitly requested items.
    //
    // We request items via `.addXxx()` methods.
    //
    // Each `.addXxx()` method accepts item selection criteria
    // and also allows to request related items.
    //
    // .addBalance(TrackBalance ? {
    //     where: {},
    //     include: {}
    // } : {})
    // .addTokenBalance({
    //     where: {
    //         preMint: [CupseyToken, VineToken],
    //     },
    //     include: {
    //         transaction: true,
    //         transactionInstructions: true
    //     }
    // })
    .addInstruction({
        where: {
            programId: [RaydiumCLMMProgram],
            d8: [
                // createAmmConfig.d8,
                // updateAmmConfig.d8,
                // createPool.d8,
                // updatePoolStatus.d8,
                // initializeReward.d8,
                // collectRemainingRewards.d8,
                // updateRewardInfos.d8,
                // setRewardParams.d8,
                // collectProtocolFee.d8,
                collectFundFee.d8,
                // openPosition.d8,
                // openPositionV2.d8,
                // openPositionWithToken22Nft.d8,
                // closePosition.d8,
                increaseLiquidity.d8,
                // increaseLiquidityV2.d8,
                // decreaseLiquidity.d8,
                // decreaseLiquidityV2.d8,
                // swap.d8,
                // swapV2.d8,
                // swapRouterBaseIn.d8,
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

async function getTokenMetadata(mintAddress: string) {

    

    const address = new PublicKey(mintAddress);

    const metadataAccount = metaplex
        .nfts()
        .pdas()
        .metadata({ mint: address });

    const metadataAccountInfo = await rpcClient.getAccountInfo(metadataAccount);

    if (metadataAccountInfo) {
        const token = await metaplex.nfts().findByMint({ mintAddress: address });

        console.log({ address: mintAddress, token });
    }
}

async function getAMMConfigMetadata(ammConfig: string): Promise<AmmConfig | undefined> {

    const address = new PublicKey(ammConfig);
    const metadataAccountInfo = await rpcClient.getAccountInfo(address);

    if (metadataAccountInfo) {
        const config = AmmConfig.decode(new Src(metadataAccountInfo.data));
        return config
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

// Now we are ready to start data processing
run(dataSource, database, async ctx => {
    // Block items that we get from `ctx.blocks` are flat JS objects.
    //
    // We can use `augmentBlock()` function from `@subsquid/solana-objects`
    // to enrich block items with references to related objects and
    // with convenient getters for derived data (e.g. `Instruction.d8`).
    let blocks = ctx.blocks.map(augmentBlock);

    const pools: Record<string, Pool> = {};
    const positions: Record<string, Position> = {};
    const volumes: Record<string, Volume> = {};
    const ammConfigs: Record<string, AMMConfig> = {};
    const rewards: Record<string, Reward> = {};


    for (let block of blocks) {
        for (let inst of block.instructions) {
            if (inst.programId === RaydiumCLMMProgram && !inst.transaction?.err && inst.isCommitted) {

                if (inst.d8 === createAmmConfig.d8) {
                    const params = createAmmConfig.decode(inst);
                    let ammConfig = ammConfigs[params.accounts.ammConfig] ?? await ctx.store.findOneBy(AMMConfig, { id: params.accounts.ammConfig });
                    if (!ammConfig) {
                        ammConfigs[params.accounts.ammConfig] = new AMMConfig({
                            id: params.accounts.ammConfig,
                            bump: 0,
                            index: params.data.index,
                            owner: params.accounts.owner,
                            protocolFeeRate: params.data.protocolFeeRate,
                            tradeFeeRate: params.data.tradeFeeRate,
                            tickSpacing: params.data.tickSpacing,
                            fundFeeRate: params.data.fundFeeRate,
                            fundOwner: ''
                        });
                    } else {
                        ammConfig.protocolFeeRate = params.data.protocolFeeRate;
                        ammConfig.tradeFeeRate = params.data.tradeFeeRate;
                        ammConfig.tickSpacing = params.data.tickSpacing;
                        ammConfig.fundFeeRate = params.data.fundFeeRate;
                        ammConfigs[params.accounts.ammConfig] = ammConfig;
                    }
                }

                if (inst.d8 === updateAmmConfig.d8) {
                    const params = updateAmmConfig.decode(inst);
                    const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                    if (log) {
                        const event = ConfigChangeEvent.decodeData(base64.decode(log.message));
                        let ammConfig = ammConfigs[params.accounts.ammConfig] ?? await ctx.store.findOneBy(AMMConfig, { id: params.accounts.ammConfig });
                        if (ammConfig) {
                            ammConfig.fundFeeRate = event.fundFeeRate;
                            ammConfig.fundOwner = event.fundOwner
                            ammConfig.index = event.index
                            ammConfig.owner = event.owner
                            ammConfig.protocolFeeRate = event.protocolFeeRate
                            ammConfig.tickSpacing = event.tickSpacing
                            ammConfig.tradeFeeRate = event.tradeFeeRate
                            ammConfigs[params.accounts.ammConfig] = ammConfig
                        }

                    }
                    console.dir(["updateAmmConfig", inst.getTransaction().signatures,], { depth: null });
                }

                if (inst.d8 === updatePoolStatus.d8) {
                    const params = updatePoolStatus.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        pool.status = params.data.status;
                        pools[params.accounts.poolState] = pool;
                    }
                }

                if (inst.d8 === collectProtocolFee.d8)
                    console.dir(["collectProtocolFee", inst.getTransaction().signatures, collectProtocolFee.decode(inst)], { depth: null });

                if (inst.d8 === collectFundFee.d8)
                    console.dir(["collectFundFee", inst.getTransaction().signatures, collectFundFee.decode(inst)], { depth: null });

                if (inst.d8 === closePosition.d8) {
                    const params = closePosition.decode(inst);
                    // const posKey = `${params.accounts.positionNftOwner}-${params.data.tickLowerIndex}-${params.data.tickUpperIndex}-${params.accounts.poolState}`;
                    const position = positions[params.accounts.personalPosition] ?? await ctx.store.findOneBy(Position, { id: params.accounts.personalPosition });
                    if (position) {
                        position.closed = true;
                        positions[params.accounts.personalPosition] = position;
                    }
                }


                if (inst.d8 === createPool.d8) {
                    const params = createPool.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (!pool) {
                        const newPool = new Pool({
                            id: params.accounts.poolState,
                            creator: params.accounts.poolCreator,
                            ammConfig: params.accounts.ammConfig,
                            observationState: params.accounts.observationState,
                            tickArrayBitmap: params.accounts.tickArrayBitmap,
                            sqrtPriceX64: params.data.sqrtPriceX64,
                            tick: 0,
                            tickSpacing: 0,
                            liquidity: 0n,
                            tickLower: 0,
                            tickUpper: 0,
                            openTime: params.data.openTime,
                            token0: params.accounts.tokenMint0,
                            token1: params.accounts.tokenMint1,
                            hash: inst.transaction?.signatures[0]
                        });
                        pools[params.accounts.poolState] = newPool;
                        const decodedConfig = await getAMMConfigMetadata(params.accounts.ammConfig);
                        let ammConfig = ammConfigs[params.accounts.ammConfig] ?? await ctx.store.findOneBy(AMMConfig, { id: params.accounts.ammConfig });
                        if (!ammConfig && decodedConfig) ammConfig = new AMMConfig({
                            id: params.accounts.ammConfig,
                            bump: decodedConfig.bump,
                            index: decodedConfig.index,
                            owner: decodedConfig.owner,
                            protocolFeeRate: decodedConfig.protocolFeeRate,
                            tradeFeeRate: decodedConfig.tradeFeeRate,
                            tickSpacing: decodedConfig.tickSpacing,
                            fundFeeRate: decodedConfig.fundFeeRate,
                            fundOwner: decodedConfig.fundOwner
                        });
                        ammConfigs[params.accounts.ammConfig] = ammConfig;
                        // await getTokenMetadata(params.accounts.tokenMint0);
                        // await getTokenMetadata(params.accounts.tokenMint1);
                    }

                }

                if (inst.d8 === openPositionWithToken22Nft.d8) {
                    const params = openPositionWithToken22Nft.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        // const posKey = `${params.accounts.positionNftOwner}-${params.data.tickLowerIndex}-${params.data.tickUpperIndex}-${params.accounts.poolState}`;
                        const position = positions[params.accounts.personalPosition] ?? await ctx.store.findOneBy(Position, { id: params.accounts.personalPosition });
                        if (!position) {
                            const newPosition = new Position({
                                id: params.accounts.personalPosition,
                                owner: params.accounts.positionNftOwner,
                                poolId: params.accounts.poolState,
                                tickLowerIndex: params.data.tickLowerIndex,
                                tickUpperIndex: params.data.tickUpperIndex,
                                tickArrayLowerStartIndex: params.data.tickArrayLowerStartIndex,
                                tickArrayUpperStartIndex: params.data.tickArrayLowerStartIndex,
                                liquidity: 0n,
                                hash: inst.transaction?.signatures[0]
                            })
                            const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                            if (log) {
                                const event = CreatePersonalPositionEvent.decodeData(base64.decode(log.message));
                                newPosition.liquidity = event.liquidity;
                            }
                            positions[params.accounts.personalPosition] = newPosition;
                            pools[params.accounts.poolState] = pool;
                        }
                    }
                }

                if (inst.d8 === openPosition.d8) {
                    const params = openPosition.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        // const posKey = `${params.accounts.positionNftOwner}-${params.data.tickLowerIndex}-${params.data.tickUpperIndex}-${params.accounts.poolState}`;
                        const position = positions[params.accounts.personalPosition] ?? await ctx.store.findOneBy(Position, { id: params.accounts.personalPosition });
                        if (!position) {
                            const newPosition = new Position({
                                id: params.accounts.personalPosition,
                                owner: params.accounts.positionNftOwner,
                                poolId: params.accounts.poolState,
                                tickLowerIndex: params.data.tickLowerIndex,
                                tickUpperIndex: params.data.tickUpperIndex,
                                tickArrayLowerStartIndex: params.data.tickArrayLowerStartIndex,
                                tickArrayUpperStartIndex: params.data.tickArrayLowerStartIndex,
                                liquidity: 0n,
                                hash: inst.transaction?.signatures[0]
                            })
                            const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                            if (log) {
                                const event = CreatePersonalPositionEvent.decodeData(base64.decode(log.message));
                                newPosition.liquidity = event.liquidity;
                            }
                            positions[params.accounts.personalPosition] = newPosition;
                            pools[params.accounts.poolState] = pool;
                        }
                    }
                }

                if (inst.d8 === openPositionV2.d8) {
                    const params = openPositionV2.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        // const posKey = `${params.accounts.positionNftOwner}-${params.data.tickLowerIndex}-${params.data.tickUpperIndex}-${params.accounts.poolState}`;
                        const position = positions[params.accounts.personalPosition] ?? await ctx.store.findOneBy(Position, { id: params.accounts.personalPosition });
                        if (!position) {
                            const newPosition = new Position({
                                id: params.accounts.personalPosition,
                                owner: params.accounts.positionNftOwner,
                                poolId: params.accounts.poolState,
                                tickLowerIndex: params.data.tickLowerIndex,
                                tickUpperIndex: params.data.tickUpperIndex,
                                tickArrayLowerStartIndex: params.data.tickArrayLowerStartIndex,
                                tickArrayUpperStartIndex: params.data.tickArrayLowerStartIndex,
                                liquidity: 0n,
                                hash: inst.transaction?.signatures[0]
                            })
                            const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                            if (log) {
                                const event = CreatePersonalPositionEvent.decodeData(base64.decode(log.message));
                                newPosition.liquidity = event.liquidity;
                            }
                            positions[params.accounts.personalPosition] = newPosition;
                            pools[params.accounts.poolState] = pool;
                        }
                    }
                }

                if (inst.d8 === swap.d8) {
                    const params = swap.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        pool.swapCount += 1n;
                        pools[params.accounts.poolState] = pool;
                    }
                }

                if (inst.d8 === swapV2.d8) {
                    const params = swapV2.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        pool.swapCount += 1n;
                        pools[params.accounts.poolState] = pool;
                    }
                }

                if (inst.d8 === swapRouterBaseIn.d8) {
                    const params = swapRouterBaseIn.decode(inst);
                    console.dir(["swapRouterBaseIn", inst.getTransaction().signatures, params], { depth: null });
                }

                if (inst.d8 === setRewardParams.d8) {
                    const params = setRewardParams.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        const rewardId = `${params.accounts.poolState}-${params.data.rewardIndex}`;
                        const reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                        if (reward) {
                            reward.emissionsPerSecondX64 = params.data.emissionsPerSecondX64;
                            reward.openTime = new Date(Number(params.data.openTime));
                            reward.endTime = new Date(Number(params.data.endTime));
                            rewards[rewardId] = reward;
                            pools[params.accounts.poolState] = pool;
                        }
                    }
                }

                if (inst.d8 === initializeReward.d8) {
                    const params = initializeReward.decode(inst);
                    console.dir([inst.transaction?.signatures, params], { depth: null });
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        // I can ensure the index reward will be related to pool token0, token1
                        // for now we assume reward index will be based order of initialization.
                        let storedRewards = Object.values(rewards).filter(a => a.poolId === params.accounts.poolState) ?? [];
                        if (storedRewards.length < 1) {
                            storedRewards = await ctx.store.findBy(Reward, { poolId: params.accounts.poolState }) ?? [];
                            storedRewards.forEach(a => (rewards[a.id] = a));
                        }
                        const rewardId = `${params.accounts.poolState}-${storedRewards.length}`;
                        const reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                        if (!reward) rewards[params.accounts.poolState] =
                            new Reward({
                                id: rewardId,
                                index: storedRewards.length,
                                rewardFunder: params.accounts.rewardFunder,
                                ammConfig: params.accounts.ammConfig,
                                poolId: params.accounts.poolState,
                                rewardToken: params.accounts.rewardTokenMint,
                                openTime: new Date(Number(params.data.param.openTime)),
                                endTime: new Date(Number(params.data.param.endTime)),
                                emissionsPerSecondX64: params.data.param.emissionsPerSecondX64,
                                hash: inst.transaction?.signatures[0],
                                collected: false
                            });
                    }
                }

                if (inst.d8 === collectRemainingRewards.d8) {
                    const params = collectRemainingRewards.decode(inst);
                    const pool = pools[params.accounts.poolState] ?? await ctx.store.findOneBy(Pool, { id: params.accounts.poolState });
                    if (pool) {
                        const rewardId = `${params.accounts.poolState}-${params.data.rewardIndex}`;
                        const reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                        if (reward) {
                            reward.collected = true;
                            rewards[rewardId] = reward;
                            pools[params.accounts.poolState] = pool;
                        }
                    }
                }

                if (inst.d8 === updateRewardInfos.d8) {
                    const params = updateRewardInfos.decode(inst);
                    // since log of this instruction doesn't have poolId, so we fetch the log here rather in separate process.
                    const log = block.logs.find(a => (a.kind === 'data' && a.transactionIndex === inst.transactionIndex));
                    if (log) {
                        const event = UpdateRewardInfosEvent.decodeData(base64.decode(log.message));
                        for (let i = 0; i < event.rewardGrowthGlobalX64.length; i++) {
                            const rewardId = `${params.accounts.poolState}-${i}`
                            let reward = rewards[rewardId] ?? await ctx.store.findOneBy(Reward, { id: rewardId });
                            if (reward) {
                                reward.emissionsPerSecondX64 = event.rewardGrowthGlobalX64[i]
                                rewards[rewardId] = reward;
                            }
                        }
                    }
                }


                if (inst.d8 === increaseLiquidity.d8)
                    console.dir(["increaseLiquidity", inst.getTransaction().signatures, increaseLiquidity.decode(inst)], { depth: null });

                if (inst.d8 === increaseLiquidityV2.d8)
                    console.dir(["increaseLiquidityV2", inst.getTransaction().signatures, increaseLiquidityV2.decode(inst)], { depth: null });

                if (inst.d8 === decreaseLiquidity.d8)
                    console.dir(["decreaseLiquidity", inst.getTransaction().signatures, decreaseLiquidity.decode(inst)], { depth: null });

                if (inst.d8 === decreaseLiquidityV2.d8)
                    console.dir(["decreaseLiquidityV2", inst.getTransaction().signatures, decreaseLiquidityV2.decode(inst)], { depth: null });
            }
        }

        for (let log of block.logs) {
            if (log.programId === RaydiumCLMMProgram) {

                try {
                    const event = PoolCreatedEvent.decodeData(base64.decode(log.message));
                    const pool = pools[event.poolState] ?? await ctx.store.findOneBy(Pool, { id: event.poolState });
                    if (pool) {
                        pool.tick = event.tick;
                        pool.tickSpacing = event.tickSpacing;
                        pools[event.poolState] = pool;
                    }
                } catch (_) { }

                try {
                    const event = LiquidityChangeEvent.decodeData(base64.decode(log.message));
                    const pool = pools[event.poolState] ?? await ctx.store.findOneBy(Pool, { id: event.poolState });
                    if (pool) {
                        pool.tick = event.tick;
                        pool.tickLower = event.tickLower;
                        pool.tickUpper = event.tickUpper;
                        pool.liquidity = event.liquidityAfter;
                        pools[event.poolState] = pool;
                    }
                } catch (_) { }

                try {
                    const event = DecreaseLiquidityEvent.decodeData(base64.decode(log.message));
                    console.dir(["success decode: DecreaseLiquidityEvent", event], { depth: null });
                } catch (_) { }

                try {
                    const event = IncreaseLiquidityEvent.decodeData(base64.decode(log.message));
                    console.dir(["success decode: IncreaseLiquidityEvent", event], { depth: null });
                } catch (_) { }

                try {
                    const event = SwapEvent.decodeData(base64.decode(log.message));
                    const pool = pools[event.poolState] ?? await ctx.store.findOneBy(Pool, { id: event.poolState });
                    if (pool) {
                        pool.liquidity = event.liquidity;
                        pools[event.poolState] = pool;

                        const startOfDay = new Date(log.block.timestamp);
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date(log.block.timestamp);
                        endOfDay.setHours(23, 59, 59, 999);
                        const volumeId = `${event.poolState}-${startOfDay}-${endOfDay}`;
                        let volume = volumes[volumeId] ?? await ctx.store.findOneBy(Volume, { id: volumeId });
                        if (!volume) {
                            volume = new Volume({
                                id: volumeId,
                                poolId: event.poolState,
                                startTime: startOfDay,
                                endTime: endOfDay,
                                token0: event.amount0,
                                token1: event.amount1,
                                totalSwap: 0n,
                                lowerTick: event.tick,
                                upperTick: event.tick,
                            });
                            volumes[volumeId] = volume;
                        } else {
                            if (log.block.timestamp >= startOfDay.getTime() && log.block.timestamp <= endOfDay.getTime()) {
                                if (volume.lowerTick < event.tick) volume.lowerTick = event.tick;
                                if (volume.upperTick > event.tick) volume.upperTick = event.tick;
                                volume.token0 += event.amount0;
                                volume.token1 += event.amount1;
                                volume.totalSwap += 1n;
                                volumes[volumeId] = volume;
                            }
                        }
                    }
                } catch (_) { }

                try {
                    const event = LiquidityCalculateEvent.decodeData(base64.decode(log.message));
                    console.dir(["success decode: LiquidityCalculateEvent", event], { depth: null });
                } catch (_) { }

                try {
                    const event = CollectPersonalFeeEvent.decodeData(base64.decode(log.message));
                    console.dir(["success decode: CollectPersonalFeeEvent", event], { depth: null });
                } catch (_) { }

                try {
                    const event = CollectProtocolFeeEvent.decodeData(base64.decode(log.message));
                    console.dir(["success decode: CollectProtocolFeeEvent", event], { depth: null });
                } catch (_) { }



            }
        }
    }

    await ctx.store.upsert(Object.values(pools));
    await ctx.store.upsert(Object.values(positions));
    await ctx.store.upsert(Object.values(volumes));
    await ctx.store.upsert(Object.values(ammConfigs));
})