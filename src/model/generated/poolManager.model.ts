import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, FloatColumn as FloatColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class PoolManager {
    constructor(props?: Partial<PoolManager>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    poolCount!: number

    @BigIntColumn_({nullable: false})
    swapCount!: bigint

    @FloatColumn_({nullable: false})
    totalVolumeUSD!: number

    @FloatColumn_({nullable: false})
    totalFeesUSD!: number

    @StringColumn_({nullable: false})
    poolManagerAddress!: string

    @IntColumn_({nullable: false})
    chainId!: number
}
