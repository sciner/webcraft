import { Vector } from "../../../www/js/helpers.js";
import { WorldPortal } from "../../portal.js";

export class DBWorldPortal {

    constructor(conn, world) {
        this.conn = conn;
        this.world = world;
    }

    /**
     * Add new portal
     * @param {WorldPortal} portal 
     * @returns 
     */
    async add(user_id, portal) {
        const result = await this.conn.run('INSERT INTO portal(user_id, dt, x, y, z, rotate, size, player_pos, portal_block_id) VALUES(:user_id, :dt, :x, :y, :z, :rotate, :size, :player_pos, :portal_block_id)', {
            ':dt':              ~~(Date.now() / 1000),
            ':user_id':         user_id,
            ':x':               portal.pos.x,
            ':y':               portal.pos.y,
            ':z':               portal.pos.z,
            ':rotate':          JSON.stringify(portal.rotate),
            ':size':            JSON.stringify(portal.size),
            ':player_pos':      JSON.stringify(portal.player_pos),
            ':portal_block_id': portal.portal_block_id
        });
        // lastID
        let lastID = result.lastID;
        if(!lastID) {
            const row = await this.conn.get('SELECT _rowid_ AS lastID FROM portal WHERE x = :x AND y = :y AND z = :z ORDER by _rowid_ DESC', {
                ':x':           portal.pos.x,
                ':y':           portal.pos.y,
                ':z':           portal.pos.z
            });
            lastID = row.lastID;
        }
        lastID = parseInt(lastID);
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
     * Return nearest to pos portal
     * @param {Object} pos 
     * @param {number} max_dist 
     * @returns 
     */
    async search(pos, max_dist) {
        const row = await this.conn.get(`WITH portals AS (SELECT _rowid_ as id, *, sqrt((x - :x) * (x - :x) + (y - :y) * (y - :y) + (z - :z) * (z - :z)) as dist
        FROM portal
        WHERE sqrt((x - :x) * (x - :x) + (y - :y) * (y - :y) + (z - :z) * (z - :z)) < :max_dist)
        SELECT * FROM portals ORDER BY dist ASC LIMIT 1`, {
            ':x': pos.x,
            ':y': pos.y,
            ':z': pos.z,
            ':max_dist': max_dist
        });
        if(!row) {
            return null;
        }
        return {
            id:                 parseInt(row.id),
            portal_block_id:    parseInt(row.portal_block_id),
            pos:                new Vector(row.x, row.y, row.z),
            size:               new Vector(JSON.parse(row.size)),
            rotate:             new Vector(JSON.parse(row.rotate)),
            player_pos:         new Vector(JSON.parse(row.player_pos))
        };
    }

}