import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../www/js/chunk_const.js";
import { ServerClient } from "../www/js/server_client.js";
import { DIRECTION, getChunkAddr, Vector } from "../www/js/helpers.js";
import { WorldAction } from "../www/js/world_action.js";
import { PORTAL_SIZE } from "../www/js/constant.js";

//
export class WorldPortalWait {

    constructor(old_pos, new_pos, params) {
        this.params = params;
        this.attempt = 0;
        this.chunk_addr = getChunkAddr(new_pos);
        this.old_pos = old_pos;
        this.pos = new_pos;
    }

}

//
export class WorldPortal {

    constructor(pos, rotate, size, player_pos, portal_block_id) {
        this.pos = pos;
        this.rotate = rotate
        this.size = size,
        this.player_pos = player_pos;
        this.portal_block_id = portal_block_id;
    }

    //
    static suitablePortalFloorBlock(b) {
        const mat = b.material;
        return (mat.passable == 0) &&
            (!mat.transparent) &&
            ['default', 'cube'].includes(mat.style) &&
            !('width' in mat) && !('height' in mat);
    }

    // build portal
    static async buildPortal(user_id, world, pos) {
        const dirs = ['x', 'z'];
        const blocks = world.block_manager;
        //
        const checkDir = (d) => {
            const b_pos = pos.clone();
            for(b_pos.y = pos.y; b_pos.y < pos.y + PORTAL_SIZE.height; b_pos.y++) {
                for(b_pos[d] = pos[d]; b_pos[d] < pos[d] + PORTAL_SIZE.width; b_pos[d]++) {
                    const b = world.getBlock(b_pos);
                    if(!b) {
                        return false;
                    }
                    if(b_pos.y == pos.y) {
                        if(!WorldPortal.suitablePortalFloorBlock(b)) {
                            return false;
                        }
                    } else if((b.id != blocks.AIR.id) && !b.material.is_grass) {
                        return false;
                    }
                    // @todo check if near mobs or other players
                }
            }
            return true;
        };
        //
        for(let d of dirs) {
            if(checkDir(d)) {
                // we found good place for portal
                pos.y++;
                const resp = pos.clone();
                resp[d] += 1.5;
                resp.addScalarSelf(.5, 1, .5);
                // @todo build portal frame
                const b_pos = pos.clone();
                const actions = new WorldAction(randomUUID());
                const frame_block = {id: blocks.OBSIDIAN.id};
                const portal_block = {id: blocks.NETHER_PORTAL.id, rotate: new Vector((d == 'x') ? DIRECTION.SOUTH : DIRECTION.EAST, 0, 0)};
                //
                const portal = new WorldPortal(
                    pos.clone(),
                    portal_block.rotate.clone(),
                    PORTAL_SIZE,
                    resp.clone(),
                    portal_block.id
                );
                portal_block.extra_data = {id: await world.db.portal.add(user_id, portal)}
                //
                for(b_pos.y = pos.y; b_pos.y < pos.y + PORTAL_SIZE.height; b_pos.y++) {
                    for(b_pos[d] = pos[d]; b_pos[d] < pos[d] + PORTAL_SIZE.width; b_pos[d]++) {
                        const is_frame = (b_pos.y == pos.y || b_pos.y == pos.y + PORTAL_SIZE.height - 1) ||
                            (b_pos[d] == pos[d] || b_pos[d] == pos[d] + PORTAL_SIZE.width - 1);
                        actions.addBlocks([{pos: b_pos.clone(), item: is_frame ? frame_block : portal_block, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
                    }
                }
                world.actions_queue.add(null, actions);
                return resp
            }
        }
        return null;
    }

    // Return portal floor coord as target
    static async foundPortalFloor(user_id, world, chunk) {
        // const tb = chunk.tblocks;
        // @todo tb.non_zero always zero =(
        const pos = new Vector(0, 0, 0);
        for(pos.y = CHUNK_SIZE_Y - PORTAL_SIZE.height; pos.y >= 0; pos.y--) {
            for(pos.x = 0; pos.x < CHUNK_SIZE_X - PORTAL_SIZE.width + 1; pos.x++) {
                for(pos.z = 0; pos.z < CHUNK_SIZE_Z - PORTAL_SIZE.width + 1; pos.z++) {
                    const portal_floor_pos = await WorldPortal.buildPortal(user_id, world, pos.add(chunk.coord));
                    if(portal_floor_pos) {
                        // return teleport coords
                        return portal_floor_pos;
                    }
                }
            }
        }
        return null;
    }

    //
    static async checkWaitPortal(world, chunk, player) {
        if(!player.wait_portal) {
            return false;
        }
        const wait_info = player.wait_portal;
        let force_teleport = !wait_info.params?.found_or_generate_portal; // if portal not found around target coords
        if(!force_teleport) {
            // check max attempts
            const max_attempts = [
                0, 0, 123, /* 2 */ 255, 455, /* 4 */ 711, 987, 1307, 1683, 2099,
                2567, /*10*/ 3031, 3607, 4203, 4843, 5523, 6203 /* 16 */][player.state.chunk_render_dist];
            force_teleport = ++wait_info.attempt == max_attempts;
            if(force_teleport) {
                console.log(`force_teleport because we not can create second portal =(`);
            } else {
                // attempt to find place for portal
                if(chunk.addr.y == wait_info.chunk_addr.y) {
                    const portal_floor_pos = await WorldPortal.foundPortalFloor(player.session.user_id, world, chunk);
                    if(portal_floor_pos) {
                        console.log('Found portal floor pos', portal_floor_pos.toHash());
                        wait_info.pos = portal_floor_pos;
                        force_teleport = true;
                        player.prev_use_portal = performance.now();
                    } else {
                        // No place for portal in chunk
                    }
                }
            }
        }
        if(force_teleport) {
            return true;
        }
        return false;
    }

}