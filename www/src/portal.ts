import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk_const.js";
import { ServerClient } from "./server_client.js";
import { Color, DIRECTION, Vector } from "./helpers.js";
import { WorldAction } from "./world_action.js";
import { DEFAULT_STYLE_NAME, PORTAL_SIZE } from "./constant.js";

//
export const PORTAL_TYPES = [
    {id: 'BOTTOM_CAVES',    block_name: 'OBSIDIAN',     y: -1000,   open_restricts: [{yless: -500}], color: new Color(68, 515, 0), is_default: false},
    {id: 'ROUTINE',         block_name: 'PRISMARINE',   y: 80,      open_restricts: [{yless: 500, ymore: 0}], color: new Color(68, 532, 0), is_default: true},
    {id: 'FLYING_ISLANDS',  block_name: 'GLOWSTONE',    y: 1000,    open_restricts: [{ymore: 500}], color: new Color(68, 540, 0), is_default: false}
];

//
export class WorldPortalWait {
    [key: string]: any;

    constructor(old_pos, new_pos, params) {
        this.params         = params;
        this.attempt        = 0;
        this.chunk_addr     = Vector.toChunkAddr(new_pos);
        this.old_pos        = old_pos;
        this.pos            = new_pos;
    }

}

//
export class WorldPortal {
    [key: string]: any;

    constructor(pos, rotate, size, player_pos, portal_block_id, type = null) {
        this.pos                = pos;
        this.rotate             = rotate
        this.size               = size,
        this.player_pos         = player_pos;
        this.portal_block_id    = portal_block_id;
        this.type               = type;
    }

    //
    static getPortalTypeForFrame(world_material) {
        for(let type of PORTAL_TYPES) {
            if(type.block_name == world_material.name) {
                return type;
            }
        }
        return null;
    }

    //
    static getPortalTypeByID(type_id) {
        for(let type of PORTAL_TYPES) {
            if(type.id == type_id) {
                return type;
            }
        }
        return null;
    }

    //
    static getDefaultPortalType() {
        for(let type of PORTAL_TYPES) {
            if(type.is_default) {
                return type;
            }
        }
        return null;
    }

    //
    static suitablePortalFloorMaterial(mat) {
        return (mat.passable == 0) &&
            (!mat.transparent) &&
            [DEFAULT_STYLE_NAME].includes(mat.style_name) &&
            !('width' in mat) && !('height' in mat);
    }

    // build portal
    static async buildPortal(user_id, world, pos, type) {
        const dirs = ['x', 'z'];
        const bm = world.block_manager;
        const portal_block_id = bm.fromName(type.block_name);
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
                        if(!WorldPortal.suitablePortalFloorMaterial(b.material)) {
                            return false;
                        }
                    } else if((b.id != bm.AIR.id) && !b.material.is_grass) {
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
                const frame_block = {id: portal_block_id.id};
                const portal_block = {
                    id: bm.NETHER_PORTAL.id,
                    rotate: new Vector((d == 'x') ? DIRECTION.SOUTH : DIRECTION.EAST, 0, 0),
                    extra_data: null
                };
                //
                const portal = new WorldPortal(
                    pos.clone(),
                    portal_block.rotate.clone(),
                    PORTAL_SIZE,
                    resp.clone(),
                    portal_block.id,
                    type.id
                );
                portal_block.extra_data = {id: await world.db.portal.add(user_id, portal), type: type.id};
                portal.id = portal_block.extra_data.id;
                //
                for(b_pos.y = pos.y; b_pos.y < pos.y + PORTAL_SIZE.height; b_pos.y++) {
                    for(b_pos[d] = pos[d]; b_pos[d] < pos[d] + PORTAL_SIZE.width; b_pos[d]++) {
                        const is_frame = (b_pos.y == pos.y || b_pos.y == pos.y + PORTAL_SIZE.height - 1) ||
                            (b_pos[d] == pos[d] || b_pos[d] == pos[d] + PORTAL_SIZE.width - 1);
                        let block = is_frame ? frame_block : portal_block;
                        if(is_frame && type.id == 'ROUTINE') {
                            if(b_pos.y == pos.y || b_pos.y == pos.y + PORTAL_SIZE.height - 1) {
                                if(b_pos[d] == pos[d] || b_pos[d] == pos[d] + PORTAL_SIZE.width - 1) {
                                    block = {id: world.block_manager.SEA_LANTERN.id};
                                }
                            }
                        }
                        actions.addBlocks([{pos: b_pos.clone(), item: block, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
                    }
                }
                world.actions_queue.add(null, actions);
                return portal;
            }
        }
        return null;
    }

    // Return new portal
    static async foundPortalFloorAndBuild(user_id, world, chunk, type) {
        // const tb = chunk.tblocks;
        // @todo tb.non_zero always zero =(
        const pos = new Vector(0, 0, 0);
        for(pos.y = CHUNK_SIZE_Y - PORTAL_SIZE.height; pos.y >= 0; pos.y--) {
            for(pos.x = 0; pos.x < CHUNK_SIZE_X - PORTAL_SIZE.width + 1; pos.x++) {
                for(pos.z = 0; pos.z < CHUNK_SIZE_Z - PORTAL_SIZE.width + 1; pos.z++) {
                    const portal = await WorldPortal.buildPortal(user_id, world, pos.add(chunk.coord), type);
                    if(portal) {
                        // return portal
                        return portal;
                    }
                }
            }
        }
        return null;
    }

}