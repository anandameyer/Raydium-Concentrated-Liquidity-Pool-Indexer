import { base64 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { LogMessage } from "@subsquid/solana-stream";
import { CollectPersonalFeeEvent, CollectProtocolFeeEvent, CreatePersonalPositionEvent, DecreaseLiquidityEvent, IncreaseLiquidityEvent } from './abi/generated/amm_v3/events';
import { CollectPersonalFeeEvent as CollectPersonalFee, CreatePersonalPositionEvent as CreatePersonalPosition, DecreaseLiquidityEvent as DecreaseLiquidity, IncreaseLiquidityEvent as IncreaseLiquidity, CollectProtocolFeeEvent as ProtocolFeeEvent } from './abi/generated/amm_v3/types';

export function calculateTokenRatio(amount0: bigint, amount1: bigint, decimals0: number, decimals1: number): number {
    if (amount1 === 0n) return 0;
    const scaledAmount0 = Number(amount0) / 10 ** decimals0;
    const scaledAmount1 = Number(amount1) / 10 ** decimals1;
    return scaledAmount0 / scaledAmount1;
}

export function bigIntToDecimalStr(value: bigint, decimals: number = 9, trimTrailingZeros: boolean = true): string {

    if (decimals < 0) throw new Error("Decimals cannot be negative");

    const str = value.toString().padStart(decimals + 1, '0');
    const integerPart = str.slice(0, -decimals) || '0';
    const fractionalPart = str.slice(-decimals);

    let result = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;

    if (trimTrailingZeros && fractionalPart) result = result.replace(/\.?0+$/, '');
    return result;
}

export function divideBigIntToFloat(numerator: bigint, denominator: bigint, maxDecimals: number = 15): number {
    if (denominator === 0n) return 0.0;
    const fullPrecision = Number(numerator) / Number(denominator);
    const factor = 10 ** maxDecimals;
    return Math.round(fullPrecision * factor) / factor;
}

export function bigIntPercentage(value: bigint, percentage: number, precision: number): bigint {
    const scaleFactor = 10n ** BigInt(precision);
    const scaledPercentage = BigInt(Math.round(percentage * Number(scaleFactor)));
    const scaledValue = value * scaledPercentage;
    const result = scaledValue / (100n * scaleFactor);
    return result;
}

export function multiplyBigIntByFloat(bigIntValue: bigint, floatValue: number): bigint {
    if (!Number.isFinite(floatValue)) throw new Error("Float value must be a finite number");

    if (floatValue === 0.0) return 0n;

    const floatStr = floatValue.toString();
    const decimalIndex = floatStr.indexOf('.');
    const decimalPlaces = decimalIndex === -1 ? 0 : floatStr.length - decimalIndex - 1;

    const scaleFactor = 10 ** decimalPlaces;
    const scaledFloat = Math.round(floatValue * scaleFactor);
    const scaledBigInt = bigIntValue * BigInt(scaledFloat);
    let result = scaledBigInt / BigInt(scaleFactor);
    const remainder = scaledBigInt % BigInt(scaleFactor);

    const threshold = BigInt(scaleFactor) / 2n;
    if (remainder >= threshold) result += 1n;

    return result;
}

export function getCreatePositionEvent(logs: LogMessage[]): CreatePersonalPosition | undefined {
    for (let log of logs) {
        try {
            const event = CreatePersonalPositionEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

export function getIncreaseLiquidityEvent(logs: LogMessage[]): IncreaseLiquidity | undefined {
    for (let log of logs) {
        try {
            const event = IncreaseLiquidityEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

export function getDecreaseLiquidityEvent(logs: LogMessage[]): DecreaseLiquidity | undefined {
    for (let log of logs) {
        try {
            const event = DecreaseLiquidityEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

export function getCollectProtocolFeeEvent(logs: LogMessage[]): ProtocolFeeEvent | undefined {
    for (let log of logs) {
        try {
            const event = CollectProtocolFeeEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

export function getCollectPersonalFeeEvent(logs: LogMessage[]): CollectPersonalFee | undefined {
    for (let log of logs) {
        try {
            const event = CollectPersonalFeeEvent.decodeData(base64.decode(log.message));
            return event;
        } catch (_) { }
    }
}

export class BatchBlockTick {
    private lowerTicks: Record<string, number> = {};
    private upperTicks: Record<string, number> = {};

    insert(poolId: string, tick: number): void {
        let lower = this.lowerTicks[poolId];
        if (!lower) this.lowerTicks[poolId] = tick;
        if (tick < lower) this.lowerTicks[poolId] = tick;

        let upper = this.upperTicks[poolId];
        if (!upper) this.upperTicks[poolId] = tick;
        if (tick > upper) this.upperTicks[poolId] = tick;
    };

    get(poolId: string): [lower: number, upper: number] {
        const lower = this.lowerTicks[poolId] ?? 0;
        const upper = this.upperTicks[poolId] ?? 0;
        return [lower, upper];
    }
}