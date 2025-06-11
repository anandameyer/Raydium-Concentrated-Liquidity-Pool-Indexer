import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { Bundle, Token } from "../model";
import { zeroToNull } from "../utility";

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

export function getPriceFromSqrtPriceX64WithSOlPrice(solPrice: number, sqrtPriceX64: bigint | string, decimalBase: number, decimalsQuote: number): number {
    const ratio = getRatioFromSqrtPriceX64(sqrtPriceX64, decimalBase, decimalsQuote);
    return solPrice / ratio;
}

export function invertSqrtPriceX64(sqrtPriceX64: bigint): bigint {
    if (sqrtPriceX64 === 0n) throw new Error("Division by zero");
    const Q128 = 1n << 128n;
    return (Q128 + sqrtPriceX64 / 2n) / sqrtPriceX64;;
}

export const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const USDTet = 'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1';
const USDCet = 'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM';
const PYUSD = '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo';
const STABLES = [USDC, USDT, USDTet, USDCet, PYUSD];
export const SOL = 'So11111111111111111111111111111111111111112';
export const SOLUSDCPOOLS: Set<string> = new Set([
    '3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv',
    '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj',
    'CYbD9RaToYMtWKA7QZyoLahnHdWq553Vm62Lh6qWtuxq',
    '2QdhepnKRTLjjSqPL1PtKNwqrUkoLee5Gqs8bvZhRdMv',
    'EXHyQxMSttcvLPwjENnXCPZ8GmLjJYHtNBnAkcFeFKMn',
    '5s7njN2X6k3trkibTKX6LJFu4PnybYhCuADP9LD2fhuP',
    '2SjLv6XwViJ17rq21N1y98LbMee1J4DXinP61rk9v2aK',
    'CiSQxEhiS1j7PVHy57LqmjFWL1N7ciYD45Enq5tSyfaN',
    'GqxUEcFw8GbfDPoWU6UG2ypvsM3aw3vZmiN4e1Nbv94G',
    '6MUjnGffYaqcHeqv4nNemUQVNMpJab3W2NV9bfPj576c',
    '2JtkunkYCRbe5YZuGU6kLFmNwN22Ba1pCicHoqW5Eqja',
    'HhRA2S8LrDFi8cWNXhCSXre31RgLkTFMj7bM1FK99CaZ',
    'HSTnyz57adepabCQyfmMST5eKfAsi6prAN1Ch2St8J7P',
    '3tD34VtprDSkYCnATtQLCiVgTkECU3d12KtjupeR6N2X',
    'Ds33rQ1d4AXwxqyeXX6Pc3G4pFNr6iWb3dd8YfBBQMPr',
    '7PLpcezEnTV2xXU6eL3j4kLi9MJJFUngsWQvUNKyjE2V',
    '87Dia7JixTXFrXs7i5YHT1Z3dJFkd9KdaWquNcPsGPyT',
    '4i1h1Uz8SFWVa2erTtD4rvbxmWgPLjQZEvZj9yZULce1',
    '7byw3sD4hNG5NTwTHFRfxyASJCHfed4i6FKVdtqXGtru',
]);

const SOLDecimals = 9;
const USDCDecimals = 6;


export function calculateTotalPrice(pricePerToken: number | undefined | null, tokenAmount: bigint, tokenDecimals: number): number {
    if (!pricePerToken) return 0;
    const priceScaled = Math.round(pricePerToken * 1e18);
    const amountScaled = tokenAmount * BigInt(priceScaled);
    const divisor = 10n ** BigInt(tokenDecimals) * BigInt(1e18);
    return Number(amountScaled) / Number(divisor);
}


export function isStable(token: string): boolean {
    return STABLES.indexOf(token) > -1;
}

