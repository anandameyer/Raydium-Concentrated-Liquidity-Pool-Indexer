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

    @FloatColumn_({nullable: true})
    totalVolumeUSD!: number | undefined | null

    @FloatColumn_({nullable: true})
    totalFeesUSD!: number | undefined | null

    @StringColumn_({nullable: false})
    poolManagerAddress!: string

    @IntColumn_({nullable: false})
    chainId!: number
}
