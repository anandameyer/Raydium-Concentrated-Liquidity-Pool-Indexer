import { Store } from "@subsquid/typeorm-store";
import { LiquidityChangeEvent } from "../abi/generated/amm_v3/types";
import { ModifyLiquidityReccord, Pool, Wallet } from "../model";

interface Block {
    timestamp: number;
    height: number;
}

export class LiquidityRecordStore {
    private readonly store: Store;
    private temps: ModifyLiquidityReccord[] = [];

    constructor(store: Store) {
        this.store = store;
    }

    async record(id: string, hash: string, pool: Pool, sender: Wallet, event: LiquidityChangeEvent, block: Block): Promise<void> {
        this.temps.push(new ModifyLiquidityReccord({
            id: id,
            poolId: pool.id,
            salt: '',
            poolEntityId: pool.id,
            poolEntity: pool,
            liquidityDelta: event.liquidityBefore - event.liquidityAfter,
            senderId: sender.id,
            sender: sender,
            tickLower: event.tickLower,
            tickUpper: event.tickUpper,
            hash: hash,
            txAtTimestamp: BigInt(block.timestamp),
            txAtBlockNumber: BigInt(block.height)
        }));
    }

    async flush(): Promise<void> {
        await this.store.upsert(this.temps);
        this.temps = [];
    }
}