import { BigIntColumn, DateTimeColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("volumes")
export class Volume {
    constructor(props?: Partial<Volume>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @StringColumn()
    poolId!: string

    @DateTimeColumn({ nullable: false })
    @Index()
    startTime!: Date

    @DateTimeColumn({ nullable: false })
    @Index()
    endTime!: Date

    @BigIntColumn()
    token0!: bigint

    @BigIntColumn()
    token1!: bigint

    @BigIntColumn()
    totalSwap!: bigint

    @IntColumn()
    lowerTick!: number

    @IntColumn()
    upperTick!: number
}