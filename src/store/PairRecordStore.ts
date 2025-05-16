import { Connection } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { PairRecord, Token } from "../model";
import { TokenStore } from "./TokenStore";

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const USDTet = 'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1';
const USDCet = 'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM';
const PYUSD = '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo';
const STABLES = [USDC, USDT, USDTet, USDCet, PYUSD];
const SOL = 'So11111111111111111111111111111111111111112';

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface InsertParam {
    poolId: string
    token0: Token
    token1: Token
    timestamp: Date
    sqrtPriceX64: bigint
}

export function getRatioFromSqrtPriceX64(sqrtPriceX64: bigint | string, decimalsBase: number, decimalsQuote: number): number {
    const sqrtPrice = BigInt(sqrtPriceX64);
    const numerator = sqrtPrice * sqrtPrice;
    const denominator = 2n ** 128n;
    const priceRatio = Number(numerator) / Number(denominator);
    const decimalAdjustment = 10 ** (decimalsBase - decimalsQuote);
    return priceRatio * decimalAdjustment;
}

export function getPriceFromSqrtPriceX64WithStableCoin(sqrtPriceX64: bigint | string, decimalBase: number, decimalsQuote: number): number {
    const ratio = getRatioFromSqrtPriceX64(sqrtPriceX64, decimalBase, decimalsQuote);
    return 1 / ratio;
}

function invertSqrtPriceX64(sqrtPriceX64: bigint): bigint {
    if (sqrtPriceX64 === 0n) throw new Error("Division by zero");
    const Q128 = 1n << 128n;
    return (Q128 + sqrtPriceX64 / 2n) / sqrtPriceX64;;
}


function calculateTotalPrice(pricePerToken: number, tokenAmount: bigint, tokenDecimals: number): number {
    const priceScaled = Math.round(pricePerToken * 1e18);
    const amountScaled = tokenAmount * BigInt(priceScaled);
    const divisor = 10n ** BigInt(tokenDecimals) * BigInt(1e18);
    return Number(amountScaled) / Number(divisor);
}


function isStable(token: string): boolean {
    return STABLES.indexOf(token) > -1;
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

    // private async fetchPool(poolState: string): Promise<PoolState | undefined> {

    //     await delay(500);
    //     const configAddress = new PublicKey(poolState);
    //     const value = await this.rpcClient.getAccountInfo(configAddress);

    //     if (value) {
    //         // console.dir(value, { depth: null });
    //         const config = PoolState.decode(value.data);
    //         console.dir(config, { depth: null });
    //         return config
    //     }
    // }

    private async getStablePairByToken1(token: string): Promise<PairRecord | undefined> {
        let pair = Object.values(this.temps).
            sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).
            find(a => a.baseStable && a.token1 === token);

        if (pair) return pair;

        pair = await this.store.findOne(PairRecord, { where: { baseStable: true, token1: token }, order: { timestamp: 'desc' } });
        if (pair) this.temps[pair.id] = pair;
        return pair
    }

    // private async getByPoolId(poolId: string): Promise<PairRecord | undefined> {
    //     let pair = Object.values(this.temps).find(a => a.poolId === poolId);
    //     if (pair) return pair;
    //     pair = await this.store.findOneBy(PairRecord, { poolId });
    //     if (pair) this.temps[pair.id] = pair;
    //     return pair;
    // }

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

    async insert({ poolId, token0, token1, timestamp, sqrtPriceX64 }: InsertParam) {
        // we make stable token to be base token regardless pool creation.
        if (isStable(token1.id)) {
            [token0, token1, sqrtPriceX64] = [token1, token0, invertSqrtPriceX64(sqrtPriceX64)]
        }

        const newPair = new PairRecord({
            id: `${poolId}-${timestamp.getTime()}`,
            poolId: poolId,
            timestamp: timestamp,
            token0: token0.id,
            token1: token1.id,
            token0Decimals: token0.decimals,
            token1Decimals: token1.decimals,
            baseStable: isStable(token0.id),
            sqrtPriceX64: sqrtPriceX64
        });

        this.temps[newPair.id] = newPair;
        await this.store.upsert(newPair);
    }

    private async calculatePrice(token: string): Promise<number> {
        // if token is stable we return 1 assumed stable token will stable around $1.
        if (isStable(token)) {
            return 1.0
        };

        // const findTarget = token === 'FBBwyEu66FBK7Pm1HWWrLY45g2zrscMzuF3TPvbH52hB';

        // if token paired with stable token we return calculated price based on sqrtPrice.
        const stableBackup = await this.getStablePairByToken1(token);
        if (stableBackup) {
            const price = getPriceFromSqrtPriceX64WithStableCoin(stableBackup.sqrtPriceX64, stableBackup.token0Decimals, stableBackup.token1Decimals);
            // if (findTarget) console.dir(["phase 2", stableBackup, price]);
            return price;
        }

        // since we save pair as record, we need to make sure we not do redundant check.
        const checked: Set<string> = new Set();

        // look on token1 on records that match our target, ordered by latest timestamp.
        const pairs1 = await this.store.find(PairRecord, { where: { token1: token }, order: { timestamp: 'desc' } });
        if (pairs1) { // we loop all the list to search for token0 as stable.
            for (let pair of pairs1) {
                if (checked.has(pair.token0)) {
                    continue;
                }

                const stablePair = await this.getStablePairByToken1(pair.token1);
                if (stablePair) { // if we found the token, derive price from 2 pool, we do multiply calculations eg: 0.5 multiplied by 0.5 will yield 0.25;
                    const price = getPriceFromSqrtPriceX64WithStableCoin(pair.sqrtPriceX64, pair.token0Decimals, pair.token1Decimals) * getPriceFromSqrtPriceX64WithStableCoin(stablePair.sqrtPriceX64, stablePair.token0Decimals, stablePair.token1Decimals);
                    // if (findTarget) console.dir(["phase 3", stablePair, stableBackup, price]);
                    return price;
                }

                // record checked pair as token0.
                checked.add(pair.token0)
            }
        }
        return 0.0;
    }

    async getPrice(token: string): Promise<number> {
        const price = await this.calculatePrice(token)
        if (price > 0) {
            const fetchedToken = await this.tokenStore.ensure(token);
            fetchedToken.price = price;
            await this.tokenStore.save(fetchedToken);
        }
        return price;
    }

    async getPriceForAmount(token: string, amount: bigint): Promise<number> {
        const price = await this.calculatePrice(token);
        const fetchedToken = await this.tokenStore.ensure(token);
        if (price > 0) {
            fetchedToken.price = price;
            await this.tokenStore.save(fetchedToken);
        }
        return calculateTotalPrice(price, amount, fetchedToken.decimals);
    }
}