import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { Token } from "../model";

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

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const USDTet = 'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1';
const USDCet = 'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM';
const PYUSD = '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo';
const STABLES = [USDC, USDT, USDTet, USDCet, PYUSD];
const SOL = 'So11111111111111111111111111111111111111112';

export function calculateTotalPrice(pricePerToken: number, tokenAmount: bigint, tokenDecimals: number): number {
    const priceScaled = Math.round(pricePerToken * 1e18);
    const amountScaled = tokenAmount * BigInt(priceScaled);
    const divisor = 10n ** BigInt(tokenDecimals) * BigInt(1e18);
    return Number(amountScaled) / Number(divisor);
}


function isStable(token: string): boolean {
    return STABLES.indexOf(token) > -1;
}

export class TokenStore {
    private readonly temps: Map<string, Token> = new Map();
    private readonly store: Store;
    private readonly rpcClient: Connection;
    private readonly metaplex: Metaplex;
    private readonly updated: Set<string> = new Set();
    constructor(store: Store, rpcClient: Connection, metaplex: Metaplex) {
        this.store = store;
        this.rpcClient = rpcClient;
        this.metaplex = metaplex;
    }

    private async fetchToken(mintAddress: string): Promise<Token> {
        const address = new PublicKey(mintAddress);
        const token = await this.metaplex.nfts().findByMint({ mintAddress: address });
        return new Token({
            id: mintAddress,
            name: token.name ?? '',
            symbol: token.symbol ?? '',
            decimals: token.mint.decimals ?? 9,
            price: isStable(mintAddress) ? 1 : 0,
            poolCount: 0,
            swapCount: 0n,
            chainId: 0,
            tokenAddress: mintAddress,
            blockNumber: 0n,
            timestamp: 0n,
        })
    };

    async ensure(id: string): Promise<Token> {
        let token: Token | undefined = this.temps.get(id);
        if (token) return token;
        token = await this.store.findOneBy(Token, { id });
        if (token) {
            this.temps.set(id, token);
            return token;
        }
        token = await this.fetchToken(id);
        this.temps.set(id, token);
        this.updated.add(id);
        return token;
    }

    async updatePrice(token0Id: string, token1Id: string, sqrtPriceX64: bigint): Promise<[token0: Token, token1: Token]> {
        const token0 = await this.ensure(token0Id);
        const token1 = await this.ensure(token1Id);
        if (isStable(token0Id)) {
            if (token0.price != 1) token0.price = 1;
            token1.price = getPriceFromSqrtPriceX64WithStableCoin(sqrtPriceX64, token0.decimals, token1.decimals);
        }

        if (isStable(token1Id)) {
            if (token1.price != 1) token1.price = 1;
            token0.price = getPriceFromSqrtPriceX64WithStableCoin(invertSqrtPriceX64(sqrtPriceX64), token0.decimals, token1.decimals);
        }

        this.temps.set(token0Id, token0);
        this.temps.set(token1Id, token1);
        this.updated.add(token0Id);
        this.updated.add(token1Id);
        return [token0, token1];
    }

    async save(...tokens: Token[]): Promise<void> {
        for (let token of tokens) {
            this.temps.set(token.id, token);
            this.updated.add(token.id);
        }
    }

    async flush(): Promise<void> {
        const updated = [...this.updated].reduce((a, b) => {
            if (this.temps.has(b)) a.push(this.temps.get(b)!)
            return a;
        }, [] as Token[]);

        this.store.upsert(updated);
        this.temps.clear();
        this.updated.clear();
    }
}