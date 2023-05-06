import { Vector, VectorCollector } from '@client/helpers.js';
import { Mob } from "../../mob.js";
import type { ServerChunk } from '../../server_chunk.js';
import { SAVE_BACKWARDS_COMPATIBLE_INDICATOTRS } from '../../server_constant.js';
import type { ServerWorld } from '../../server_world.js';
import { BulkSelectQuery, preprocessSQL, run } from "../db_helpers.js";
import { toDeprecatedIndicators } from '../world.js';

const BULK_UPDATE_FIELDS = 'x = %1, y = %2, z = %3, indicators = %4, extra_data = %5, rotate = %6'

const INSERT = {
    BULK: undefined
}

const UPDATE = {
    BULK: undefined,
    BULK_FULL: undefined
}

const tmpAddr = new Vector()

/** Mob data that is saved regularly */
export type MobUpdateRow = [
    id: int,
    x: int, y: int, z: int,
    indicators: string, // JSON.stringify(mob.indicators | toDeprecatedIndicators(mob.indicators)),
    extra_data: string, //JSON.stringify(mob.extra_data),
    rotate: string      //JSON.stringify(mob.rotate)
]

/** These updates have more data than regular updates, and they are saved only when needed. */
export type MobFullUpdateRow = ConcatTuple<MobUpdateRow, [
    is_active: int,     // 1, 0
    pos_spawn: string,  // JSON.stringify(mob.pos_spawn)
    driving_id: int | null
]>

export type MobInsertRow = ConcatTuple<MobFullUpdateRow, [
    entity_id: string,
    type: string,
    skin: string
]>

/** A mob record returned from DB */
export type MobRow = {
    id          : int
    rotate      : string    // stringified IVector
    pos_spawn   : string    // stringified IVector
    x           : float
    y           : float
    z           : float
    entity_id   : string
    type        : string
    skin        : string
    is_active   : int
    extra_data  : string    // stringified object
    indicators  : string    // stringified Indicators
    /**
     * id вождения, в котором участвует моб.
     * Возможна ситуация когда такое вождение отстуствует (но у моба осталось). Это нормально - нужно считать driving_id == null.
     */
    driving_id  : int | null
    /**
     * JSON-строка. Эти данные берутся из таблицы driving, если есть связанная запись.
     * Это для того чтобы сразу создать вождение, если моб в нем участвует, а не грузить из таблицы driving
     * отдельным запросом. Так проще и быстрее.
     */
    driving_data: string | null
}

export class DBWorldMob {
    conn: DBConnection;
    world: ServerWorld;
    bulkLoadActiveInVolumeQuery: BulkSelectQuery<MobRow>;
    maxId: int;
    _addrByMobId: Map<int, Vector>;
    _previouslyOccupiedAddrs: Vector[];
    _activeMobsInChunkCount: VectorCollector; // of int

    constructor(conn: DBConnection, world: ServerWorld) {
        this.conn = conn;
        this.world = world;

        this.bulkLoadActiveInVolumeQuery = new BulkSelectQuery(this.conn,
            `WITH cte AS (SELECT key, value FROM json_each(:jsonRows))
            SELECT cte.key, entity.*, driving.data AS driving_data
            FROM cte,
                entity LEFT JOIN driving ON driving_id = driving.id 
            WHERE is_active = 1 AND x >= %0 AND x < %1 AND y >= %2 AND y < %3 AND z >= %4 AND z < %5`,
            'key'
        );
    }

    async init() {
        this.maxId = (await this.conn.get('SELECT id FROM entity ORDER BY id DESC LIMIT 1'))?.id ?? 0;
    }

    getNextId(): int {
        return ++this.maxId;
    }

