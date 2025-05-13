import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BooleanColumn as BooleanColumn_, IntColumn as IntColumn_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class Hook {
    constructor(props?: Partial<Hook>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BooleanColumn_({nullable: false})
    isWhitelisted!: boolean

    @BooleanColumn_({nullable: false})
    isBlacklisted!: boolean

    @IntColumn_({nullable: false})
    chainId!: number

    @StringColumn_({nullable: false})
    hookAddress!: string

    @BigIntColumn_({nullable: false})
    blockNumber!: bigint

    @BigIntColumn_({nullable: false})
    timestamp!: bigint
}
