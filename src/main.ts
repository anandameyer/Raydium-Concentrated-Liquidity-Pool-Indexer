import { base64 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { Connection } from '@solana/web3.js';
import { run } from '@subsquid/batch-processor';
import { augmentBlock } from '@subsquid/solana-objects';
import { DataSourceBuilder, SolanaRpcClient } from '@subsquid/solana-stream';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { LiquidityChangeEvent, PoolCreatedEvent, SwapEvent } from './abi/generated/amm_v3/events';
import { createPool, decreaseLiquidity, decreaseLiquidityV2, increaseLiquidity, increaseLiquidityV2, openPosition, openPositionV2, openPositionWithToken22Nft, swap, swapRouterBaseIn, swapV2 } from './abi/generated/amm_v3/instructions';
import { Hook, Pool, Position } from './model/generated';
import { LiquidityRecordStore } from './store/LiquidityRecordStore';
import { ManagerStore } from './store/ManagerStore';
import { PairRecordStore } from './store/PairRecordStore';
import { PoolStore } from './store/PoolStore';
import { PositionStore } from './store/PositionStore';
import { SwapRecordStore } from './store/SwapRecordStore';
import { TokenStore } from './store/TokenStore';
import { WalletStore } from './store/WalletStore';
import { BatchBlockTick, bigIntToDecimalStr, calculateTokenRatio, getCreatePositionEvent, getDecreaseLiquidityEvent, getIncreaseLiquidityEvent, multiplyBigIntByFloat } from './utility';


const rpcClient = new Connection(process.env.SOLANA_NODE ?? "https://api.mainnet-beta.solana.com");

const RaydiumCLMMProgram = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

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
                createPool.d8,
                openPosition.d8,
                openPositionV2.d8,
                openPositionWithToken22Nft.d8,
                increaseLiquidity.d8,
                increaseLiquidityV2.d8,
                decreaseLiquidity.d8,
                decreaseLiquidityV2.d8,
                swap.d8,
                swapV2.d8,
                swapRouterBaseIn.d8,
            ],
            isCommitted: true,
        },
        include: {
            transaction: true,
            logs: true
        }
    })
    .build()


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
    const liquidityRecordStore: LiquidityRecordStore = new LiquidityRecordStore(ctx.store);
    const pairRecordStore: PairRecordStore = new PairRecordStore(ctx.store, tokenStore, rpcClient);
    const swapRecordStore: SwapRecordStore = new SwapRecordStore(ctx.store, pairRecordStore);
    const batchBlockTick: BatchBlockTick = new BatchBlockTick();

    if (!placeholderInited) {
        await ctx.store.upsert(HookPlaceHolder);
        placeholderInited = true;
    }


    for (let block of blocks) {
        for (let inst of block.instructions) {

            if (inst.programId === RaydiumCLMMProgram && !inst.transaction?.err && inst.isCommitted) {

                if (inst.d8 === createPool.d8) {
                    console.log("createPool");
                    const params = createPool.decode(inst);
                    const pool = await poolStore.get(params.accounts.poolState);

                    if (!pool) {
                        const ammConfig = await poolStore.fetchAMMConfig(params.accounts.ammConfig);
                        const token0 = await tokenStore.ensure(params.accounts.tokenMint0);
                        const token1 = await tokenStore.ensure(params.accounts.tokenMint1);
                        token0.timestamp = BigInt(inst.block.timestamp);
                        token0.blockNumber = BigInt(inst.block.height);
                        token1.timestamp = BigInt(inst.block.timestamp);
                        token1.blockNumber = BigInt(inst.block.timestamp);

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
                            fee: ammConfig.tradeFeeRate,
                            sqrtPriceX96: params.data.sqrtPriceX64,
                            currentTick: 0,
                            liquidity: 0n,
                            volumeToken0: 0n,
                            volumeToken0D: '0',
                            volumeToken1D: '0',
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
                        });

                        await pairRecordStore.insert({ poolId: params.accounts.poolState, token0, token1, timestamp: new Date(inst.block.timestamp * 1000), sqrtPriceX64: params.data.sqrtPriceX64 });
                        token0.poolCount += 1;
                        token1.poolCount += 1;
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
                            const token1 = await tokenStore.ensure(pool.token1Id);
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
                                newPosition.amount0D = bigIntToDecimalStr(newPosition.amount0, token0.decimals);
                                newPosition.amount1 = event.depositAmount1;
                                newPosition.amount1D = bigIntToDecimalStr(newPosition.amount1, token1.decimals);
                                newPosition.ratio = calculateTokenRatio(newPosition.amount0, newPosition.amount1, pool.token0Decimals, pool.token1Decimals);
                                newPosition.coreTotalUSD = await pairRecordStore.getPriceForAmount(token0.id, newPosition.amount0) + await pairRecordStore.getPriceForAmount(token1.id, newPosition.amount1);
                                pool.liquidity += event.liquidity;
                                pool.amount0 += event.depositAmount0;
                                pool.amount0D = bigIntToDecimalStr(pool.amount0, token0.decimals);
                                pool.amount1 += event.depositAmount1;
                                pool.amount1D = bigIntToDecimalStr(pool.amount1, token1.decimals);
                            }

                            // if (!owner.positions) owner.positions = [newPosition];
                            await walletStore.save(owner);
                            await positionStore.save(newPosition);
                            await poolStore.save(pool);
                            await managerStore.addPosition(newPosition);
                            await managerStore.incPoolCount();
                        }
                    }
                }


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
                                position.amount0D = bigIntToDecimalStr(position.amount0, pool.token0Decimals);
                                position.amount1D = bigIntToDecimalStr(position.amount1, pool.token1Decimals);
                                position.ratio = calculateTokenRatio(position.amount0, position.amount1, pool.token0Decimals, pool.token1Decimals);;
                                pool.liquidity += event.liquidity;
                                position.coreTotalUSD = await pairRecordStore.getPriceForAmount(pool.token0Id, position.amount0) + await pairRecordStore.getPriceForAmount(pool.token1Id, position.amount1);
                                pool.amount0 += event.amount0;
                                pool.amount1 += event.amount1;
                                pool.amount0D = bigIntToDecimalStr(pool.amount0, pool.token0Decimals);
                                pool.amount1D = bigIntToDecimalStr(pool.amount1, pool.token1Decimals);
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
                                position.amount0D = bigIntToDecimalStr(position.amount0, pool.token0Decimals);
                                position.amount1D = bigIntToDecimalStr(position.amount1, pool.token1Decimals);
                                position.coreTotalUSD = await pairRecordStore.getPriceForAmount(pool.token0Id, position.amount0) + await pairRecordStore.getPriceForAmount(pool.token1Id, position.amount1);
                                position.ratio = calculateTokenRatio(position.amount0, position.amount1, pool.token0Decimals, pool.token1Decimals);;
                                pool.liquidity -= event.liquidity;
                                pool.amount0 -= event.decreaseAmount0;
                                pool.amount1 -= event.decreaseAmount1;
                                pool.amount0D = bigIntToDecimalStr(pool.amount0, pool.token0Decimals);
                                pool.amount1D = bigIntToDecimalStr(pool.amount1, pool.token1Decimals);
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
                        // pool.batchBlockMinimumTick = event.tickLower;
                        // pool.batchBlockMaximumTick = event.tickUpper;

                        pool.liquidity = event.liquidityAfter;
                        pool.timestamp = BigInt(log.block.timestamp);
                        pool.blockNumber = BigInt(log.block.height);
                        await poolStore.save(pool);

                        const sender = await walletStore.ensure(log.getInstruction().accounts[0]);
                        const recordId = `${log.id}-${log.logIndex}`
                        await liquidityRecordStore.record(recordId, log.transaction!.signatures[0], pool, sender, event, log.block);

                    }
                } catch (_) { }

                try {
                    const event = SwapEvent.decodeData(base64.decode(log.message));
                    const pool = await poolStore.get(event.poolState);
                    if (pool) {

                        const token0 = await tokenStore.ensure(pool.token0Id);
                        const token1 = await tokenStore.ensure(pool.token1Id);
                        const sender = await walletStore.ensure(event.sender);

                        await pairRecordStore.insert({ poolId: pool.id, token0, token1, timestamp: new Date(log.block.timestamp * 1000), sqrtPriceX64: event.sqrtPriceX64 });

                        const recordId = `${log.id}-${log.logIndex}`;

                        await swapRecordStore.record(recordId, log.transaction?.signatures[0] ?? '', pool, token0, token1, sender, event, log.block);
                        batchBlockTick.insert(pool.id, event.tick);

                        // if swap token0 to token1, the fee collected from token0 and vice versa.
                        // we save fee on raw format which is should be divide by 10000 to get percentage value,
                        // eg: if raw value is 100, the percentage value should be 0.01%
                        const collectedFee0 = event.zeroForOne ? multiplyBigIntByFloat(event.amount0, pool.fee / 10000) : 0n;
                        const collectedFee1 = event.zeroForOne ? 0n : multiplyBigIntByFloat(event.amount1, pool.fee / 10000);

                        // swap only on quoted token, if zeroForOne, token1 is quoted and vice versa
                        const token = event.zeroForOne ? token0 : token1;
                        token.swapCount += 1n;

                        pool.swapCount += 1n;
                        if (event.zeroForOne) {
                            pool.amount0 += event.amount0;
                            pool.amount1 -= event.amount1
                        } else {
                            pool.amount0 -= event.amount0;
                            pool.amount1 += event.amount1
                        }

                        pool.amount0D = bigIntToDecimalStr(pool.amount0, pool.token0Decimals);
                        pool.amount1D = bigIntToDecimalStr(pool.amount1, pool.token1Decimals);
                        [pool.batchBlockMinimumTick, pool.batchBlockMaximumTick] = batchBlockTick.get(pool.id);
                        pool.collectedFeesToken0 += collectedFee0;
                        pool.collectedFeesToken1 += collectedFee1;
                        pool.collectedFeesUSD = await pairRecordStore.getPriceForAmount(token0.id, collectedFee0) + await pairRecordStore.getPriceForAmount(token1.id, collectedFee1);
                        pool.price0 = await pairRecordStore.getPrice(token0.id);
                        pool.price1 = await pairRecordStore.getPrice(token1.id);
                        pool.currentTick = event.tick;
                        pool.volumeToken0 += event.amount0;
                        pool.volumeToken1 += event.amount1;
                        pool.volumeToken0D = bigIntToDecimalStr(pool.volumeToken0, token0.decimals);
                        pool.volumeToken1D = bigIntToDecimalStr(pool.volumeToken1, token1.decimals);
                        pool.timestamp = BigInt(log.block.timestamp);
                        pool.blockNumber = BigInt(log.block.height);
                        pool.liquidity = event.liquidity;
                        pool.sqrtPriceX96 = event.sqrtPriceX64;
                        pool.volumeUSD += await pairRecordStore.getPriceForAmount(token0.id, pool.volumeToken0) + await pairRecordStore.getPriceForAmount(token1.id, pool.volumeToken1);
                        pool.tvlUSD = await pairRecordStore.getPriceForAmount(token0.id, pool.amount0) + await pairRecordStore.getPriceForAmount(token1.id, pool.amount1);

                        await managerStore.addFeeUSD(pool.fee);
                        await managerStore.addVolumeUSD(pool.volumeUSD);
                        await managerStore.incSwapCount();
                        await tokenStore.save(token);
                        await poolStore.save(pool);
                    } else {
                        // pairRecordStore.withPoolFetch(event.poolState, new Date(log.block.timestamp), event.sqrtPriceX64);
                    }
                } catch (_) { }
            }
        }
    }

    await walletStore.flush();
    await tokenStore.flush();
    await poolStore.flush();
    await positionStore.flush();
    await managerStore.flush();
    await swapRecordStore.flush();
    await liquidityRecordStore.flush();
})