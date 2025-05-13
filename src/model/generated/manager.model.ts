import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Position} from "./position.model"

@Entity_()
export class Manager {
    constructor(props?: Partial<Manager>) {
        Object.assign(this, props)
    }

    /**
     *  position manager address 
     */
    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    managerAddress!: string

    @IntColumn_({nullable: false})
    chainId!: number

    @OneToMany_(() => Position, e => e.manager)
    positions!: Position[]
}