export class TokenStore {
    private readonly temps: Map<string, Token> = new Map();
    private readonly store: Store;
    private bundle: Bundle | undefined;
    private readonly rpcClient: Connection;
    private readonly metaplex: Metaplex;
    private readonly updated: Set<string> = new Set();
    constructor(store: Store, rpcClient: Connection, metaplex: Metaplex) {
        this.store = store;
        this.rpcClient = rpcClient;
        this.metaplex = metaplex;
    }

    private async updateBundle(price: number | undefined | null) {
        if (!price) return
        if (price < 1) console.log(price);
        if (!this.bundle) {
            console.log(`Token store updateBundle cache miss on ${SOL}`)
            const bundle = await this.store.findOneBy(Bundle, { id: SOL });
            if (!bundle) {
                this.bundle = new Bundle({
                    id: SOL,
                    nativePriceUSD: price,
                    chainId: 0
                })
                return;
            }
            this.bundle = bundle;
            this.bundle.nativePriceUSD = price;
        }
        this.bundle.nativePriceUSD = price;
    }

    private async getSSOLPrice(): Promise<number> {
        if (this.bundle) return this.bundle.nativePriceUSD
        console.log(`Token store getSSOLPrice cache miss on ${SOL}`)
        const bundle = await this.store.findOneBy(Bundle, { id: SOL });
        if (bundle) {
            this.bundle = bundle;
            return bundle.nativePriceUSD
        }
        return 0;
    }

    private async fetchToken(mintAddress: string): Promise<Token> {
        const address = new PublicKey(mintAddress);
        const token = await this.metaplex.nfts().findByMint({ mintAddress: address });
        if (token.mint.decimals <= 0) console.log(token);
        return new Token({
            id: mintAddress,
            name: token.name ?? '',
            symbol: token.symbol ?? '',
            decimals: token.mint.decimals ?? 9,
            price: isStable(mintAddress) ? 1 : null,
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
        console.log(`Token store ensure cache miss on ${id}`)
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

    async updateSOLPrice(sqrtPriceX64: bigint): Promise<void> {
        const price = getPriceFromSqrtPriceX64WithStableCoin(invertSqrtPriceX64(sqrtPriceX64), USDCDecimals, SOLDecimals)
        await this.updateBundle(zeroToNull(price));
        const token = await this.ensure(SOL);
        token.price = price;
        this.updated.add(token.id);
    }

    async updatePrice(token0Id: string, token1Id: string, sqrtPriceX64: bigint): Promise<[token0: Token, token1: Token]> {
        const token0 = await this.ensure(token0Id);
        const token1 = await this.ensure(token1Id);
        if (isStable(token0Id)) {
            if (token0.price != 1) token0.price = 1;
            token1.price = zeroToNull(getPriceFromSqrtPriceX64WithStableCoin(sqrtPriceX64, token0.decimals, token1.decimals));
        }

        if (isStable(token1Id)) {
            if (token1.price != 1) token1.price = 1;
            if (invertSqrtPriceX64(sqrtPriceX64) <= 0) console.log(token0Id, token1Id, sqrtPriceX64);
            token0.price = zeroToNull(getPriceFromSqrtPriceX64WithStableCoin(invertSqrtPriceX64(sqrtPriceX64), token0.decimals, token1.decimals));
        }

        const solPrice = await this.getSSOLPrice();
        if (token0Id === SOL && !isStable(token1Id) && token1Id !== SOL && solPrice > 0) token1.price = zeroToNull(getPriceFromSqrtPriceX64WithSOlPrice(solPrice, sqrtPriceX64, token0.decimals, token1.decimals));
        if (token1Id === SOL && !isStable(token0Id) && token0Id !== SOL && solPrice > 0) token0.price = zeroToNull(getPriceFromSqrtPriceX64WithSOlPrice(solPrice, invertSqrtPriceX64(sqrtPriceX64), token0.decimals, token1.decimals));

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

        if (this.bundle) await this.store.upsert(this.bundle)
        await this.store.upsert(updated);
        this.temps.clear();
        this.updated.clear();
    }
}
