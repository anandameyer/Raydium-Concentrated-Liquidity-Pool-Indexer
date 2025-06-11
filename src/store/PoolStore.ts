import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { ammConfigDecoder } from "../abi/amm_config";
import { AMMConfig, Pool } from "../model";

export class PoolStore {
    private temps?: Map<string, Pool>;
    private ammConfigs?: Map<string, AMMConfig>;
    private readonly store: Store;
    private readonly rpcClient: Connection;
    private readonly metaplex: Metaplex;
    constructor(store: Store, rpcClient: Connection, poolStore?: Map<string, Pool>, ammStore?: Map<string, AMMConfig>) {
        this.store = store;
        this.rpcClient = rpcClient;
        this.metaplex = Metaplex.make(rpcClient);
        if (poolStore) {
            this.temps = poolStore;
        } else {
            this.temps = new Map();
        }
        if (ammStore) {
            this.ammConfigs = ammStore;
        } else {
            this.ammConfigs = new Map();
        }
    }

    async get(id: string): Promise<Pool | undefined> {
        let pool: Pool | undefined = this.temps!.get(id);
        if (pool) return pool;
        pool = await this.store.findOneBy(Pool, { id });
        if (pool) {
            this.temps!.set(id, pool)
            return pool;
        }
    }

    async fetchAMMConfig(ammConfig: string): Promise<AMMConfig> {
        let result: AMMConfig | undefined = this.ammConfigs!.get(ammConfig)
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
            this.ammConfigs!.set(ammConfig, result);
            return result;
        }
        return new AMMConfig();
    }

    async save(pool: Pool): Promise<void> {
        this.temps!.set(pool.id, pool);
    }

    async flush(): Promise<void> {
        if (this.temps) await this.store.upsert([...this.temps.values()]);
        if (this.ammConfigs) await this.store.upsert([...this.ammConfigs.values()]);
        this.temps = undefined;
        this.ammConfigs = undefined;
        // this.temps = {};
        // this.ammConfigs = {};
    }
}