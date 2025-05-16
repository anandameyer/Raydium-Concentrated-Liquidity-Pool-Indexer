import { BigIntColumn, BooleanColumn, DateTimeColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("pair_records")
export class PairRecord {
    constructor(props?: Partial<PairRecord>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @StringColumn()
    poolId!: string

    @DateTimeColumn()
    timestamp!: Date

    @StringColumn()
    @Index()
    token0!: string

    @IntColumn()
    token0Decimals!: number

    @StringColumn()
    @Index()
    token1!: string

    @IntColumn()
    token1Decimals!: number

    @BooleanColumn()
    baseStable!: boolean

    @BigIntColumn()
    sqrtPriceX64!: bigint
}