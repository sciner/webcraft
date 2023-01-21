import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../../www/js/chunk_const.js';
import { getChunkAddr, Vector, VectorCollector } from '../../../www/js/helpers.js';
import { Mob } from "../../mob.js";
import { BulkSelectQuery, preprocessSQL } from "../db_helpers.js";

export class DBWorldMob {

    constructor(conn, world, getDefaultPlayerStats, getDefaultPlayerIndicators) {
        this.conn = conn;
        this.world = world;
        this.getDefaultPlayerStats = getDefaultPlayerStats;
        this.getDefaultPlayerIndicators = getDefaultPlayerIndicators;

        this.bulkLoadActiveInVolumeQuery = new BulkSelectQuery(this.conn,
            `WITH cte AS (SELECT key, value FROM json_each(:jsonRows))
            SELECT cte.key, entity.*
            FROM cte, entity
            WHERE is_active = 1 AND x >= %0 AND x < %1 AND y >= %2 AND y < %3 AND z >= %4 AND z < %5`,
            'key'
        );
    }

    async init() {
        this.maxId = (await this.conn.get('SELECT id FROM entity ORDER BY id DESC LIMIT 1'))?.id ?? 0;
    }

    async getNextId() {
        return ++this.maxId;
    }

    /**
     * If the mob changed its chunk:
     *  - if is_active === true, adds to the conut of mobs in the new chunk
     *  - if the mob was in a chunk, queues decrement of mobs count in that old chunk
     * To actually decrement the mobs count, call {@link onWorldTransactionCommit}
     */
    _cacheMob(id, is_active, x = null, y = null, z = null) {

        const old_chunk_addr = this._addrByMobId.get(id);
        const new_chunk_addr = is_active && getChunkAddr(x, y, z, tmpAddr);

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
        const decrement = (n) => (--n > 0) ? n : null;
        for(const addr of this._previouslyOccupiedAddrs) {
            this._activeMobsInChunkCount.update(addr, decrement);
        }
        this._previouslyOccupiedAddrs.length = [];
    }

    // initChunksAddrWithMobs
    async initChunksWithMobs() {
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
            cast(x / ${CHUNK_SIZE_X} as int) - (x / ${CHUNK_SIZE_X} < cast(x / ${CHUNK_SIZE_X} as int)) AS x,
            cast(y / ${CHUNK_SIZE_Y} as int) - (y / ${CHUNK_SIZE_Y} < cast(y / ${CHUNK_SIZE_Y} as int)) AS y,
            cast(z / ${CHUNK_SIZE_Z} as int) - (z / ${CHUNK_SIZE_Z} < cast(z / ${CHUNK_SIZE_Z} as int)) AS z
            */
        FROM entity
        WHERE is_active = 1`);
        for(let row of rows) {
            this._cacheMob(row.id, true, row.x, row.y, row.z);
        }
    }

    // Load mobs
    // TODO optimize: merge volumes for adjacent chunks, then separate mobs into chunks on host
    async loadInChunk(chunk) {
        const resp = new Map();
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
        for(let row of rows) {
            const item = Mob.fromRow(this.world, row);
            resp.set(item.id, item);
        }
        return resp;
    }

    // Load mob
    async load(entity_id) {
        const rows = await this.conn.all('SELECT * FROM entity WHERE entity_id = :entity_id', {
            ':entity_id': entity_id
        });
        for(let row of rows) {
            return Mob.fromRow(this.world, row);
        }
        return null;
    }

    /** Returns a row that can be passed to {@link bulkUpdate} */
    static toUpdateRow(mob) {
        return [
            mob.id,
            mob.pos.x, mob.pos.y, mob.pos.z,
            JSON.stringify(mob.indicators),
            JSON.stringify(mob.extra_data),
            JSON.stringify(mob.rotate)
        ];
    }

    async bulkUpdate(rows) {
        return rows.length && this.conn.run(this.BULK_UPDATE, {
            ':jsonRows': JSON.stringify(rows)
        }).then(() => {
            for(const row of rows) {
                // we know active = true because this method called only for mobs that remain active
                this._cacheMob(row[0], true, row[1], row[2], row[3]);
            }
        });
    };
    BULK_UPDATE_FIELDS = 'x = %1, y = %2, z = %3, indicators = %4, extra_data = %5, rotate = %6'
    BULK_UPDATE = preprocessSQL(`
        UPDATE entity
        SET ${this.BULK_UPDATE_FIELDS}
        FROM json_each(:jsonRows)
        WHERE entity.id = %0
    `);

    /** Upgrdaes a result of {@link toUpdateRow} to a row that can be passed to {@link bulkFullUpdate} */
    static upgradeRowToFullUpdate(row, mob) {
        row.push(
            mob.is_active ? 1 : 0,
            JSON.stringify(mob.pos_spawn)
        );
    }

    async bulkFullUpdate(rows) {
        return rows.length && this.conn.run(this.BULK_FULL_UPDATE, {
            ':jsonRows': JSON.stringify(rows)
        }).then(() => {
            for(const row of rows) {
                this._cacheMob(row[0], row[7], row[1], row[2], row[3]);
            }
        });
    };
    BULK_FULL_UPDATE = preprocessSQL(`
        UPDATE entity
        SET ${this.BULK_UPDATE_FIELDS}, is_active = %7, pos_spawn = %8
        FROM json_each(:jsonRows)
        WHERE entity.id = %0
    `);

    /** Upgrdaes a result of {@link upgradeRowToFullUpdate} to a row that can be passed to {@link bulkInsert} */
    static upgradeRowToInsert(row, mob) {
        row.push(mob.entity_id, mob.type, mob.skin);
    }

    async bulkInsert(rows, dt) {
        return rows.length && this.conn.run(this.BULK_INSERT, {
            ':jsonRows': JSON.stringify(rows),
            ':dt': dt
        }).then(() => {
            for(const row of rows) {
                this._cacheMob(row[0], row[7], row[1], row[2], row[3]);
            }
        });
    };
    BULK_INSERT = preprocessSQL(`
        INSERT INTO entity (
            id,
            x, y, z,
            indicators, extra_data, rotate, -- common for all updates
            is_active, pos_spawn,            -- included in a full update
            entity_id, type, skin, dt       -- insert only
        ) SELECT
            %0,
            %1, %2, %3,
            %4, %5, %6,
            %7, %8,
            %9, %10, %11, :dt
        FROM json_each(:jsonRows)
    `);

    async bulkDelete(ids) {
        return ids.length && this.conn.run(
            'DELETE FROM entity WHERE id IN (SELECT value FROM json_each(?))',
            [JSON.stringify(ids)]
        ).then(() => {
            for(const id of ids) {
                this._cacheMob(id, false);
            }
        });
    };

}

const tmpAddr = new Vector();