    /**
     * If the mob changed its chunk:
     *  - if is_active === true, adds to the conut of mobs in the new chunk
     *  - if the mob was in a chunk, queues decrement of mobs count in that old chunk
     * To actually decrement the mobs count, call {@link onWorldTransactionCommit}
     */
    _cacheMob(id: int, is_active: int | boolean, x: float = null, y: float = null, z: float = null): void {

        const old_chunk_addr = this._addrByMobId.get(id);
        const new_chunk_addr = is_active && this.world.chunkManager.grid.getChunkAddr(x, y, z, tmpAddr);

        if(old_chunk_addr) {
            if(new_chunk_addr && old_chunk_addr.equal(new_chunk_addr)) {
                // the mob remains active in the same chunk
                return;
            }
            // remember to subtract the mob from the old chunk after the transaction commits
            this._previouslyOccupiedAddrs.push(old_chunk_addr.clone());
        } else {
            if (!new_chunk_addr) {
                // the mob wasn't active, and still isn't
                return;
            }
        }

        // update to which chunk the mob is currently added
        if (new_chunk_addr) {
            this._activeMobsInChunkCount.update(new_chunk_addr, n => (n ?? 0) + 1);
            this._addrByMobId.set(id, new_chunk_addr);
        } else {
            this._addrByMobId.delete(id);
        }
    }

    // Removes cached mobs from chunks that they previously occupied. Only the world transaction should call it.
    onWorldTransactionCommit() {
        const decrement = (n: int) => (--n > 0) ? n : null;
        for(const addr of this._previouslyOccupiedAddrs) {
            this._activeMobsInChunkCount.update(addr, decrement);
        }
        this._previouslyOccupiedAddrs.length = 0;
    }

    // initChunksAddrWithMobs
    async initChunksWithMobs(chunk_size : Vector) {
        // keys = addresses of chunks with active mobs in DB
        // valus = the number of active mobs in DB in this chunk
        this._activeMobsInChunkCount = new VectorCollector();
        // key = active mob id
        // value = address of the chunk where the mob is currently added to _activeMobsInChunkCount
        // It doesn't include this._previouslyOccupiedAddrs.
        this._addrByMobId = new Map();
        // Addresses of chunks that still hold a mob that moved to another chunk, but should lose that mob
        // after all the changes are written. It's to avoid race conditions.
        this._previouslyOccupiedAddrs = [];

        let rows = await this.conn.all(`SELECT id, x, y, z /*, is_active DISTINCT
            cast(x / ${chunk_size.x} as int) - (x / ${chunk_size.x} < cast(x / ${chunk_size.x} as int)) AS x,
            cast(y / ${chunk_size.y} as int) - (y / ${chunk_size.y} < cast(y / ${chunk_size.y} as int)) AS y,
            cast(z / ${chunk_size.z} as int) - (z / ${chunk_size.z} < cast(z / ${chunk_size.z} as int)) AS z
            */
        FROM entity
        WHERE is_active = 1`);
        for(let row of rows) {
            this._cacheMob(row.id, true, row.x, row.y, row.z);
        }
    }

    // Load mobs
    // TODO optimize: merge volumes for adjacent chunks, then separate mobs into chunks on host
    async loadInChunk(chunk: ServerChunk): Promise<[mob: Mob, driving_data: string | null][]> {
        const resp: [Mob, string | null][] = []
        if(!this._activeMobsInChunkCount.has(chunk.addr)) {
            return resp;
        }
        const coord = chunk.coord;
        const size = chunk.size;
        const rows = await this.bulkLoadActiveInVolumeQuery.all([
            coord.x,
            coord.x + size.x,
            coord.y,
            coord.y + size.y,
            coord.z,
            coord.z + size.z
        ]);
        for(const row of rows) {
            const mob = Mob.fromRow(this.world, row)
            if (mob) {
                resp.push([mob, row.driving_data])
            }
        }
        return resp;
    }

    /** Загружает моба и связанные с ним данные вождения */
    async load(id: int): Promise<[mob: Mob | null, driving_data: string | null]> {
        return this.conn.get(`SELECT entity.*, driving.data AS driving_data 
            FROM entity LEFT JOIN driving ON driving_id = driving.id
            WHERE entity.id = :id`, {
            ':id': id
        }).then((row?: MobRow) => {
            const mob = row && Mob.fromRow(this.world, row)
            return mob ? [mob, row.driving_data] : [null, null]
        })
    }

