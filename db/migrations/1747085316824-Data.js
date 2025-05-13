module.exports = class Data1747085316824 {
    name = 'Data1747085316824'

    async up(db) {
        await db.query(`CREATE TABLE "positions" ("id" character varying NOT NULL, "owner" text NOT NULL, "pool_id" text NOT NULL, "tick_lower_index" integer NOT NULL, "tick_upper_index" integer NOT NULL, "tick_array_lower_start_index" integer NOT NULL, "tick_array_upper_start_index" integer NOT NULL, "liquidity" numeric NOT NULL, "closed" boolean NOT NULL DEFAULT false, "hash" text NOT NULL, CONSTRAINT "PK_17e4e62ccd5749b289ae3fae6f3" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_433905665b17c96b1ed944cc5a" ON "positions" ("owner") `)
        await db.query(`CREATE INDEX "IDX_5185f518d0c21270fc0de40068" ON "positions" ("pool_id") `)
        await db.query(`CREATE INDEX "IDX_65ba2e7db00258efdf326205ee" ON "positions" ("tick_lower_index") `)
        await db.query(`CREATE INDEX "IDX_171fdd0ee2740b40c82fccca0c" ON "positions" ("tick_upper_index") `)
        await db.query(`CREATE TABLE "pools" ("id" character varying NOT NULL, "creator" text NOT NULL, "amm_config" text NOT NULL, "status" integer NOT NULL DEFAULT '0', "observation_state" text NOT NULL, "tick_array_bitmap" text NOT NULL, "sqrt_price_x64" numeric NOT NULL, "tick" integer NOT NULL, "tick_upper" integer NOT NULL, "tick_lower" integer NOT NULL, "tick_spacing" integer NOT NULL, "liquidity" numeric NOT NULL, "swap_count" numeric NOT NULL DEFAULT 0, "open_time" numeric NOT NULL, "token0" text NOT NULL, "token1" text NOT NULL, "hash" text NOT NULL, CONSTRAINT "PK_6708c86fc389259de3ee43230ee" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_461a1f977c3e29ddd2493f98fc" ON "pools" ("creator") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "positions"`)
        await db.query(`DROP INDEX "public"."IDX_433905665b17c96b1ed944cc5a"`)
        await db.query(`DROP INDEX "public"."IDX_5185f518d0c21270fc0de40068"`)
        await db.query(`DROP INDEX "public"."IDX_65ba2e7db00258efdf326205ee"`)
        await db.query(`DROP INDEX "public"."IDX_171fdd0ee2740b40c82fccca0c"`)
        await db.query(`DROP TABLE "pools"`)
        await db.query(`DROP INDEX "public"."IDX_461a1f977c3e29ddd2493f98fc"`)
    }
}
