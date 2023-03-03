import { Vector, unixTime } from "@client/helpers.js";
import type { WorldPortal } from "@client/portal.js";
import type { ServerWorld } from "../../server_world.js";

export class DBWorldPortal {
    conn: DBConnection;
    world: ServerWorld;

    constructor(conn: DBConnection, world : ServerWorld) {
        this.conn = conn;
        this.world = world;
    }

    /**
     * Add new portal
     */
    async add(user_id : int, portal : WorldPortal) : Promise<int> {
        const result = await this.conn.run('INSERT INTO portal(user_id, dt, x, y, z, rotate, size, player_pos, portal_block_id, type, pair) VALUES(:user_id, :dt, :x, :y, :z, :rotate, :size, :player_pos, :portal_block_id, :type, :pair)', {
            ':dt':              unixTime(),
            ':user_id':         user_id,
            ':x':               portal.pos.x,
            ':y':               portal.pos.y,
            ':z':               portal.pos.z,
            ':rotate':          JSON.stringify(portal.rotate),
            ':size':            JSON.stringify(portal.size),
            ':player_pos':      JSON.stringify(portal.player_pos),
            ':portal_block_id': portal.portal_block_id,
            ':type':            portal.type,
            ':pair':            portal.pair ? JSON.stringify(portal.pair) : null
        });
        // lastID
        let lastID = result.lastID;
        if(!result.lastID) {
            const row = await this.conn.get('SELECT _rowid_ AS lastID FROM portal WHERE x = :x AND y = :y AND z = :z ORDER by _rowid_ DESC', {
                ':x':           portal.pos.x,
                ':y':           portal.pos.y,
                ':z':           portal.pos.z
            });
            lastID = row.lastID;
        }
        return lastID;
    }

    // Portal was deleted
    async delete(player, portal_id) {
        await this.conn.run('DELETE FROM portal WHERE _rowid_ = :portal_id', {
            ':portal_id': portal_id
        });
        return true;
    }

    /**
     * Return nearest portal for position
     */
    async search(pos: IVector, max_dist: number, type?: string) {
        const row = await this.conn.get(`WITH portals AS (SELECT _rowid_ as id, *, ((x - :x) * (x - :x) + (y - :y) * (y - :y) + (z - :z) * (z - :z)) as dist
        FROM portal
        WHERE (x > :x - :max_dist) AND (x < :x + :max_dist) AND (z > :z - :max_dist) AND (z < :z + :max_dist)
            AND ((x - :x) * (x - :x) + (y - :y) * (y - :y) + (z - :z) * (z - :z)) < :max_dist_sqr)
        SELECT * FROM portals ORDER BY dist ASC LIMIT 1`, {
            ':x': pos.x,
            ':y': pos.y,
            ':z': pos.z,
            ':max_dist': max_dist,
            ':max_dist_sqr': max_dist * max_dist
        });
        if(!row) {
            return null;
        }
        return this.formatPortalRow(row);
    }

    /**
     * Save portal pair
     * @param {*} pair
     */
    async setPortalPair(portal_id: int, pair) {
        await this.conn.run('UPDATE portal SET pair = :pair WHERE _rowid_ = :portal_id', {
            ':portal_id': portal_id,
            ':pair':      JSON.stringify(pair)
        });
    }

    /**
     * Return portal by ID
     */
    async getByID(portal_id: int) {
        const row = await this.conn.get(`SELECT _rowid_ as id, * FROM portal
        WHERE _rowid_ = :portal_id`, {
            ':portal_id': portal_id
        });
        if(!row) {
            return null;
        }
        return this.formatPortalRow(row);
    }

    /**
     * @param {*} row
     * @returns
     */
    formatPortalRow(row) {
        const pair = row.pair ? JSON.parse(row.pair) : null;
        if(pair) {
            pair.id = parseInt(pair.id);
            pair.player_pos = new Vector(pair.player_pos);
        }
        return {
            id:                 parseInt(row.id),
            portal_block_id:    parseInt(row.portal_block_id),
            pos:                new Vector(row.x, row.y, row.z),
            size:               JSON.parse(row.size),
            rotate:             new Vector(JSON.parse(row.rotate)),
            player_pos:         new Vector(JSON.parse(row.player_pos)),
            type:               row.type,
            pair:               pair
        };
    }

}