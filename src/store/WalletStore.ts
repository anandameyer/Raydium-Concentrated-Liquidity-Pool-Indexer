import { Store } from "@subsquid/typeorm-store";
import { Wallet } from "../model";

export class WalletStore {
    private temps: Record<string, Wallet> = {};
    private readonly store: Store;
    constructor(store: Store) {
        this.store = store;
    }

    async ensure(id: string): Promise<Wallet> {
        let wallet: Wallet | undefined = this.temps[id];
        if (wallet) return wallet;
        wallet = await this.store.findOneBy(Wallet, { id });
        if (wallet) {
            this.temps[id] = wallet;
            return wallet;
        }

        const newWallet = new Wallet({
            id: id,
            walletAddress: id,
            chainId: 0
        });

        this.temps[id] = newWallet;
        return newWallet;
    }

    async save(wallet: Wallet): Promise<void> {
        this.temps[wallet.id] = wallet;
    }

    async flush(): Promise<void> {
        await this.store.upsert(Object.values(this.temps));
        this.temps = {};
    }
}