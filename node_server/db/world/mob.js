import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../../www/js/chunk_const.js';
import { getChunkAddr, Vector, VectorCollector, unixTime } from '../../../www/js/helpers.js';
import { Mob } from "../../mob.js";

export class DBWorldMob {

    constructor(conn, world, getDefaultPlayerStats, getDefaultPlayerIndicators) {
        this.conn = conn;
        this.world = world;
        this.getDefaultPlayerStats = getDefaultPlayerStats;
        this.getDefaultPlayerIndicators = getDefaultPlayerIndicators;
        // init
        this.initChunksWithMobs();
    }

    chunkHasMobs(addr) {
        return this.chunks_with_mobs.has(addr);
    }

    //
    _cacheMob(entity_id, pos, is_active) {

        const old_chunk_addr = this._mobs.get(entity_id);
        const new_chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);

        // если моб уже в этом чанке, то ничего не делаем
        if(old_chunk_addr) {
            if(old_chunk_addr.equal(new_chunk_addr)) {
                return false;
            } else {
                // удалить из списка мобов старого чанка
                const old_list = this.chunks_with_mobs.get(old_chunk_addr);
                if(old_list && old_list.has(entity_id)) {
                    old_list.delete(entity_id);
                    if(old_list.size == 0) {
                        this.chunks_with_mobs.delete(old_chunk_addr);
                    }
                }
            }
        }

        // список мобов в чанке
        const list = this.chunks_with_mobs.get(new_chunk_addr) || new Map();

        // добавляем в чанк
        list.set(entity_id, true);
        this._mobs.set(entity_id, new_chunk_addr);

        if(list.size == 1) {
            this.chunks_with_mobs.set(new_chunk_addr, list);
        }

        return true;

    }

    // initChunksAddrWithMobs
    async initChunksWithMobs() {
        this.chunks_with_mobs = new VectorCollector();
        this._mobs = new Map();
        let rows = await this.conn.all(`SELECT entity_id, x, y, z, is_active /* DISTINCT
            cast(x / ${CHUNK_SIZE_X} as int) - (x / ${CHUNK_SIZE_X} < cast(x / ${CHUNK_SIZE_X} as int)) AS x,
            cast(y / ${CHUNK_SIZE_Y} as int) - (y / ${CHUNK_SIZE_Y} < cast(y / ${CHUNK_SIZE_Y} as int)) AS y,
            cast(z / ${CHUNK_SIZE_Z} as int) - (z / ${CHUNK_SIZE_Z} < cast(z / ${CHUNK_SIZE_Z} as int)) AS z
            */
        FROM entity`);
        for(let row of rows) {
            const pos = new Vector(row.x, row.y, row.z);
            this._cacheMob(row.entity_id, pos, row.is_active);
        }
    }

    // Load mobs
    async loadInChunk(addr, size) {
        const resp = new Map();
        if(!this.chunkHasMobs(addr)) {
            return resp;
        }
        // if(!globalThis.sdfgdhj) globalThis.sdfgdhj = 0;
        // console.log(++globalThis.sdfgdhj);
        const rows = await this.conn.all('SELECT * FROM entity WHERE is_active = 1 AND x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max', {
            ':x_min': addr.x * size.x,
            ':x_max': addr.x * size.x + size.x,
            ':y_min': addr.y * size.y,
            ':y_max': addr.y * size.y + size.y,
            ':z_min': addr.z * size.z,
            ':z_max': addr.z * size.z + size.z
        });
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

    // Activate mob
    async activateMob(entity_id, pos, rotate) {
        const result = await this.conn.run('UPDATE entity SET x = :x, y = :y, z = :z, is_active = 1, pos_spawn = :pos_spawn, rotate = :rotate WHERE entity_id = :entity_id', {
            ':x': pos.x,
            ':y': pos.y,
            ':z': pos.z,
            ':pos_spawn': JSON.stringify(pos),
            ':rotate': JSON.stringify(rotate),
            ':entity_id': entity_id
        });
        this._cacheMob(entity_id, pos);
    }

    // Create mob
    async create(params) {
        const entity_id = randomUUID();
        if(!('pos' in params)) {
            throw 'error_no_mob_pos';
        }
        const result = await this.conn.run('INSERT INTO entity(dt, entity_id, type, skin, indicators, rotate, x, y, z, pos_spawn, extra_data) VALUES(:dt, :entity_id, :type, :skin, :indicators, :rotate, :x, :y, :z, :pos_spawn, :extra_data)', {
            ':dt':              unixTime(),
            ':entity_id':       entity_id,
            ':type':            params.type,
            ':skin':            params.skin,
            ':indicators':      JSON.stringify(params.indicators),
            ':rotate':          JSON.stringify(params.rotate),
            ':pos_spawn':       JSON.stringify(params.pos),
            ':extra_data':      params.extra_data ? JSON.stringify(params.extra_data) : null,
            ':x':               params.pos.x,
            ':y':               params.pos.y,
            ':z':               params.pos.z
        });
        // lastID
        let lastID = result.lastID;
        if(!result.lastID) {
            const row = await this.conn.get('SELECT id AS lastID FROM entity WHERE entity_id = :entity_id', {
                ':entity_id': entity_id
            });
            lastID = row.lastID;
        }
        lastID = parseInt(lastID);
        //
        const resp = {
            id:         lastID,
            entity_id:  entity_id,
            pos_spawn:  params.pos.clone(),
            is_active:  true
        };
        this._cacheMob(entity_id, params.pos);
        return resp;
    }

    // Save mob state
    async save(mob) {
        const is_active = mob.is_active ? 1 : 0;
        await this.conn.run('UPDATE entity SET x = :x, y = :y, z = :z, indicators = :indicators, is_active = :is_active, extra_data = :extra_data WHERE id = :id', {
            ':x': mob.pos.x,
            ':y': mob.pos.y,
            ':z': mob.pos.z,
            ':id': mob.id,
            ':is_active': is_active,
            ':extra_data': JSON.stringify(mob.extra_data),
            ':indicators': JSON.stringify(mob.indicators)
        });
        this._cacheMob(mob.entity_id, mob.pos, is_active);
    }

    async delete(mob) {
        await this.conn.run('DELETE FROM entity WHERE id = ?', [mob.id]);
    }

    // chunkMobsIsGenerated...
    async chunkMobsIsGenerated(chunk_addr_hash) {
        let row = await this.conn.get("SELECT mobs_is_generated FROM chunk WHERE addr = :addr", {
            ':addr': chunk_addr_hash
        });
        if(!row) {
            return false;
        }
        return !!row['mobs_is_generated'];
    }

    // chunkMobsSetGenerated...
    async chunkMobsSetGenerated(chunk_addr_hash, mobs_is_generated) {
        const result = await this.conn.run('INSERT OR IGNORE INTO chunk(dt, addr, mobs_is_generated) VALUES (:dt, :addr, :mobs_is_generated)', {
            ':dt':                  unixTime(),
            ':addr':                chunk_addr_hash,
            ':mobs_is_generated':   mobs_is_generated
        });
        // It works both in single- and multi- player. In single, it always runs the update.
        if (!result.changes) {
            await this.conn.run('UPDATE chunk SET mobs_is_generated = :mobs_is_generated WHERE addr = :addr', {
                ':addr':                chunk_addr_hash,
                ':mobs_is_generated':   mobs_is_generated
            });
        }
    }

}