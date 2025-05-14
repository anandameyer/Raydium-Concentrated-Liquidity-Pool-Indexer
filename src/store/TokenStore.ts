import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { Token } from "../model";

export class TokenStore {
    private temps: Record<string, Token> = {};
    private readonly store: Store;
    private readonly rpcClient: Connection;
    private readonly metaplex: Metaplex;
    constructor(store: Store, rpcClient: Connection) {
        this.store = store;
        this.rpcClient = rpcClient;
        this.metaplex = Metaplex.make(rpcClient);
    }

    private async fetchToken(mintAddress: string): Promise<Token> {
        const address = new PublicKey(mintAddress);

        const metadataAccount = this.metaplex
            .nfts()
            .pdas()
            .metadata({ mint: address });

        const metadataAccountInfo = await this.rpcClient.getAccountInfo(metadataAccount);

        if (metadataAccountInfo) {
            const token = await this.metaplex.nfts().findByMint({ mintAddress: address });
            return new Token({
                id: mintAddress,
                name: token.name ?? '',
                symbol: token.symbol ?? '',
                decimals: token.mint.decimals ?? 0,
                price: 0,
                poolCount: 0,
                swapCount: 0n,
                chainId: 0,
                tokenAddress: mintAddress,
                blockNumber: 0n,
                timestamp: 0n,
                // tokenDayDatas: [],
                // tokenHourDatas: []
            })
        }

        return new Token({
            id: mintAddress,
            name: '',
            symbol: '',
            decimals: 0,
            price: 0,
            poolCount: 0,
            swapCount: 0n,
            chainId: 0,
            tokenAddress: mintAddress,
            blockNumber: 0n,
            timestamp: 0n,
            // tokenDayDatas: [],
            // tokenHourDatas: []
        });
    }

    async ensure(id: string): Promise<Token> {
        let token: Token | undefined = this.temps[id];
        if (token) return token;
        token = await this.store.findOneBy(Token, { id });
        if (token) {
            this.temps[id] = token;
            return token;
        }
        token = await this.fetchToken(id);
        this.temps[id] = token;
        return token;
    }

    async save(...tokens: Token[]): Promise<void> {
        for (let token of tokens)
            this.temps[token.id] = token;
    }

    async flush(): Promise<void> {
        this.store.upsert(Object.values(this.temps));
        this.temps = {};
    }
}