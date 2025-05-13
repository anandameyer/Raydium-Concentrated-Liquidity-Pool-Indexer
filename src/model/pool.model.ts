import { BigIntColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("pools")
export class Pool {
    constructor(props?: Partial<Pool>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @StringColumn()
    @Index()
    creator!: string

    @StringColumn()
    ammConfig!: string

    @IntColumn({ default: 0 })
    status!: number

    @StringColumn()
    observationState!: string

    @StringColumn()
    tickArrayBitmap!: string

    @BigIntColumn()
    sqrtPriceX64!: bigint

    @IntColumn()
    tick!: number

    @IntColumn()
    tickUpper!: number

    @IntColumn()
    tickLower!: number

    @IntColumn()
    tickSpacing!: number

    @BigIntColumn()
    liquidity!: bigint

    @BigIntColumn({ default: 0n })
    swapCount!: bigint

    @BigIntColumn()
    openTime!: bigint

    @StringColumn()
    token0!: string

    @StringColumn()
    token1!: string

    @StringColumn()
    hash!: string
}