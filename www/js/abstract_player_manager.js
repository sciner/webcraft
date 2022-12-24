import { PLAYER_RADIUS } from "./constant.js";
import { AABB } from "./core/AABB.js";

export class AbstractPlayerManager {

    constructor(world) {
        this.list = new Map();
    }

    *eachContainingVec(vec) {
        const aabb = new AABB();
        for(let player of this.list.values()) {
            // on the client, isAlive doesn't work for player model
            if (player.sharedProps.isAlive) {
                aabb.setBottomHeightRadius(player.sharedProps.pos, player.height, PLAYER_RADIUS);
                if (aabb.containsVec(vec)) {
                    yield player;
                }
            }
        }
    }
}