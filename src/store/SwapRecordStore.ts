import { Store } from "@subsquid/typeorm-store";
import { SwapEvent } from "../abi/generated/amm_v3/types";
import { Pool, SwapReccord, Token, TokenDayData, TokenHourData, Wallet } from "../model";
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

    private async getTokenHourBefore(token: string, timestamp: number): Promise<TokenHourData | undefined> {
        const startOfDay = new Date(timestamp);
        startOfDay.setHours(0, 0, 0, 0);
        const hourBefore = new Date(timestamp);
        hourBefore.setHours(hourBefore.getHours() - 1, 0, 0, 0);

        const id = `${token}-${startOfDay.getTime() + hourBefore.getTime()}`;

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


    private async getTokenDayBefore(token: string, timestamp: number): Promise<TokenDayData | undefined> {
        const dayBefore = new Date(timestamp);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(0, 0, 0, 0);

        const id = `${token}-${dayBefore.getTime()}`;

        let data: TokenDayData | undefined = this.tokenDays[id]
        if (data) return data;
        data = await this.store.findOneBy(TokenDayData, { id });
        if (data) this.tokenDays[data.id] = data;
        return data;
    }

    async record(recordId: string, signature: string, pool: Pool, token0: Token, token1: Token, sender: Wallet, event: SwapEvent, block: Block): Promise<Token> {
        const startOfDay = new Date(block.timestamp);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfHour = new Date(block.timestamp);
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
                date: new Date(block.timestamp),
                tokenId: token.id,
                token: token,
                swapCount: 1n,
                open: fetchedPrice,
                high: fetchedPrice,
                low: fetchedPrice,
                close: 0,
                chainId: 0,
            });

            const hourBefore = await this.getTokenHourBefore(token.id, block.timestamp);
            if (hourBefore) {
                hourBefore.close = fetchedPrice;
                this.tokenHours[hourBefore.id] = hourBefore;
            }
        } else {
            tokenHour.swapCount += 1n;
            if (fetchedPrice > tokenHour.high) tokenHour.high = fetchedPrice;
            if (fetchedPrice < tokenHour.low) tokenHour.low = fetchedPrice;
        }

        this.tokenHours[tokenHourId] = tokenHour;

        const tokenDayId = `${token.id}-${startOfDay.getTime()}`
        let tokenDay = await this.getTokenDay(tokenDayId);
        if (!tokenDay) {
            tokenDay = new TokenDayData({
                id: tokenDayId,
                date: new Date(block.timestamp),
                tokenId: token.id,
                token: token,
                swapCount: 1n,
                open: fetchedPrice,
                high: fetchedPrice,
                low: fetchedPrice,
                close: fetchedPrice,
                chainId: 0
            });
            const dayBefore = await this.getTokenDayBefore(token.id, block.timestamp);
            if (dayBefore) {
                dayBefore.close = fetchedPrice;
                this.tokenDays[dayBefore.id] = dayBefore;
            }

        } else {
            tokenDay.swapCount += 1n;
            if (fetchedPrice > tokenDay.high) tokenDay.high = fetchedPrice;
            if (fetchedPrice < tokenDay.low) tokenDay.low = fetchedPrice;
        }
        this.tokenDays[tokenDayId] = tokenDay;

        return token;
    }


    async flush(): Promise<void> {
        await this.store.upsert(Object.values(this.tokenHours));
        await this.store.upsert(Object.values(this.tokenDays));
        await this.store.upsert(this.swapRecords);
        this.swapRecords = [];
    }
}