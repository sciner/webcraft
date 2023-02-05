import { Vector, unixTime, getChunkAddr } from "../../../www/js/helpers.js";
import { WorldChunkFlags } from "./WorldChunkFlags.js";
import { decompressModifiresList } from "../../../www/js/compress/world_modify_chunk.js";
import { BulkSelectQuery, preprocessSQL, runBulkQuery, all, get, run } from "../db_helpers.js";

const tmpVector = new Vector();
const tmpAddr = new Vector();

// It contains queries dealing with chunks. It doesn't contain logic.
export class DBWorldChunk {

    static REBUILD_MODIFIERS_SUBQUERY =
        `json_group_object(
            m."index",
            json_patch(     -- to remove nulls from the result object
                'null',
                json_object(
                    'id',           COALESCE(m.block_id, 0),
                    'extra_data',   json(m.extra_data),
                    'entity_id',    m.entity_id,
                    'ticks',        m.ticks,        -- it's always NULL, unused, maybe remove it?
                    'rotate',       json_extract(m.params, '$.rotate')
                )
            )
        )`;

    static UPDATE_REBUILD_MODIFIERS_DATA_ONLY =
        `UPDATE world_modify_chunks
        SET data =
            (SELECT ${DBWorldChunk.REBUILD_MODIFIERS_SUBQUERY} FROM
                (SELECT * FROM
                    (SELECT "index", block_id, extra_data, entity_id, ticks, params
                    FROM world_modify m
                    WHERE m.chunk_x = world_modify_chunks.x AND m.chunk_y = world_modify_chunks.y AND m.chunk_z = world_modify_chunks.z
                    ORDER BY m.id DESC)     -- ensure the last change for each block is used
                GROUP BY "index") m         -- ensure the result has no duplicate keys
            )`;

    BULK_SELECT_WM_ROW_ID = preprocessSQL(`
        SELECT 
            (SELECT MAX(world_modify._rowId_)
            FROM world_modify
            WHERE chunk_x = %0 AND chunk_y = %1 AND chunk_z = %2 AND "index" = %3
            ) rowId
        FROM json_each(?)
    `);

    BULK_INSERT_WM = preprocessSQL(`
        INSERT INTO world_modify (
            user_id, world_id, dt,
            x, y, z, 
            params, entity_id, extra_data, block_id,
            chunk_x, chunk_y, chunk_z, "index"
        ) SELECT
            %0, :world_id, :dt,
            %1, %2, %3,
            %4, %5, %6, %7,
            %8, %9, %10, %11
        FROM json_each(:jsonRows)
    `);

    BULK_UPDATE_WM = preprocessSQL(`
        UPDATE world_modify
        SET dt = :dt, params = %1, entity_id = %2, extra_data = %3, block_id = %4
        FROM json_each(:jsonRows)
        WHERE world_modify._rowid_ = %0
    `);

    BULK_UPDATE_WM_EXTRA_DATA = preprocessSQL(`
        UPDATE world_modify
        SET dt = :dt, extra_data = %1
        FROM json_each(:jsonRows)
        WHERE world_modify._rowid_ = %0
    `);

    BULK_UPDATE_WMC =
        `UPDATE world_modify_chunks
        SET data = json_patch(data, %0),
            data_blob = NULL,
            private_data_blob = NULL,
            has_data_blob = 0
        FROM json_each(?)`;

    BULK_UPDATE_WMC_BY_ID = preprocessSQL(`
        ${this.BULK_UPDATE_WMC}
        WHERE world_modify_chunks._rowid_ = %1
    `);

    BULK_UPDATE_WMC_BY_ADDR = preprocessSQL(`
        ${this.BULK_UPDATE_WMC}
        WHERE x = %1 AND y = %2 AND z = %3
    `);

    UPDATE_REBUILD_MODIFIERS =
        `${DBWorldChunk.UPDATE_REBUILD_MODIFIERS_DATA_ONLY},
            data_blob = NULL,
            private_data_blob = NULL,
            has_data_blob = 0`;

