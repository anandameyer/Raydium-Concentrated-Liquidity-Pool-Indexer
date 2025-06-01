import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, Index as Index_, FloatColumn as FloatColumn_} from "@subsquid/typeorm-store"
import {Token} from "./token.model"
import {Manager} from "./manager.model"
import {Pool} from "./pool.model"
import {Wallet} from "./wallet.model"

@Entity_()
export class Position {
    constructor(props?: Partial<Position>) {
        Object.assign(this, props)
    }

    /**
     *  Position Manager + NFT ID 
     */
    @PrimaryColumn_()
    id!: string

    /**
     *  id of the non fungible position 
     */
    @StringColumn_({nullable: false})
    nftId!: string

    /**
     *  lower tick of the position 
     */
    @IntColumn_({nullable: false})
    lowerTick!: number

    /**
     *  upper tick of the position 
     */
    @IntColumn_({nullable: false})
    upperTick!: number

    /**
     *  total position liquidity 
     */
    @BigIntColumn_({nullable: false})
    liquidity!: bigint

    /**
     *  amount of token0 stored in the position 
     */
    @BigIntColumn_({nullable: false})
    amount0!: bigint

    @StringColumn_({nullable: false})
    amount0D!: string

    /**
     *  amount of token1 stored in the position 
     */
    @BigIntColumn_({nullable: false})
    amount1!: bigint

    @StringColumn_({nullable: false})
    amount1D!: string

    @StringColumn_({nullable: true})
    token0Id!: string | undefined | null

    /**
     *  currency0 address 
     */
    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token0!: Token | undefined | null

    @StringColumn_({nullable: true})
    token1Id!: string | undefined | null

    /**
     *  currency1 address 
     */
    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token1!: Token | undefined | null

    @FloatColumn_({nullable: true})
    coreTotalUSD!: number | undefined | null

    @StringColumn_({nullable: false})
    managerId!: string

    @Index_()
    @ManyToOne_(() => Manager, {nullable: true})
    manager!: Manager

    @StringColumn_({nullable: true})
    poolId!: string | undefined | null

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool | undefined | null

    @StringColumn_({nullable: false})
    ownerId!: string

    @Index_()
    @ManyToOne_(() => Wallet, {nullable: true})
    owner!: Wallet

    @FloatColumn_({nullable: false})
    ratio!: number

    @IntColumn_({nullable: false})
    chainId!: number

    /**
     * last update block 
     */
    @BigIntColumn_({nullable: false})
    blockNumber!: bigint

    /**
     * last update timestamp 
     */
    @BigIntColumn_({nullable: false})
    timestamp!: bigint
}
