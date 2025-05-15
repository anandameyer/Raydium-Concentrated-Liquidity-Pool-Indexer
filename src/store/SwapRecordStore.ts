import { Store } from "@subsquid/typeorm-store";
import { SwapEvent } from "../abi/generated/amm_v3/types";
import { Pool, PoolDayData, PoolHourData, SwapReccord, Token, TokenDayData, TokenHourData, Wallet } from "../model";
import { divideBigIntToFloat, multiplyBigIntByFloat } from "../utility";
import { PairRecordStore } from "./PairRecordStore";

interface Block {
    timestamp: number,
    height: number,
}

export class SwapRecordStore {
    private readonly store: Store;
    private readonly pairRecordStore: PairRecordStore;
    private tokenHours: Record<string, TokenHourData> = {};
    private tokenDays: Record<string, TokenDayData> = {};
    private poolHours: Record<string, PoolHourData> = {};
    private poolDays: Record<string, PoolDayData> = {};
    private swapRecords: SwapReccord[] = [];

    constructor(store: Store, pairRecordStore: PairRecordStore) {
        this.store = store;
        this.pairRecordStore = pairRecordStore;
    }

    private async getTokenHour(id: string): Promise<TokenHourData | undefined> {
        let data: TokenHourData | undefined = this.tokenHours[id]
        if (data) return data;
        data = await this.store.findOneBy(TokenHourData, { id });
        if (data) this.tokenHours[data.id] = data;
        return data;
    }

    private async getTokenDay(id: string): Promise<TokenDayData | undefined> {
        let data: TokenDayData | undefined = this.tokenDays[id]
        if (data) return data;
        data = await this.store.findOneBy(TokenDayData, { id });
        if (data) this.tokenDays[data.id] = data;
        return data;
    }

    private async getPoolHour(id: string): Promise<PoolHourData | undefined> {
        let data: PoolHourData | undefined = this.poolHours[id]
        if (data) return data;
        data = await this.store.findOneBy(PoolHourData, { id });
        if (data) this.poolHours[data.id] = data;
        return data;
    }

    private async getPoolDay(id: string): Promise<PoolDayData | undefined> {
        let data: PoolDayData | undefined = this.poolDays[id]
        if (data) return data;
        data = await this.store.findOneBy(PoolDayData, { id });
        if (data) this.poolDays[id] = data;
        return data;
    }