    UPDATE_REBUILD_MODIFIERS_BY_ROWID = preprocessSQL(`
        ${this.UPDATE_REBUILD_MODIFIERS}
        FROM json_each(?) WHERE world_modify_chunks._rowid_ = value
    `);

    UPDATE_REBUILD_MODIFIERS_BY_XYZ = preprocessSQL(`
        ${this.UPDATE_REBUILD_MODIFIERS}
        FROM json_each(?) WHERE x = %0 AND y = %1 AND z = %2
    `);

    INSERT_REBUILD_MODIFIERS_BASE =
        `INSERT INTO world_modify_chunks(
            x, y, z,
            data,
            data_blob, private_data_blob, has_data_blob
        ) SELECT
            _x, _y, _z,
            (SELECT ${DBWorldChunk.REBUILD_MODIFIERS_SUBQUERY} FROM
                (SELECT * FROM
                    (SELECT "index", block_id, extra_data, entity_id, ticks, params
                    FROM world_modify m
                    WHERE m.chunk_x = _x AND m.chunk_y = _y AND m.chunk_z = _z
                    ORDER BY m.id DESC)
                GROUP BY "index") m     -- see the comments in the similar code above
            ),
            NULL, NULL, 0`;

    INSERT_REBUILD_MODIFIERS_ALL = preprocessSQL(`
        ${this.INSERT_REBUILD_MODIFIERS_BASE}
        FROM (SELECT DISTINCT chunk_x _x, chunk_y _y, chunk_z _z FROM world_modify)
    `);

    INSERT_REBUILD_MODIFIERS_BY_XYZ = preprocessSQL(`
        ${this.INSERT_REBUILD_MODIFIERS_BASE}
        FROM (SELECT %0 _x, %1 _y, %2 _z FROM json_each(:jsonRows))
    `);

    BULK_INSERT_CHUNK = preprocessSQL(`
        INSERT INTO chunk (addr, dt, mobs_is_generated, delayed_calls)
        SELECT %0, :dt, %1, %2
        FROM json_each(:jsonRows)
    `);

    BULK_UPDATE_CHUNK = preprocessSQL(`
        UPDATE chunk
        SET dt = :dt, mobs_is_generated = %1, delayed_calls = %2
        FROM json_each(:jsonRows)
        WHERE addr = %0
    `);

    constructor(conn, world) {
        this.conn = conn;
        this.world = world;

        this.bulkGetWorldModifyChunkQuery = new BulkSelectQuery(this.conn,
            `WITH cte AS (SELECT value FROM json_each(:jsonRows))
            SELECT
                CASE WHEN data_blob IS NULL THEN data ELSE NULL END obj,
                data_blob AS compressed,
                private_data_blob AS private_compressed,
                world_modify_chunks._rowid_ rowId
            FROM cte LEFT JOIN world_modify_chunks ON x = %0 AND y = %1 AND z = %2`,
            null,
            row => row.rowId
        );

        this.bulkGetChunkQuery = new BulkSelectQuery(this.conn,
            `WITH cte AS (SELECT value FROM json_each(:jsonRows))
            SELECT (addr IS NOT NULL) "exists", mobs_is_generated, delayed_calls
            FROM cte LEFT JOIN chunk ON addr = value`,
            null,
            row => row.exists
        );
    }

    // ================================ world_modify ==================================

    async getWorldModifyCount() {
        return (await this.conn.get('SELECT COUNT(*) c FROM world_modify')).c;
    }

    /**
     * @param {Array of Array} data [chunk_x, chunk_y, chunk_z, "index"]
     * @return {Array of Object} { rowId: ?Int } - the same size as {@link data}
     */
    async bulkSelectWorldModifyRowId(data) {
        return all(this.conn, this.BULK_SELECT_WM_ROW_ID, [JSON.stringify(data)]);
    }

