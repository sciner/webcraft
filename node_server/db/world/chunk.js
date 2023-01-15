import { BLOCK } from "../../../www/js/blocks.js";
import { Vector, unixTime, getChunkAddr } from "../../../www/js/helpers.js";
import { KNOWN_CHUNK_FLAGS } from "../world/WorldDBActor.js"
import { decompressWorldModifyChunk } from "../../../www/js/compress/world_modify_chunk.js";
import { BulkSelectQuery, preprocessSQL } from "../db_helpers.js";

// It contains queries dealing with chunks. It doesn't contain logic.
export class DBWorldChunk {

    constructor(conn, world) {
        this.conn = conn;
        this.world = world;

        this.bulkGetWorldModifyChunk = new BulkSelectQuery(this.conn,
            // We don't return has_data_blob field, because the row may have been manually edited.
            // It's more realible to look at data_blob itself.
            `WITH cte AS (SELECT value FROM json_each(:jsonRows))
            SELECT
                CASE WHEN data_blob IS NULL THEN data ELSE data_blob END data,
                private_data_blob,
                CASE WHEN data_blob IS NULL THEN 0 ELSE 1 END has_data_blob,
                world_modify_chunks._rowid_ rowId
            FROM cte LEFT JOIN world_modify_chunks ON x = %0 AND y = %1 AND z = %2`
        );
    }

    async getWorldModifyCount() {
        return (await this.conn.get('SELECT COUNT(*) c FROM world_modify')).c;
    }

    /**
     * @param {Array of Array} data [chunk_x, chunk_y, chunk_z, "index"]
     * @return {Array of Object} { rowId: ?Int } - the same size as {@link data}
     */
    async bulkSelectWorldModifyRowId(data) {
        return this.conn.all(this.BULK_SELECT_WM_ROW_ID, [JSON.stringify(data)]);
    }
    BULK_SELECT_WM_ROW_ID = preprocessSQL(`
        SELECT 
            (SELECT MAX(world_modify._rowId_)
            FROM world_modify
            WHERE chunk_x = %0 AND chunk_y = %1 AND chunk_z = %2 AND "index" = %3
            ) rowId
        FROM json_each(?)
    `);

    /**
     * @param {Block} item
     * @yields fields of worlds_modify { params, entity_id, extra_data, block_id }
     */
    *_itemWMFields(item) {
        yield BLOCK.fastStringify(item);
        yield item.entity_id ?? null;
        yield item.extra_data ? JSON.stringify(item.extra_data) : null;
        yield item.id;
    }

    /**
     * @param {Array of Objects} rows { ?user_id, pos, item, ?chunk_addr, ?index }
     *   Provide optional chunk_addr and index only if they already calculated to avoid calculating them again.
     *   Index is flat chunk index.
     * @param {Number} dt
     * @param {Number} user_id - used if rows[i].user_id is null.
     */
    async bulkInsertWorldModify(rows, dt = unixTime(), user_id = null) {
        const jsonRows = rows.map(row => {
            const chunk_addr = row.chunk_addr ?? getChunkAddr(row.pos, tmpAddr);
            const index = row.index ?? tmpVector.copyFrom(row.pos).getFlatIndexInChunk();
            return [
                row.user_id ?? user_id,
                row.pos.x, row.pos.y, row.pos.z,
                ...this._itemWMFields(row.item),
                chunk_addr.x, chunk_addr.y, chunk_addr.z, index
            ];
        });
        return this.conn.run(this.BULK_INSERT_WM, {
            ':jsonRows': JSON.stringify(jsonRows),
            ':world_id': this.world.info.id,
            ':dt': dt
        });
    };
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

    /**
     * @param {Array of Object} rows {rowId: Int, item: Object}
     * @param {Number} dt
     */
    async bulkUpdateWorldModify(rows, dt = unixTime()) {
        const jsonRows = rows.map(row => [
            row.rowId,
            ...this._itemWMFields(row.item)
        ]);
        return this.conn.run(this.BULK_UPDATE_WM, {
            ':jsonRows': JSON.stringify(jsonRows),
            ':dt': dt
        });
    }
    BULK_UPDATE_WM = preprocessSQL(`
        UPDATE world_modify
        SET dt = :dt, params = %1, entity_id = %2, extra_data = %3, block_id = %4
        FROM json_each(:jsonRows)
        WHERE world_modify._rowid_ = %0
    `);

    async bulkUpdateWorldModifyExtraData(rows, dt = unixTime()) {
        const jsonRows = rows.map(row => [row.rowId, row.item.extra_data]);
        return this.conn.run(this.BULK_UPDATE_WM_EXTRA_DATA, {
            ':jsonRows': JSON.stringify(jsonRows),
            ':dt': dt
        });
    }
    BULK_UPDATE_WM_EXTRA_DATA = preprocessSQL(`
        UPDATE world_modify
        SET dt = :dt, extra_data = %1
        FROM json_each(:jsonRows)
        WHERE world_modify._rowid_ = %0
    `);

