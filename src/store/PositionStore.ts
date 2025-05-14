import { Store } from "@subsquid/typeorm-store";
import { Position } from "../model";

export class PositionStore {
    private temps: Record<string, Position> = {};
    private readonly store: Store;
    constructor(store: Store) {
        this.store = store;
    }

    async get(id: string): Promise<Position | undefined> {
        let position: Position | undefined = this.temps[id];
        if (position) return position;
        position = await this.store.findOneBy(Position, { id });
        if (position) {
            this.temps[id] = position;
            return position;
        }
    }

    async save(position: Position): Promise<void> {
        this.temps[position.id] = position;
    }

    async flush(): Promise<void> {
        this.store.upsert(Object.values(this.temps));
        this.temps = {};
    }
}