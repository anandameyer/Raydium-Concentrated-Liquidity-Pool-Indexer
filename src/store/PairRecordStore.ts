import { Connection, PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { PoolState } from "../abi/pool";
import { PairRecord, Token } from "../model";
import { TokenStore } from "./TokenStore";

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOL = 'So11111111111111111111111111111111111111112';

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface InsertParam {
    poolId: string
    token0: Token
    token1: Token
    timestamp: Date
    sqrtPriceX96: bigint
}

export function getPriceFromSqrtPriceX96(sqrtPriceX96: bigint | string, decimalsBase: number, decimalsQuote: number): number {
    const sqrtPrice = BigInt(sqrtPriceX96);
    const numerator = sqrtPrice * sqrtPrice;
    const denominator = 2n ** 192n;
    const priceRatio = Number(numerator) / Number(denominator);
    const decimalAdjustment = 10 ** (decimalsBase - decimalsQuote);
    return priceRatio * decimalAdjustment;
}

export class PairRecordStore {
    private readonly store: Store;
    private temps: Record<string, PairRecord> = {};
    private readonly rpcClient: Connection;
    private readonly tokenStore: TokenStore;

    constructor(store: Store, tokenStore: TokenStore, rpcClient: Connection) {
        this.store = store;
        this.rpcClient = rpcClient;
        this.tokenStore = tokenStore;
    }

    private async fetchPool(poolState: string): Promise<PoolState | undefined> {

        await delay(500);
        const configAddress = new PublicKey(poolState);
        const value = await this.rpcClient.getAccountInfo(configAddress);

        if (value) {
            // console.dir(value, { depth: null });
            const config = PoolState.decode(value.data);
            console.dir(config, { depth: null });
            return config
        }
    }

    private async getStablePairByToken1(token: string): Promise<PairRecord | undefined> {
        let pair = Object.values(this.temps).
            sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).
            find(a => a.baseStable && a.token1 === token);

        if (pair) return pair;

        pair = await this.store.findOne(PairRecord, { where: { baseStable: true, token1: token }, order: { timestamp: 'desc' } });
        if (pair) this.temps[pair.id] = pair;
        return pair
    }

    private async getByPoolId(poolId: string): Promise<PairRecord | undefined> {
        let pair = Object.values(this.temps).find(a => a.poolId === poolId);
        if (pair) return pair;
        pair = await this.store.findOneBy(PairRecord, { poolId });
        if (pair) this.temps[pair.id] = pair;
        return pair;
    }

    // async withPoolFetch(poolId: string, timestamp: Date, sqrtPriceX96: bigint) {
    //     let token0: string | undefined = undefined;
    //     let token1: string | undefined = undefined;
    //     const pair = await this.getByPoolId(poolId);
    //     if (pair) {
    //         [token0, token1] = [pair.token0, pair.token1];
    //     } else {
    //         const pool = await this.fetchPool(poolId);
    //         if (pool) [token0, token1] = [pool.tokenMint0, pool.tokenMint1]
    //     }


    //     if (token0 && token1) {
    //         const newPair = new PairRecord({
    //             id: `${token0}-${token1}-${timestamp.getTime()}`,
    //             poolId: poolId,
    //             timestamp: timestamp,
    //             token0: token0,
    //             token1: token1,
    //             baseStable: token0 === USDC || token0 === USDT,
    //             sqrtPriceX96: sqrtPriceX96
    //         });

    //         this.temps[newPair.id] = newPair;
    //         await this.store.upsert(newPair);
    //     }
    // }

    async insert({ poolId, token0, token1, timestamp, sqrtPriceX96 }: InsertParam) {
        const newPair = new PairRecord({
            id: `${token0.id}-${token1.id}-${timestamp.getTime()}`,
            poolId: poolId,
            timestamp: timestamp,
            token0: token0.id,
            token1: token1.id,
            token0Decimals: token0.decimals,
            token1Decimals: token1.decimals,
            baseStable: token0.id === USDC || token0.id === USDT,
            sqrtPriceX96: sqrtPriceX96
        });

        this.temps[newPair.id] = newPair;
        await this.store.upsert(newPair);
    }

    async getPrice(token: string): Promise<number> {

        if (token === USDT || token === USDC) {
            const fetchedToken = await this.tokenStore.ensure(token);
            if (fetchedToken) fetchedToken.price = 1.0;
            return 1.0
        };

        const stableBackup = await this.getStablePairByToken1(token);
        if (stableBackup) {
            const price = getPriceFromSqrtPriceX96(stableBackup.sqrtPriceX96, stableBackup.token0Decimals, stableBackup.token1Decimals);
            const fetchedToken = await this.tokenStore.ensure(token);
            if (fetchedToken) fetchedToken.price = price;
            return price;
        }

        const checked: Set<string> = new Set();

        const pairs1 = await this.store.find(PairRecord, { where: { token1: token }, order: { timestamp: 'desc' } });
        if (pairs1) {
            for (let pair of pairs1) {
                if (checked.has(pair.token0)) {
                    continue;
                }

                const stablePair = await this.getStablePairByToken1(pair.token1);
                if (stablePair) {
                    const price = getPriceFromSqrtPriceX96(pair.sqrtPriceX96, pair.token0Decimals, pair.token1Decimals) * getPriceFromSqrtPriceX96(stablePair.sqrtPriceX96, stablePair.token0Decimals, stablePair.token1Decimals);
                    const fetchedToken = await this.tokenStore.ensure(token);
                    if (fetchedToken) fetchedToken.price = price;
                    return price;
                }

                checked.add(pair.token0)
            }
        }
        return 0.0;
    }
}