    async record(recordId: string, signature: string, pool: Pool, token0: Token, token1: Token, sender: Wallet, event: SwapEvent, block: Block): Promise<Token> {
        const timestamp = new Date(block.timestamp * 1000);
        const startOfDay = new Date(block.timestamp * 1000);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfHour = new Date(block.timestamp * 1000);
        startOfHour.setMinutes(0, 0, 0);


        this.swapRecords.push(new SwapReccord({
            id: recordId,
            poolId: pool.id,
            poolEntityId: pool.id,
            poolEntity: pool,
            amount0: event.amount0,
            amount1: event.amount1,
            fee: pool.fee,
            liquidity: event.liquidity,
            senderId: sender.id,
            sender: sender,
            sqrtPriceX96: event.sqrtPriceX64,
            tick: event.tick,
            hash: signature,
            txAtTimestamp: BigInt(block.timestamp),
            txAtBlockNumber: BigInt(block.height)
        }));

        const token = event.zeroForOne ? token1 : token0;
        token.swapCount += 1n;
        const tokenHourId = `${token.id}-${startOfDay.getTime() + startOfHour.getTime()}`

        const fetchedPrice = await this.pairRecordStore.getPrice(token.id);

        let tokenHour = await this.getTokenHour(tokenHourId);
        if (!tokenHour) {
            tokenHour = new TokenHourData({
                id: tokenHourId,
                date: timestamp,
                tokenId: token.id,
                token: token,
                swapCount: 1n,
                open: fetchedPrice,
                high: fetchedPrice,
                low: fetchedPrice,
                close: fetchedPrice,
                chainId: 0,
            });

        } else {
            tokenHour.swapCount += 1n;
            if (fetchedPrice > tokenHour.high) tokenHour.high = fetchedPrice;
            if (fetchedPrice < tokenHour.low) tokenHour.low = fetchedPrice;
            tokenHour.close = fetchedPrice;
        }
        this.tokenHours[tokenHourId] = tokenHour;

        const tokenDayId = `${token.id}-${startOfDay.getTime()}`
        let tokenDay = await this.getTokenDay(tokenDayId);
        if (!tokenDay) {
            tokenDay = new TokenDayData({
                id: tokenDayId,
                date: timestamp,
                tokenId: token.id,
                token: token,
                swapCount: 1n,
                open: fetchedPrice,
                high: fetchedPrice,
                low: fetchedPrice,
                close: fetchedPrice,
                chainId: 0
            });

        } else {
            tokenDay.swapCount += 1n;
            if (fetchedPrice > tokenDay.high) tokenDay.high = fetchedPrice;
            if (fetchedPrice < tokenDay.low) tokenDay.low = fetchedPrice;
            tokenDay.close = fetchedPrice;
        }
        this.tokenDays[tokenDayId] = tokenDay;


        const collectedFee0 = multiplyBigIntByFloat(event.amount0, pool.fee / 1000);
        const collectedFee1 = multiplyBigIntByFloat(event.amount0, pool.fee / 1000);

        const poolHourId = `${pool.id}-${startOfDay.getTime()}-${startOfHour.getTime()}`;
        let poolHour = await this.getPoolHour(poolHourId);

        if (!poolHour) {
            poolHour = new PoolHourData({
                id: poolHourId,
                date: timestamp,
                poolId: pool.id,
                pool: pool,
                liquidity: event.liquidity,
                sqrtPrice: event.sqrtPriceX64,
                tick: event.tick,
                volumeToken0: event.amount0,
                volumeToken0D: '0',
                volumeToken1: event.amount1,
                volumeToken1D: '0',
                volumeUSD: Number(multiplyBigIntByFloat(event.amount0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(event.amount1, await this.pairRecordStore.getPrice(token1.id), 6)),
                volumePercentageChange: 0,
                collectedFeesToken0: collectedFee0,
                collectedFeesToken1: collectedFee1,
                collectedFeesUSD: Number(multiplyBigIntByFloat(collectedFee0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(collectedFee1, await this.pairRecordStore.getPrice(token1.id), 6)),
                swapCount: 1n,
                open: fetchedPrice,
                high: fetchedPrice,
                low: fetchedPrice,
                close: fetchedPrice,
                chainId: 0
            });
        } else {
            poolHour.liquidity += event.liquidity;
            poolHour.sqrtPrice = event.sqrtPriceX64;
            poolHour.tick = event.tick;
            poolHour.volumeUSD += Number(multiplyBigIntByFloat(event.amount0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(event.amount1, await this.pairRecordStore.getPrice(token1.id), 6));
            poolHour.volumePercentageChange = divideBigIntToFloat((pool.volumeToken0 + pool.volumeToken1), (event.amount0 + event.amount1));
            poolHour.volumeToken0 += event.amount0;
            poolHour.volumeToken1 += event.amount1;
            poolHour.collectedFeesToken0 += collectedFee0;
            poolHour.collectedFeesToken1 += collectedFee1;
            poolHour.collectedFeesUSD += Number(multiplyBigIntByFloat(collectedFee0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(collectedFee1, await this.pairRecordStore.getPrice(token1.id), 6));
            poolHour.swapCount += 1n;
            poolHour.close = fetchedPrice;
            if (fetchedPrice > poolHour.high) poolHour.high = fetchedPrice;
            if (fetchedPrice < poolHour.low) poolHour.low = fetchedPrice;
        }
        this.poolHours[poolHourId] = poolHour;

        const poolDayId = `${pool.id}-${startOfDay.getTime()}`;
        let poolDay = await this.getPoolDay(poolDayId);
        if (!poolDay) {
            poolDay = new PoolDayData({
                id: poolDayId,
                date: timestamp,
                poolId: pool.id,
                pool: pool,
                liquidity: event.liquidity,
                sqrtPrice: event.sqrtPriceX64,
                tick: event.tick,
                volumeToken0: event.amount0,
                volumeToken0D: '0',
                volumeToken1: event.amount1,
                volumeToken1D: '0',
                volumeUSD: Number(multiplyBigIntByFloat(event.amount0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(event.amount1, await this.pairRecordStore.getPrice(token1.id), 6)),
                volumePercentageChange: 0,
                collectedFeesToken0: collectedFee0,
                collectedFeesToken1: collectedFee1,
                collectedFeesUSD: Number(multiplyBigIntByFloat(collectedFee0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(collectedFee1, await this.pairRecordStore.getPrice(token1.id), 6)),
                swapCount: 1n,
                open: fetchedPrice,
                high: fetchedPrice,
                low: fetchedPrice,
                close: fetchedPrice,
                chainId: 0,
            });
        } else {
            poolDay.liquidity += event.liquidity;
            poolDay.sqrtPrice = event.sqrtPriceX64;
            poolDay.tick = event.tick;
            poolDay.volumeUSD += Number(multiplyBigIntByFloat(event.amount0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(event.amount1, await this.pairRecordStore.getPrice(token1.id), 6));
            poolDay.volumePercentageChange = divideBigIntToFloat((pool.volumeToken0 + pool.volumeToken1), (event.amount0 + event.amount1));
            poolDay.volumeToken0 += event.amount0;
            poolDay.volumeToken1 += event.amount1;
            poolDay.collectedFeesToken0 += collectedFee0;
            poolDay.collectedFeesToken1 += collectedFee1;
            poolDay.collectedFeesUSD += Number(multiplyBigIntByFloat(collectedFee0, await this.pairRecordStore.getPrice(token0.id), 6) + multiplyBigIntByFloat(collectedFee1, await this.pairRecordStore.getPrice(token1.id), 6));
            poolDay.swapCount += 1n;
            if (fetchedPrice > poolDay.high) poolDay.high = fetchedPrice;
            if (fetchedPrice < poolDay.low) poolDay.low = fetchedPrice;
            poolDay.close = fetchedPrice;
        }
        this.poolDays[poolDayId] = poolDay;

        return token;
    }


    async flush(): Promise<void> {
        await this.store.upsert(Object.values(this.tokenHours));
        await this.store.upsert(Object.values(this.tokenDays));
        await this.store.upsert(Object.values(this.poolHours));
        await this.store.upsert(Object.values(this.poolDays));
        await this.store.upsert(this.swapRecords);
        this.swapRecords = [];
    }
}