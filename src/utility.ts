import { CollectPersonalFeeEvent, CollectProtocolFeeEvent, CreatePersonalPositionEvent, DecreaseLiquidityEvent, IncreaseLiquidityEvent } from './abi/generated/amm_v3/events';
import { CollectPersonalFeeEvent as CollectPersonalFee, CreatePersonalPositionEvent as CreatePersonalPosition, DecreaseLiquidityEvent as DecreaseLiquidity, IncreaseLiquidityEvent as IncreaseLiquidity, CollectProtocolFeeEvent as ProtocolFeeEvent } from './abi/generated/amm_v3/types';

export function calculateTokenRatio(amount0: bigint, amount1: bigint, decimals0: number, decimals1: number): number {
    if (amount1 === 0n) return 0;
    const scaledAmount0 = Number(amount0) / 10 ** decimals0;
    const scaledAmount1 = Number(amount1) / 10 ** decimals1;
    return scaledAmount0 / scaledAmount1;
}

export function zeroToNull(val: number | undefined | null): number | null {
    if (!val) return null;
    return val
}

function isZero(a: number | undefined | null): boolean {
    return a === 0;
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

interface EventObject {
    d8: string
}

interface LogMessage {
    kind: 'data' | 'log' | 'other'
    message: string
}

export function isEvent(event: EventObject, log: LogMessage): boolean {
    if (log.kind !== 'data') return false;
    if (!log.message) return false;
    if (log.message.length < 12) return false;

    const base64Chunk = log.message.slice(0, 12);
    const binStr = atob(base64Chunk);
    const hex = Array.from(binStr)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
    const result = `0x${hex.slice(0, 16)}`;
    return event.d8 === result;
}

export function getCreatePositionEvent(logs: LogMessage[]): CreatePersonalPosition | undefined {
    for (let log of logs) {
        if (log.kind === 'data') {
            if (isEvent(CreatePersonalPositionEvent, log)) {
                const event = CreatePersonalPositionEvent.decodeData(Buffer.from(log.message, 'base64'));
                return event;
            }
        }
    }
}

export function getIncreaseLiquidityEvent(logs: LogMessage[]): IncreaseLiquidity | undefined {
    for (let log of logs) {
        if (log.kind === 'data') {
            if (isEvent(IncreaseLiquidityEvent, log)) {
                const event = IncreaseLiquidityEvent.decodeData(Buffer.from(log.message, 'base64'));
                return event;
            }
        }
    }
}

export function getDecreaseLiquidityEvent(logs: LogMessage[]): DecreaseLiquidity | undefined {
    for (let log of logs) {
        if (log.kind === 'data') {
            if (isEvent(DecreaseLiquidityEvent, log)) {
                const event = DecreaseLiquidityEvent.decodeData(Buffer.from(log.message, 'base64'));
                return event;
            }
        }
    }
}

export function getCollectProtocolFeeEvent(logs: LogMessage[]): ProtocolFeeEvent | undefined {
    for (let log of logs) {
        if (log.kind === 'data') {
            if (isEvent(CollectProtocolFeeEvent, log)) {
                const event = CollectProtocolFeeEvent.decodeData(Buffer.from(log.message, 'base64'));
                return event;
            }
        }
    }
}

export function getCollectPersonalFeeEvent(logs: LogMessage[]): CollectPersonalFee | undefined {
    for (let log of logs) {
        if (log.kind === 'data') {
            if (isEvent(CollectPersonalFeeEvent, log)) {
                const event = CollectPersonalFeeEvent.decodeData(Buffer.from(log.message, 'base64'));
                return event;
            }
        }
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

export class TimeCounter {
    private readonly name: string;
    private counter: number = 0;
    private max: number = 0;
    private min: number = 0;
    private total: number = 0;
    private startTime: number = 0;
    private invalid: boolean = false;

    constructor(name: string) {
        this.name = name
    }

    start(): void {
        if (this.invalid) return;
        if (this.startTime > 0) {
            console.warn("start before stoping past counter");
            this.invalid = true;
            return;
        }
        this.startTime = new Date().getTime();
    }

    stop(): void {
        if (this.invalid) return;
        if (this.startTime === 0) {
            console.warn("stop before starting");
            this.invalid = true;
            return;
        }
        const current = new Date().getTime();
        const elapsed = current - this.startTime;
        this.total += elapsed;
        if (elapsed > this.max) this.max = elapsed;
        if (this.min === 0 || elapsed < this.min) this.min = elapsed;
        this.counter += 1;
        this.startTime = 0;
    }

    log(): void {
        // console.log(`${this.name}${this.name.length < 13 ? '\t\t' : '\t'}count: ${this.counter} objects\tavg: ${this.total > 0 ? this.total / this.counter : this.total}ms\tmin: ${this.min}ms\tmax:${this.max}ms`)
        if (!this.invalid) {
            console.dir({ name: this.name, count: this.counter, total: this.total, avg: this.total > 0 ? this.total / this.counter : this.total, min: this.min, max: this.max });
            // console.log(`${this.name}: 
            //   count: ${this.counter} objects
            //   total: ${this.total} ms
            //   avg:   ${this.total > 0 ? this.total / this.counter : this.total} ms
            //   min:   ${this.min} ms
            //   max:   ${this.max} ms`);
        }
    }
}