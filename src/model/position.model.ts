import { BigIntColumn, BooleanColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("positions")
export class Position {
    constructor(props?: Partial<Position>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @StringColumn()
    @Index()
    owner?: string

    @StringColumn()
    @Index()
    poolId!: string

    @IntColumn()
    @Index()
    tickLowerIndex!: number

    @IntColumn()
    @Index()
    tickUpperIndex!: number

    @IntColumn()
    tickArrayLowerStartIndex!: number

    @IntColumn()
    tickArrayUpperStartIndex!: number

    @BigIntColumn()
    liquidity!: bigint

    @BooleanColumn({ default: false })
    closed!: boolean

    @StringColumn()
    hash!: string
}