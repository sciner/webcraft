import { PLAYER_RADIUS } from "./constant.js";
import { AABB } from "./core/AABB.js";
import { Vector } from "./helpers.js";

export class AbstractPlayerManager {

    #world;

    constructor(world) {
        this.#world = world
        this.list = new Map()
    }

    /**
     * @param {Vector} vec 
     * @returns { object[] }
     */
    *eachContainingVec(vec) {
        const aabb = new AABB();
        for(const player of this.list.values()) {
            // on the client, isAlive doesn't work for player model
            if (player.sharedProps.isAlive) {
                aabb.setBottomHeightRadius(player.sharedProps.pos, player.height, PLAYER_RADIUS)
                if (aabb.containsVec(vec)) {
                    yield player
                }
            }
        }
    }

    /**
     * @yields all entries [user_id, player]
     */
    *all() {
        yield *this.list.entries();
    }

    /** @yields all players */
    *values() {
        yield *this.list.values();
    }

    get world() {
        return this.#world
    }

    /**
     * Return total player count
     * @returns {int}
     */
    get count() {
        return this.list.size
    }

    /**
     * Return player by following user_id
     * @param {int} user_id
     * @returns 
     */
    get(user_id) {
        return this.list.get(user_id) ?? null
    }

    /**
     * Return true if player exists by following user_id
     * @param {int} user_id 
     * @returns {boolean}
     */
    exists(user_id) {
        return this.list.has(user_id)
    }

    /**
     * Delete player from list by following user_id
     * @param {int} user_id 
     * @returns {boolean}
     */
    delete(user_id) {
        return this.list.delete(user_id)
    }

    /**
     * Return all players user_id array
     * @returns {int[]}
     */
    keys() {
        return Array.from(this.list.keys())
    }

}