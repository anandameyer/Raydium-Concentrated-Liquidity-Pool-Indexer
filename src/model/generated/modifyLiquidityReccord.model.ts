import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Pool} from "./pool.model"
import {Wallet} from "./wallet.model"

@Entity_()
export class ModifyLiquidityReccord {
    constructor(props?: Partial<ModifyLiquidityReccord>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    poolId!: string

    @StringColumn_({nullable: false})
    poolEntityId!: string

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    poolEntity!: Pool

    @BigIntColumn_({nullable: false})
    liquidityDelta!: bigint

    @StringColumn_({nullable: false})
    salt!: string

    @StringColumn_({nullable: false})
    senderId!: string

    @Index_()
    @ManyToOne_(() => Wallet, {nullable: true})
    sender!: Wallet

    @IntColumn_({nullable: false})
    tickLower!: number

    @IntColumn_({nullable: false})
    tickUpper!: number

    @StringColumn_({nullable: false})
    hash!: string

    @BigIntColumn_({nullable: false})
    txAtTimestamp!: bigint

    @BigIntColumn_({nullable: false})
    txAtBlockNumber!: bigint
}
