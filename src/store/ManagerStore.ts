import { Store } from "@subsquid/typeorm-store";
import { Manager, PoolManager, Position } from "../model";
import { zeroToNull } from "../utility";

export class ManagerStore {
    private manager: Manager | undefined;
    private poolManager: PoolManager | undefined;
    private readonly raydiumCLMMAddress: string;
    private poolManagerChanged: boolean = false;
    private managerChanged: boolean = false;

    private readonly store: Store;
    constructor(store: Store, raydiumCLMMAddress: string) {
        this.store = store;
        this.raydiumCLMMAddress = raydiumCLMMAddress;
    }

    async getManager(): Promise<Manager> {

        if (this.manager) return this.manager;

        let manager = await this.store.findOneBy(Manager, { id: this.raydiumCLMMAddress });

        if (manager) {
            this.manager = manager;
            return manager;
        }

        const newManager = new Manager({
            id: this.raydiumCLMMAddress,
            managerAddress: this.raydiumCLMMAddress,
            chainId: 0,
        })

        await this.store.upsert(newManager);

        this.manager = newManager;
        return newManager
    }

    async getPoolManager(): Promise<PoolManager> {
        if (this.poolManager) return this.poolManager;

        let poolManager = await this.store.findOneBy(PoolManager, { id: this.raydiumCLMMAddress });

        if (poolManager) {
            this.poolManager = poolManager;
            return poolManager;
        }

        const newPoolManager = new PoolManager({
            id: this.raydiumCLMMAddress,
            poolCount: 0,
            swapCount: 0n,
            totalVolumeUSD: 0,
            totalFeesUSD: 0,
            poolManagerAddress: this.raydiumCLMMAddress,
            chainId: 0
        })

        await this.store.upsert(newPoolManager);

        this.poolManager = newPoolManager;
        return newPoolManager
    }

    async incSwapCount(): Promise<bigint> {
        await this.getPoolManager();
        this.poolManager!.swapCount += 1n;
        this.poolManagerChanged = true;
        return this.poolManager!.swapCount;
    }

    async incPoolCount(): Promise<number> {
        await this.getPoolManager();
        this.poolManager!.poolCount += 1;
        this.poolManagerChanged = true;
        return this.poolManager!.poolCount;
    }

    async addVolumeUSD(volume: number | undefined | null): Promise<number> {
        await this.getPoolManager();
        this.poolManager!.totalVolumeUSD = zeroToNull(this.poolManager!.totalVolumeUSD ?? 0 + (volume ?? 0));
        this.poolManagerChanged = true;
        return this.poolManager!.poolCount;
    }

    async addFeeUSD(fee: number | undefined | null): Promise<number> {
        await this.getPoolManager();
        this.poolManager!.totalFeesUSD = zeroToNull(this.poolManager!.totalFeesUSD ?? 0 + (fee ?? 0));
        this.poolManagerChanged = true;
        return this.poolManager!.poolCount;
    }

    async addPosition(position: Position): Promise<void> {
        await this.getManager()
        if (!this.manager!.positions) this.manager!.positions = []
        this.manager?.positions.push(position);
        this.managerChanged = true;
    }

    async flush(): Promise<void> {
        if (this.manager && this.managerChanged) {
            await this.store.upsert(this.manager);
            this.managerChanged = false;
        }
        if (this.poolManager && this.poolManagerChanged) {
            await this.store.upsert(this.poolManager);
            this.poolManagerChanged = false;
        }
    }
}