    /** Returns a row that can be passed to {@link bulkUpdate} */
    static toUpdateRow(mob: Mob): MobUpdateRow {
        const indicators = SAVE_BACKWARDS_COMPATIBLE_INDICATOTRS
            ? toDeprecatedIndicators(mob.indicators)
            : mob.indicators
        return [
            mob.id,
            mob.pos.x, mob.pos.y, mob.pos.z,
            JSON.stringify(indicators),
            JSON.stringify(mob.extra_data),
            JSON.stringify(mob.rotate)
        ];
    }

    async bulkUpdate(rows: MobUpdateRow[]) {
        UPDATE.BULK = UPDATE.BULK ?? preprocessSQL(`
            UPDATE entity
            SET ${BULK_UPDATE_FIELDS}
            FROM json_each(:jsonRows)
            WHERE entity.id = %0
        `);
        return rows.length ? run(this.conn, UPDATE.BULK, {
            ':jsonRows': JSON.stringify(rows)
        }).then(() => {
            for(const row of rows) {
                // we know active = true because this method called only for mobs that remain active
                this._cacheMob(row[0], true, row[1], row[2], row[3]);
            }
        }) : null;
    }

    /** Upgrdaes {@link row} from {@link MobUpdateRow} to {@link MobFullUpdateRow} by adding more data from a mob. */
    static upgradeRowToFullUpdate(row: MobUpdateRow, mob: Mob): MobFullUpdateRow {
        row.push(
            mob.is_active ? 1 : 0,
            JSON.stringify(mob.pos_spawn),
            mob.drivingId ?? null
        );
        return row as unknown as MobFullUpdateRow
    }

    async bulkFullUpdate(rows: MobFullUpdateRow[]) {
        UPDATE.BULK_FULL = UPDATE.BULK_FULL ?? preprocessSQL(`
            UPDATE entity
            SET ${BULK_UPDATE_FIELDS}, is_active = %7, pos_spawn = %8, driving_id = %9
            FROM json_each(:jsonRows)
            WHERE entity.id = %0
        `);
        return rows.length ? run(this.conn, UPDATE.BULK_FULL, {
            ':jsonRows': JSON.stringify(rows)
        }).then(() => {
            for(const row of rows) {
                this._cacheMob(row[0], row[7], row[1], row[2], row[3]);
            }
        }) : null;
    }

    /** Upgrdaes {@link MobFullUpdateRow} to {@link MobInsertRow} by adding more data from a mob. */
    static upgradeRowToInsert(row: MobFullUpdateRow, mob: Mob): MobInsertRow {
        row.push(mob.entity_id, mob.skin.model_name, mob.skin.texture_name);
        return row as unknown as MobInsertRow
    }

    async bulkInsert(rows: MobInsertRow[], dt: int) {
        INSERT.BULK = INSERT.BULK ?? preprocessSQL(`
            INSERT INTO entity (
                id,
                x, y, z,
                indicators, extra_data, rotate,     -- common for all updates
                is_active, pos_spawn, driving_id,   -- included in a full update
                entity_id, type, skin, dt           -- insert only
            ) SELECT
                %0,
                %1, %2, %3,
                %4, %5, %6,
                %7, %8, %9,
                %10, %11, %12, :dt
            FROM json_each(:jsonRows)
        `);
        return rows.length ? run(this.conn, INSERT.BULK, {
            ':jsonRows': JSON.stringify(rows),
            ':dt': dt
        }).then(() => {
            for(const row of rows) {
                this._cacheMob(row[0], row[7], row[1], row[2], row[3]);
            }
        }) : null;
    }

    async bulkDelete(ids: int[]) {
        return ids.length ? run(this.conn,
            'DELETE FROM entity WHERE id IN (SELECT value FROM json_each(?))',
            [JSON.stringify(ids)]
        ).then(() => {
            for(const id of ids) {
                this._cacheMob(id, false);
            }
        }) : null;
    }

}