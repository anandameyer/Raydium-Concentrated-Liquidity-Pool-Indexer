import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, ManyToOne as ManyToOne_, Index as Index_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, FloatColumn as FloatColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Token} from "./token.model"
import {Hook} from "./hook.model"
import {Position} from "./position.model"
import {PoolDayData} from "./poolDayData.model"
import {PoolHourData} from "./poolHourData.model"

@Entity_()
export class Pool {
    constructor(props?: Partial<Pool>) {
        Object.assign(this, props)
    }

    /**
     *  poolId 
     */
    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    token0Id!: string

    /**
     *  currency0 address 
     */
    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token0!: Token

    @StringColumn_({nullable: false})
    token1Id!: string

    /**
     *  currency1 address 
     */
    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token1!: Token

    @IntColumn_({nullable: false})
    token0Decimals!: number

    @IntColumn_({nullable: false})
    token1Decimals!: number

    /**
     *  amount of token0 stored in the pool 
     */
    @BigIntColumn_({nullable: false})
    amount0!: bigint

    @StringColumn_({nullable: false})
    amount0D!: string

    /**
     *  amount of token1 stored in the pool 
     */
    @BigIntColumn_({nullable: false})
    amount1!: bigint

    @StringColumn_({nullable: false})
    amount1D!: string

    /**
     *  relative price of token0
     */
    @FloatColumn_({nullable: false})
    price0!: number

    /**
     *  relative price of token1
     */
    @FloatColumn_({nullable: false})
    price1!: number

    @StringColumn_({nullable: false})
    poolAddress!: string

    /**
     *  pool fee tier 
     */
    @IntColumn_({nullable: false})
    fee!: number

    @StringColumn_({nullable: false})
    hookId!: string

    @Index_()
    @ManyToOne_(() => Hook, {nullable: true})
    hook!: Hook

    /**
     *  sqrtPriceX96, used for calculations 
     */
    @BigIntColumn_({nullable: false})
    sqrtPriceX96!: bigint

    /**
     *  current pool tick 
     */
    @IntColumn_({nullable: false})
    currentTick!: number

    @BigIntColumn_({nullable: false})
    liquidity!: bigint

    @BigIntColumn_({nullable: false})
    volumeToken0!: bigint

    @StringColumn_({nullable: false})
    volumeToken0D!: string

    @BigIntColumn_({nullable: false})
    volumeToken1!: bigint

    @StringColumn_({nullable: false})
    volumeToken1D!: string

    @FloatColumn_({nullable: false})
    volumeUSD!: number

    @BigIntColumn_({nullable: false})
    collectedFeesToken0!: bigint

    @BigIntColumn_({nullable: false})
    collectedFeesToken1!: bigint

    @FloatColumn_({nullable: false})
    collectedFeesUSD!: number

    @FloatColumn_({nullable: false})
    tvlUSD!: number

    @IntColumn_({nullable: false})
    tickSpacing!: number

    @IntColumn_({nullable: false})
    batchBlockMinimumTick!: number

    @IntColumn_({nullable: false})
    batchBlockMaximumTick!: number

    @BigIntColumn_({nullable: false})
    swapCount!: bigint

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

    @BigIntColumn_({nullable: false})
    createdAtTimestamp!: bigint

    @BigIntColumn_({nullable: false})
    createdAtBlockNumber!: bigint

    @OneToMany_(() => Position, e => e.pool)
    positions!: Position[]

    @OneToMany_(() => PoolDayData, e => e.pool)
    poolDayDatas!: PoolDayData[]

    @OneToMany_(() => PoolHourData, e => e.pool)
    poolHourDatas!: PoolHourData[]
}
