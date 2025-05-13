import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, FloatColumn as FloatColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class Bundle {
    constructor(props?: Partial<Bundle>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @FloatColumn_({nullable: false})
    nativePriceUSD!: number

    @IntColumn_({nullable: false})
    chainId!: number
}
