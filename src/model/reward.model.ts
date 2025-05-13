import { BigIntColumn, BooleanColumn, DateTimeColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("rewards")
export class Reward {
    constructor(props?: Partial<Reward>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @StringColumn()
    rewardFunder!: string

    @StringColumn()
    ammConfig!: string

    @IntColumn()
    @Index()
    index!: number

    @StringColumn()
    @Index()
    poolId!: string

    @StringColumn()
    @Index()
    rewardToken!: string

    @DateTimeColumn()
    @Index()
    openTime!: Date

    @DateTimeColumn()
    @Index()
    endTime!: Date

    @BigIntColumn()
    emissionsPerSecondX64!: bigint

    @BooleanColumn()
    collected!: boolean

    @StringColumn()
    hash!: string
}