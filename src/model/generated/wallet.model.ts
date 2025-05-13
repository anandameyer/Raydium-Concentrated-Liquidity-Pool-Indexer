import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Position} from "./position.model"

@Entity_()
export class Wallet {
    constructor(props?: Partial<Wallet>) {
        Object.assign(this, props)
    }

    /**
     * User address
     */
    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    walletAddress!: string

    @IntColumn_({nullable: false})
    chainId!: number

    @OneToMany_(() => Position, e => e.owner)
    positions!: Position[]
}