    /**
     * @param {Block} item
     * @yields fields of worlds_modify { params, entity_id, extra_data, block_id }
     */
    *_itemWMFields(item) {
        yield this.world.block_manager.fastStringify(item);
        yield item.entity_id ?? null;
        yield item.extra_data ? JSON.stringify(item.extra_data) : null;
        yield item.id;
    }

    /**
     * @param {Array of Objects} rows { ?user_id, pos, item, ?chunk_addr }
     *   Provide optional chunk_addr only if it's already calculated to avoid calculating it again.
     * @param {Number} dt
     * @param {Number} user_id - used if rows[i].user_id is null.
     */
    async bulkInsertWorldModify(rows, dt = unixTime(), user_id = null) {
        const jsonRows = rows.map(row => {
            const chunk_addr = row.chunk_addr ?? getChunkAddr(row.pos, tmpAddr);
            const index = tmpVector.copyFrom(row.pos).getFlatIndexInChunk();
            return [
                row.user_id ?? user_id,
                row.pos.x, row.pos.y, row.pos.z,
                ...this._itemWMFields(row.item),
                chunk_addr.x, chunk_addr.y, chunk_addr.z, index
            ];
        });
        return run(this.conn, this.BULK_INSERT_WM, {
            ':jsonRows': JSON.stringify(jsonRows),
            ':world_id': this.world.info.id,
            ':dt': dt
        });
    }

    /**
     * @param {Array of Object} rows {rowId: Int, item: Object}
     * @param {Number} dt
     */
    async bulkUpdateWorldModify(rows, dt) {
        const jsonRows = rows.map(row => [
            row.rowId,
            ...this._itemWMFields(row.item)
        ]);
        return run(this.conn, this.BULK_UPDATE_WM, {
            ':jsonRows': JSON.stringify(jsonRows),
            ':dt': dt
        });
    }

    async bulkUpdateWorldModifyExtraData(rows, dt) {
        const jsonRows = rows.map(row => [row.rowId, row.item.extra_data]);
        return run(this.conn, this.BULK_UPDATE_WM_EXTRA_DATA, {
            ':jsonRows': JSON.stringify(jsonRows),
            ':dt': dt
        });
    }

    /** Deletes all recordes from world_modify from for the given chunk except the latest record for each block. */
    async cleanupWorldModify(chunk_addr) {
        await run(this.conn,
            `WITH cte AS (
                SELECT max_id, cx, cy, cz, i FROM (
                    SELECT MAX(id) max_id, COUNT(id) cnt, cx, cy, cz, i
                    FROM ( 
                        SELECT id, chunk_x cx, chunk_y cy, chunk_z cz, "index" i
                        FROM world_modify
                        WHERE chunk_x = ? AND chunk_y = ? AND chunk_z = ?
                        ORDER BY id DESC
                    ) GROUP BY "index"
                ) WHERE cnt > 1
            ) DELETE
            FROM world_modify
            WHERE id IN (
                SELECT id
                FROM cte INNER JOIN world_modify ON chunk_x = cx AND chunk_y = cy AND chunk_z = cz AND "index" = i
                WHERE id != max_id
            )`, chunk_addr.toArray());
    }

    // =============================== world_modify_chunks ================================

    async getWorldModifyChunksCount() {
        return (await this.conn.get('SELECT COUNT(*) c FROM world_modify_chunks')).c;
    }

    /**
     * For all chunks that have records in world_modify_chunks, sets flags
     * WorldChunkFlags.DB_WORLD_MODIFY_CHUNKS | WorldChunkFlags.MODIFIED_BLOCKS
     * in this.world.dbActor.knownChunkFlags
     */
    async restoreModifiedChunks() {
        const rows = await this.conn.all('SELECT x, y, z FROM world_modify_chunks');
        this.world.worldChunkFlags.bulkAdd(rows, WorldChunkFlags.DB_WORLD_MODIFY_CHUNKS | WorldChunkFlags.MODIFIED_BLOCKS);
    }

