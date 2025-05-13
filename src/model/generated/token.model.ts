import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, FloatColumn as FloatColumn_, BigIntColumn as BigIntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {TokenDayData} from "./tokenDayData.model"
import {TokenHourData} from "./tokenHourData.model"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    name!: string

    @StringColumn_({nullable: false})
    symbol!: string

    @IntColumn_({nullable: false})
    decimals!: number

    @FloatColumn_({nullable: false})
    price!: number

    @IntColumn_({nullable: false})
    poolCount!: number

    @BigIntColumn_({nullable: false})
    swapCount!: bigint

    @IntColumn_({nullable: false})
    chainId!: number

    @StringColumn_({nullable: false})
    tokenAddress!: string

    @BigIntColumn_({nullable: false})
    blockNumber!: bigint

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @OneToMany_(() => TokenDayData, e => e.token)
    tokenDayDatas!: TokenDayData[]

    @OneToMany_(() => TokenHourData, e => e.token)
    tokenHourDatas!: TokenHourData[]
}
