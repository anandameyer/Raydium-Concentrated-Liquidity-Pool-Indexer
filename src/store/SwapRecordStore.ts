import { Store } from "@subsquid/typeorm-store";
import { SwapEvent } from "../abi/generated/amm_v3/types";
import { Pool, PoolDayData, PoolHourData, SwapReccord, Token, TokenDayData, TokenHourData, Wallet } from "../model";
import { bigIntToDecimalStr, divideBigIntToFloat, multiplyBigIntByFloat } from "../utility";
import { calculateTotalPrice } from "./TokenStore";

interface Block {
    timestamp: number,
    height: number,
}

export class SwapRecordStore {
    private readonly store: Store;
    private tokenHours: Record<string, TokenHourData> = {};
    private tokenDays: Record<string, TokenDayData> = {};
    private poolHours: Record<string, PoolHourData> = {};
    private poolDays: Record<string, PoolDayData> = {};
    private swapRecords: SwapReccord[] = [];

    constructor(store: Store) {
        this.store = store;
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

    async record(recordId: string, signature: string, pool: Pool, token0: Token, token1: Token, sender: Wallet, event: SwapEvent, block: Block): Promise<void> {

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

        await this.recordTokenData(token0, timestamp, startOfDay, startOfHour);
        await this.recordTokenData(token1, timestamp, startOfDay, startOfHour);
        await this.recordPoolData(pool, token0, token1, event, timestamp, startOfDay, startOfHour);
    }

    private async recordTokenData(token: Token, timestamp: Date, startOfDay: Date, startOfHour: Date): Promise<void> {
        const tokenHourId = `${token.id}-${startOfHour.getTime()}`

        let tokenHour = await this.getTokenHour(tokenHourId);
        if (!tokenHour) {
            tokenHour = new TokenHourData({
                id: tokenHourId,
                date: timestamp,
                tokenId: token.id,
                token: token,
                swapCount: 1n,
                open: token.price,
                high: token.price,
                low: token.price,
                close: token.price,
                chainId: 0,
            });

        } else {
            tokenHour.swapCount += 1n;
            if (token.price > tokenHour.high) tokenHour.high = token.price;
            if (token.price < tokenHour.low) tokenHour.low = token.price;
            tokenHour.close = token.price;
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
                open: token.price,
                high: token.price,
                low: token.price,
                close: token.price,
                chainId: 0
            });

        } else {
            tokenDay.swapCount += 1n;
            if (token.price > tokenDay.high) tokenDay.high = token.price;
            if (token.price < tokenDay.low) tokenDay.low = token.price;
            tokenDay.close = token.price;
        }

