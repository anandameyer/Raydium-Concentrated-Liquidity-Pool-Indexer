import { Entity, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity("amm_configs")
export class AMMConfig {
    constructor(props?: Partial<AMMConfig>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @IntColumn()
    bump!: number

    @IntColumn()
    index!: number

    @StringColumn()
    owner!: string

    @IntColumn()
    protocolFeeRate!: number

    @IntColumn()
    tradeFeeRate!: number

    @IntColumn()
    tickSpacing!: number

    @IntColumn()
    fundFeeRate!: number

    @StringColumn()
    fundOwner!: string
}