    /**
     * Unpacks all modifiers from world_modify_chunk into world_modify.
     * It can be optimized, e.g.:
     *  - read compressed data
     *  - don't create the intermediate array of data to be inserted
     *  - drop the table indices, insert, then create indices
     */
    async unpackAllChunkModifiers() {

        const BATCH_SIZE = 1000; // load limited number of chunks a once to not run out of memory

        const chunksCount = await this.getWorldModifyChunksCount();
        const blocks = [];
        for(let i = 0; i < chunksCount; i += BATCH_SIZE) {
            console.log(`  processing chunks ${i}..${Math.min(i + BATCH_SIZE, chunksCount) - 1} out of ${chunksCount}...`);
            const rows = await this.conn.all(`SELECT x, y, z, data
                FROM world_modify_chunks
                LIMIT ? OFFSET ?`,
                [BATCH_SIZE, i]
            );
            let invalidChunks = 0;
            for(const row of rows) {
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

    async getWorldModifyChunksCount() {
        return (await this.conn.get('SELECT COUNT(*) c FROM world_modify_chunks')).c;
    }

    /**
     * For all chunks that have records in world_modify_chunks, sets flags
     * KNOWN_CHUNK_FLAGS.WORLD_MODIFY_CHUNKS | KNOWN_CHUNK_FLAGS.MODIFIED_BLOCKS
     * in this.world.dbActor.knownChunkFlags
     */
    async restoreModifiedChunks() {
        const flags = KNOWN_CHUNK_FLAGS.WORLD_MODIFY_CHUNKS | KNOWN_CHUNK_FLAGS.MODIFIED_BLOCKS;
        const rows = await this.conn.all('SELECT x, y, z FROM world_modify_chunks');
        for(let row of rows) {
            this.world.dbActor.addKnownChunkFlags(row, flags);
        }
    }
    
    /**
     * @param {Vector} addr
     * @return {Object} { 
     *  obj: Object             // uncompressed modifiers, guaranteed to be not null
     *  compressed: ?Uint8Array  // compressed public modifiers
     *  private_compressed: ?Uint8Array  // compressed private modifiers
     *  exists: Boolean         // true if the record exists
     * }
     */
    async getChunkModifiers(addr) {
        const resp = {
            obj: null,
            compressed: null,
            private_compressed: null,
            rowId: null
        };
        // We don't return has_data_blob field, because the row may have been manually edited.
        // It's more realibel to look at the data.
        const row = await this.conn.get(`
            SELECT CASE WHEN data_blob IS NULL THEN data ELSE data_blob END data,
                private_data_blob,
                CASE WHEN data_blob IS NULL THEN 0 ELSE 1 END has_data_blob,
                _rowid_ rowId
            FROM world_modify_chunks
            WHERE x = ? AND y = ? AND z = ?`,
            addr.toArray()
        );
        if (row) {
            resp.rowId = row.rowId; // If we select "_rowid_", it's also returned as "rowid". So select "rowId" to avoid confusion.
            resp.has_data_blob = row.has_data_blob
            if (resp.has_data_blob) {
                resp.compressed = row.data;
                resp.private_compressed = row.private_data_blob;
                resp.obj = decompressWorldModifyChunk(resp.compressed);
                if (resp.private_compressed) {
                    const private_obj = decompressWorldModifyChunk(resp.private_compressed);
                    Object.assign(resp.obj, private_obj);
                }
            } else if (row.data) {
                resp.obj = JSON.parse(row.data);
            } else {
                // It's been tampered with. The game never deletes uncompressed data.
                // Maybe someone wanted to manually reset modifiers?
                // Re-calculated them based on the log, then repeat the attepmt.
                await this.updateRebuildModifiersByRowIds([row.rowId]);
                return this.getChunkModifiers(addr);
            }
        } else {
            // It's been tampered with. See the comment above.
            await this.insertRebuildModifiers([addr]);
            return this.getChunkModifiers(addr);
        }
        return resp;
    }

    /**
     * @param {Vector-like} addr
     * @param {String} data_patch - stringified object with keys = flat indexes, and values = items
     * @param {?Buffer} data_blob
     * @param {?Buffer} private_data_blob
     * @param {Number|false} rowId - it can be:
     *  - false (we know that the record doesn't exist)
     *  - Number - the known rowId
     * @return {Number} rowId of the record
     */
    async updateOrInsertChunkModifiers(addr, data_patch, data_blob, private_data_blob, rowId) {

        const that = this;
        async function getRowId() {
            return await that.conn.get('SELECT _rowid_ FROM world_modify_chunks WHERE x = ? AND y = ? AND z = ?',
                addr.toArray());
        }

        const params = {
            ':data_patch':          data_patch,
            ':data_blob':           data_blob,
            ':private_data_blob':   private_data_blob,
            ':has_data_blob':       data_blob ? 1 : 0
        };
        if (typeof rowId !== 'number' && rowId !== false) {
            throw new Error("typeof rowId !== 'number' && rowId !== false");
        }
        if (rowId) {
            params[':rowId'] = rowId;
            const result = await this.conn.run(`UPDATE world_modify_chunks SET
                    data = json_patch(data, :data_patch),
                    data_blob = :data_blob,
                    private_data_blob = :private_data_blob,
                    has_data_blob = :has_data_blob
                WHERE _rowid_ = :rowId`, params);
            if (result.changes) {
                return rowId; // it updated successfully
            }
            // It's in a browser, or the fields didn't change (which is unlikely), or the record was deleted while the game was running.
            rowId = await getRowId();
            if (rowId) {
                return rowId; // it updated properly, no need to anything else
            }
            // it doesn't exist - insert it
            delete params[':rowId'];
        }
        // insert
        params[':x'] = addr.x;
        params[':y'] = addr.y;
        params[':z'] = addr.z;
        const result = await this.conn.run(`INSERT OR REPLACE INTO world_modify_chunks (x, y, z, data, data_blob, private_data_blob, has_data_blob)
            VALUES (:x, :y, :z, :data_patch, :data_blob, :private_data_blob, :has_data_blob)`, params);
        // return rowId both node.js and in a browser
        return result.lastID ?? await getRowId();
    }

    /**
     * Rebuilds modifiers in existing chunks.
     * @param {Array of Int} rowIds
     */
    async updateRebuildModifiersByRowIds(rowIds) {
        return this.conn.run(this.UPDATE_REBUILD_MODIFIERS_BY_ROWID, [JSON.stringify(rowIds)]);
    }
    /**
     * Rebuilds modifiers in existing chunks.
     * @param {Array of Arrays} XYZs [x, y, z]
     */
    async updateRebuildModifiersByXYZs(XYZs) {
        return this.conn.run(this.UPDATE_REBUILD_MODIFIERS_BY_XYZ, [JSON.stringify(XYZs)]);
    }
    REBUILD_MODIFIERS_SUBQUERY =
        `json_group_object(
            cast(m."index" as TEXT),
            json_patch(
                'null',
                json_object(
                    'id',           COALESCE(m.block_id, 0),
                    'extra_data',   json(m.extra_data),
                    'entity_id',    m.entity_id,
                    'ticks',        m.ticks,
                    'rotate',       json_extract(m.params, '$.rotate')
                )
            )
        )`;
    UPDATE_REBUILD_MODIFIERS_BASE =
        `UPDATE world_modify_chunks
        SET data = (SELECT ${this.REBUILD_MODIFIERS_SUBQUERY} FROM world_modify m
                WHERE m.chunk_x = world_modify_chunks.x AND m.chunk_y = world_modify_chunks.y AND m.chunk_z = world_modify_chunks.z
                ORDER BY m.id ASC),
            data_blob = NULL,
            private_data_blob = NULL,
            has_data_blob = 0
        FROM json_each(?)`;
    UPDATE_REBUILD_MODIFIERS_BY_ROWID = preprocessSQL(`
        ${this.UPDATE_REBUILD_MODIFIERS_BASE} WHERE world_modify_chunks._rowid_ = value
    `);
    UPDATE_REBUILD_MODIFIERS_BY_XYZ = preprocessSQL(`
        ${this.UPDATE_REBUILD_MODIFIERS_BASE} WHERE x = %0 AND y = %1 AND z = %2
    `);

    /**
     * Inserts rebuilt records in world_modify_chunks, either all or selected addresses.
     * @param {Array of {x, y, z}} addresses - optional.
     *   If we need to rebuild all chunks, providing the list of all addresses increases speed.
     */
    async insertRebuildModifiers(addresses = null) {
        if (addresses) {
            const jsonRows = addresses.map(addr => addr.toArray());
            return this.conn.run(this.INSERT_REBUILD_MODIFIERS_BY_XYZ, [JSON.stringify(jsonRows)]);
        } else {
            return this.conn.run(this.INSERT_REBUILD_MODIFIERS_ALL);
        }
    }
    INSERT_REBUILD_MODIFIERS_BASE =
        `INSERT INTO world_modify_chunks(
            x, y, z,
            data,
            data_blob, private_data_blob, has_data_blob
        ) SELECT
            _x, _y, _z,
            (SELECT ${this.REBUILD_MODIFIERS_SUBQUERY} FROM world_modify m
                WHERE m.chunk_x = _x AND m.chunk_y = _y AND m.chunk_z = _z
                ORDER BY m.id ASC),
            NULL, NULL, 0`;
    INSERT_REBUILD_MODIFIERS_ALL = preprocessSQL(`
        ${this.INSERT_REBUILD_MODIFIERS_BASE}
        FROM (SELECT DISTINCT chunk_x _x, chunk_y _y, chunk_z _z FROM world_modify)
    `);
    INSERT_REBUILD_MODIFIERS_BY_XYZ = preprocessSQL(`
        ${this.INSERT_REBUILD_MODIFIERS_BASE}
        FROM (SELECT %0 _x, %1 _y, %2 _z FROM json_each(:jsonRows))
    `);
}

const tmpVector = new Vector();
const tmpAddr = new Vector();