    static toUpdateWorldModifyChunksWithBLOBs(rowId, data_patch, ml) {
        return [
            rowId,
            JSON.stringify(data_patch),
            ml.compressed ?? null,
            ml.private_compressed ?? null
        ];
    }

    async bulkUpdateChunkModifiersWithBLOBs(rows) {
        return runBulkQuery(this.conn,
            'WITH cte (_rowid, data_patch, compr, priv_compr) AS (VALUES',
            '(?,?,?,?)',
            `)UPDATE world_modify_chunks
            SET data = json_patch(data, data_patch),
                data_blob = compr,
                private_data_blob = priv_compr,
                has_data_blob = CASE WHEN compr IS NULL THEN 0 ELSE 1 END
            FROM cte
            WHERE world_modify_chunks._rowid_ = cte._rowid`,
            rows
        );
    }

    static toUpdateWorldModifyChunksRowById(data_patch, rowId) {
        return [JSON.stringify(data_patch), rowId];
    }

    /**
     * We can't extract BLOB from JSON, so it's only suitable for chunks without
     * compressed modifiers.
     */
    async bulkUpdateWorldModifyChunksById(rows) {
        return rows.length
            ? run(this.conn, this.BULK_UPDATE_WMC_BY_ID, [JSON.stringify(rows)])
            : null;
    }

    static toUpdateWorldModifyChunksRowByAddr(data_patch, addr) {
        return [JSON.stringify(data_patch), addr.x, addr.y, addr.z];
    }

    async bulkUpdateWorldModifyChunksByAddr(rows) {
        return rows.length
            ? run(this.conn, this.BULK_UPDATE_WMC_BY_ADDR, [JSON.stringify(rows)])
            : null;
    }

    /**
     * @param {Vector-like} addr
     * @param {Object} data_patch - object with keys = flat indexes, and values = items
     * @param {binary} compressed
     * @param {binary} private_compressed
     * @return {Number} rowId of the new record
     */
    async insertChunkModifiers(addr, data_patch, compressed = null, private_compressed = null) {
        const result = await run(this.conn, `INSERT OR REPLACE INTO world_modify_chunks (x, y, z, data, data_blob, private_data_blob, has_data_blob)
            VALUES (:x, :y, :z, :data_patch, :data_blob, :private_data_blob, :has_data_blob)`, {
            ':x':                   addr.x,
            ':y':                   addr.y,
            ':z':                   addr.z,
            ':data_patch':          JSON.stringify(data_patch),
            ':data_blob':           compressed ?? null,
            ':private_data_blob':   private_compressed ?? null,
            ':has_data_blob':       compressed ? 1 : 0
        });
        return result.lastID
            // If it's in a browser, select rowId
            ?? get(that.conn, 'SELECT _rowid_ FROM world_modify_chunks WHERE x = ? AND y = ? AND z = ?', addr.toArray());
    }

    // ========================= world_modfy <=> world_modify_chunks =======================

    /**
     * Unpacks all modifiers from world_modify_chunk into world_modify.
     * It can be optimized, e.g.:
     *  - don't create the intermediate array of data to be inserted
     *  - drop the table indices, insert, then create indices
     */
    async unpackAllChunkModifiers() {

        const BATCH_SIZE = 1000; // load limited number of chunks a once to not run out of memory

        const chunksCount = await this.getWorldModifyChunksCount();
        const blocks = [];
        for(let i = 0; i < chunksCount; i += BATCH_SIZE) {
            console.log(`  processing chunks ${i}..${Math.min(i + BATCH_SIZE, chunksCount) - 1} out of ${chunksCount}...`);
            const rows = await this.conn.all(`SELECT
                    x, y, z,
                    CASE WHEN data_blob IS NULL THEN data ELSE NULL END obj,
                    data_blob AS compressed,
                    private_data_blob AS private_compressed
                FROM world_modify_chunks
                LIMIT ? OFFSET ?`,
                [BATCH_SIZE, i]
            );
            let invalidChunks = 0;
            for(const row of rows) {
                decompressModifiresList(row);
                if (!row.data) {
                    invalidChunks++;
                    continue; // this chunk is invalid :( Can't do anyhing about it
                }
                const modifiers = JSON.parse(row.data);
                const addr = new Vector(row);
                for(const key in modifiers) {
                    const index = parseFloat(key);
                    blocks.push({ 
                        pos: new Vector().fromFlatChunkIndex(index),
                        addr,
                        index,
                        item: modifiers[key]
                    });
                }
            }
            await this.bulkInsertWorldModify(blocks);
            console.log(`    ${blocks.length} modifiers unpacked`);
            invalidChunks && console.warn(`    ${invalidChunks} chunks with null data`);
            blocks.length = 0;
        }
    }

