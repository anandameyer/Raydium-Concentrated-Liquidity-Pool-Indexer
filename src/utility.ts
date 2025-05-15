import { base64 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { LogMessage } from "@subsquid/solana-stream";
import { CollectPersonalFeeEvent, CollectProtocolFeeEvent, CreatePersonalPositionEvent, DecreaseLiquidityEvent, IncreaseLiquidityEvent } from './abi/generated/amm_v3/events';
import { CollectPersonalFeeEvent as CollectPersonalFee, CreatePersonalPositionEvent as CreatePersonalPosition, DecreaseLiquidityEvent as DecreaseLiquidity, IncreaseLiquidityEvent as IncreaseLiquidity, CollectProtocolFeeEvent as ProtocolFeeEvent } from './abi/generated/amm_v3/types';

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

export function multiplyBigIntByFloat(bigIntValue: bigint, floatValue: number, scale: number = 0): bigint {
    if (!Number.isFinite(floatValue)) throw new Error("Float value must be a finite number");

    if (floatValue === 0.0) return 0n;

    const scaleFactor = 10 ** scale;
    const scaledFloat = Math.round(floatValue * scaleFactor);
    const scaledResult = bigIntValue * BigInt(scaledFloat);
    return scaledResult / BigInt(scaleFactor);
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