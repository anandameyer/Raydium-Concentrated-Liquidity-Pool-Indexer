import { BigIntColumn, BooleanColumn, DateTimeColumn, Entity, Index, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

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

    @StringColumn()
    @Index()
    token1!: string

    @BooleanColumn()
    baseStable!: boolean

    @BigIntColumn()
    sqrtPriceX96!: bigint
}