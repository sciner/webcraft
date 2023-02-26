import { PLAYER_RADIUS } from "./constant.js";
import { AABB } from "./core/AABB.js";
import type { Vector } from "./helpers.js";

export class AbstractPlayerManager<WorldT extends IWorld, PlayerT extends IPlayerOrModel> {

    #world: WorldT
    list: Map<int, PlayerT>

    constructor(world: WorldT) {
        this.#world = world
        this.list = new Map()
    }

    *eachContainingVec(vec: IVector): IterableIterator<PlayerT> {
        const aabb = new AABB();
        for(const player of this.list.values()) {
            // on the client, isAlive doesn't work for player model
            if (player.sharedProps.isAlive) {
                aabb.setBottomHeightRadius((player.sharedProps.pos as Vector).offset(0, -0.1, 0), player.height, PLAYER_RADIUS)
                if (aabb.containsVec(vec)) {
                    yield player
                }
            }
        }
    }

    /**
     * @yields all entries [user_id, player]
     */
    *all(): IterableIterator<[int, PlayerT]> {
        yield *this.list.entries();
    }

    /** @yields all players */
    *values(): IterableIterator<PlayerT> {
        yield *this.list.values();
    }

    get world(): WorldT {
        return this.#world
    }

    /**
     * Return total player count
     */
    get count(): int {
        return this.list.size
    }

    /**
     * Return player by following user_id
     */
    get(user_id: int): PlayerT {
        return this.list.get(user_id) ?? null
    }

    /**
     * Return true if player exists by following user_id
     */
    exists(user_id: int): boolean {
        return this.list.has(user_id)
    }

    /**
     * Delete player from list by following user_id
     */
    delete(user_id: int): boolean {
        return this.list.delete(user_id)
    }

    /**
     * Return all players user_id array
     */
    keys(): int[] {
        return Array.from(this.list.keys())
    }

}