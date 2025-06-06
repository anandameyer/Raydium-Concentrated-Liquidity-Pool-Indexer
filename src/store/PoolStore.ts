import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { ammConfigDecoder } from "../abi/amm_config";
import { AMMConfig, Pool } from "../model";

export class PoolStore {
    private temps: Record<string, Pool> = {};
    private ammConfigs: Record<string, AMMConfig> = {};
    private readonly store: Store;
    private readonly rpcClient: Connection;
    private readonly metaplex: Metaplex;
    constructor(store: Store, rpcClient: Connection) {
        this.store = store;
        this.rpcClient = rpcClient;
        this.metaplex = Metaplex.make(rpcClient);
    }

    async get(id: string): Promise<Pool | undefined> {
        let pool: Pool | undefined = this.temps[id];
        if (pool) return pool;
        pool = await this.store.findOneBy(Pool, { id });
        if (pool) {
            this.temps[id] = pool;
            return pool;
        }
    }

    async fetchAMMConfig(ammConfig: string): Promise<AMMConfig> {
        let result: AMMConfig | undefined = this.ammConfigs[ammConfig]
        if (result) return result;
        result = await this.store.findOneBy(AMMConfig, { id: ammConfig });
        if (result) return result;
        const configAddress = new PublicKey(ammConfig);
        const value = await this.rpcClient.getAccountInfo(configAddress);

        if (value) {
            const config = ammConfigDecoder.decode(value.data);
            result = new AMMConfig({
                id: ammConfig,
                bump: config.bump,
                index: config.index,
                owner: config.owner.toString(),
                protocolFeeRate: config.protocolFeeRate,
                tradeFeeRate: config.tradeFeeRate,
                tickSpacing: config.tickSpacing,
                fundFeeRate: config.fundFeeRate,
                fundOwner: config.fundOwner.toString()
            });
            this.ammConfigs[ammConfig] = result;
            return result;
        }
        return new AMMConfig();
    }

    async save(pool: Pool): Promise<void> {
        this.temps[pool.id] = pool;
    }

    async flush(): Promise<void> {
        this.store.upsert(Object.values(this.temps));
        this.store.upsert(Object.values(this.ammConfigs));
        this.temps = {};
        this.ammConfigs = {};
    }
}