    /**
     * Rebuilds existing records world_modify_chunks based on world_modify.
     * @param {Array of Int} rowIds
     */
    async updateRebuildModifiersByRowIds(rowIds) {
        return rowIds.length
            ? await run(this.conn, this.UPDATE_REBUILD_MODIFIERS_BY_ROWID, [JSON.stringify(rowIds)])
            : null;
    }
    /**
     * Rebuilds existing records world_modify_chunks based on world_modify.
     * @param {Array of Arrays} XYZs [x, y, z]
     */
    async updateRebuildModifiersByXYZ(XYZs) {
        return XYZs.length
            ? await run(this.conn, this.UPDATE_REBUILD_MODIFIERS_BY_XYZ, [JSON.stringify(XYZs)])
            : null;
    }

    /**
     * Inserts rebuilt records into world_modify_chunks, either all or selected addresses.
     * @param {Array of {x, y, z}} addresses - optional.
     *   If we need to rebuild all chunks, providing the list of all addresses increases speed.
     */
    async insertRebuildModifiers(addresses = null) {
        if (addresses) {
            const XYZs = addresses.map(addr => addr.toArray());
            return this.insertRebuildModifiersXYZ(XYZs);
        } else {
            return run(this.conn, this.INSERT_REBUILD_MODIFIERS_ALL);
        }
    }
    async insertRebuildModifiersXYZ(XYZs) {
        return XYZs.length
            ? await run(this.conn, this.INSERT_REBUILD_MODIFIERS_BY_XYZ, [JSON.stringify(XYZs)])
            : null;
    }

    // ================================== chunk ============================================

    async restoreChunks() {
        const worldChunkFlags = this.world.worldChunkFlags;
        const rows = await this.conn.all('SELECT addr FROM chunk');
        for(const row of rows) {
            tmpAddr.fromHash(row.addr);
            worldChunkFlags.add(tmpAddr, WorldChunkFlags.DB_CHUNK);
        }
    }

    async getChunkOfChunk(chunk) {
        const row = this.world.worldChunkFlags.has(chunk.addr, WorldChunkFlags.DB_CHUNK)
            && await this.bulkGetChunkQuery.get(chunk.addrHash);
        return row || { exists: false, mobs_is_generated: 0, delayed_calls: null };
    }

    async bulkInsertOrUpdateChunk(rows, dt) {
        if (!rows.length) {
            return;
        }
        const insertRows = [];
        const updateRows = [];
        for(const row of rows) {
            const list = row.exists ? updateRows : insertRows;
            list.push([
                row.chunk.addrHash,
                row.mobs_is_generated,
                row.chunk.delayedCalls.serialize()
            ]);
        }
        return Promise.all([
            insertRows.length && run(this.conn, this.BULK_INSERT_CHUNK, {
                ':jsonRows': JSON.stringify(insertRows),
                ':dt': dt
            }).then( () => {
                for(const row of rows) {
                    if (!row.exists) {
                        row.exists = true;
                        this.world.worldChunkFlags.add(row.chunk.addr, WorldChunkFlags.DB_CHUNK);
                    }
                }
            }),

            updateRows.length && run(this.conn, this.BULK_UPDATE_CHUNK, {
                ':jsonRows': JSON.stringify(updateRows),
                ':dt': dt
            }),
        ]);
    }

}