        this.tokenDays[tokenDayId] = tokenDay;
    }

    private async recordPoolData(pool: Pool, token0: Token, token1: Token, event: SwapEvent, timestamp: Date, startOfDay: Date, startOfHour: Date): Promise<void> {
        const startOfHourBefore = new Date(startOfHour.getTime());
        startOfHourBefore.setHours(startOfHour.getHours() - 1, 0, 0, 0);
        const startOfDayBefore = new Date(startOfDay.getTime());
        startOfDayBefore.setDate(startOfDay.getDate() - 1);
        startOfDayBefore.setHours(0, 0, 0, 0);

        const collectedFee0 = event.zeroForOne ? multiplyBigIntByFloat(event.amount0, pool.fee / 10000) : 0n;
        const collectedFee1 = event.zeroForOne ? 0n : multiplyBigIntByFloat(event.amount1, pool.fee / 10000);

        const poolHourId = `${pool.id}-${startOfHour.getTime()}`;
        const poolHourBeforeId = `${pool.id}-${startOfHourBefore.getTime()}`;
        const poolHourBefore = await this.getPoolHour(poolHourBeforeId);
        let poolHourBeforeVolume = 0n;
        if (poolHourBefore) poolHourBeforeVolume = poolHourBefore.volumeToken0 + poolHourBefore.volumeToken1;
        let poolHour = await this.getPoolHour(poolHourId);

        const totalVolumeUSDToken0 = calculateTotalPrice(token0.price, event.amount0, token0.decimals);
        const totalVolumeUSDToken1 = calculateTotalPrice(token1.price, event.amount1, token1.decimals);
        const collectedAmountUSDToken0 = calculateTotalPrice(token0.price, collectedFee0, token0.decimals);
        const collectedAmountUSDToken1 = calculateTotalPrice(token1.price, collectedFee1, token1.decimals);

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
                volumeToken0D: bigIntToDecimalStr(event.amount0, token0.decimals),
                volumeToken1: event.amount1,
                volumeToken1D: bigIntToDecimalStr(event.amount1, token0.decimals),
                volumeUSD: totalVolumeUSDToken0 + totalVolumeUSDToken1,
                volumePercentageChange: divideBigIntToFloat(event.amount0 + event.amount1, poolHourBeforeVolume > 0n ? poolHourBeforeVolume : 1n),
                collectedFeesToken0: collectedFee0,
                collectedFeesToken1: collectedFee1,
                collectedFeesUSD: collectedAmountUSDToken0 + collectedAmountUSDToken1,
                swapCount: 1n,
                open: token1.price,
                high: token1.price,
                low: token1.price,
                close: token1.price,
                chainId: 0
            });
        } else {
            poolHour.liquidity += event.liquidity;
            poolHour.sqrtPrice = event.sqrtPriceX64;
            poolHour.tick = event.tick;
            poolHour.volumeUSD += totalVolumeUSDToken0 + totalVolumeUSDToken1;
            poolHour.volumePercentageChange = divideBigIntToFloat(pool.amount0 + pool.amount1, poolHourBeforeVolume > 0n ? poolHourBeforeVolume : 1n);
            poolHour.volumeToken0 += event.amount0;
            poolHour.volumeToken1 += event.amount1;
            poolHour.volumeToken0D = bigIntToDecimalStr(poolHour.volumeToken0, token0.decimals);
            poolHour.volumeToken1D = bigIntToDecimalStr(poolHour.volumeToken1, token1.decimals);
            poolHour.collectedFeesToken0 += collectedFee0;
            poolHour.collectedFeesToken1 += collectedFee1;
            poolHour.collectedFeesUSD += collectedAmountUSDToken0 + collectedAmountUSDToken1;
            poolHour.swapCount += 1n;
            poolHour.close = token1.price;
            if (token1.price > poolHour.high) poolHour.high = token1.price;
            if (token1.price < poolHour.low) poolHour.low = token1.price;
        }
        this.poolHours[poolHourId] = poolHour;

        const poolDayId = `${pool.id}-${startOfDay.getTime()}`;
        const poolDayBeforeId = `${pool.id}-${startOfDayBefore.getTime()}`;
        let poolDayBefore = await this.getPoolDay(poolDayBeforeId);
        let poolDayBeforeVolume = 0n;
        if (poolDayBefore) poolDayBeforeVolume = poolDayBefore.volumeToken0 + poolDayBefore.volumeToken1;

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
                volumeToken0D: bigIntToDecimalStr(event.amount0, token0.decimals),
                volumeToken1: event.amount1,
                volumeToken1D: bigIntToDecimalStr(event.amount0, token0.decimals),
                volumeUSD: totalVolumeUSDToken0 + totalVolumeUSDToken1,
                volumePercentageChange: divideBigIntToFloat(event.amount0 + event.amount1, poolDayBeforeVolume > 0n ? poolDayBeforeVolume : 1n),
                collectedFeesToken0: collectedFee0,
                collectedFeesToken1: collectedFee1,
                collectedFeesUSD: collectedAmountUSDToken0 + collectedAmountUSDToken1,
                swapCount: 1n,
                open: token1.price,
                high: token1.price,
                low: token1.price,
                close: token1.price,
                chainId: 0,
            });
        } else {
            poolDay.liquidity += event.liquidity;
            poolDay.sqrtPrice = event.sqrtPriceX64;
            poolDay.tick = event.tick;
            poolDay.volumeUSD += totalVolumeUSDToken0 + totalVolumeUSDToken1;
            poolDay.volumePercentageChange = divideBigIntToFloat(pool.amount0 + pool.amount1, poolDayBeforeVolume > 0n ? poolDayBeforeVolume : 1n);
            poolDay.volumeToken0 += event.amount0;
            poolDay.volumeToken1 += event.amount1;
            poolDay.volumeToken0D = bigIntToDecimalStr(poolHour.volumeToken0, token0.decimals);
            poolDay.volumeToken1D = bigIntToDecimalStr(poolHour.volumeToken1, token1.decimals);
            poolDay.collectedFeesToken0 += collectedFee0;
            poolDay.collectedFeesToken1 += collectedFee1;
            poolDay.collectedFeesUSD += collectedAmountUSDToken0 + collectedAmountUSDToken1;
            poolDay.swapCount += 1n;
            if (token1.price > poolDay.high) poolDay.high = token1.price;
            if (token1.price < poolDay.low) poolDay.low = token1.price;
            poolDay.close = token1.price;
        }
        this.poolDays[poolDayId] = poolDay;
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