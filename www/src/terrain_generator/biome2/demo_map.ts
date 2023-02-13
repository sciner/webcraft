import {CHUNK_SIZE_X,  CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import { Default_Terrain_Generator } from "../default.js";
import {alea} from "../default.js";

const DEFAULT_CHEST_ROTATE = new Vector(3, 1, 0);

// Randoms
let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

//
const vox_templates = {};

// Terrain generator class
export default class Demo_Map extends Default_Terrain_Generator {
    [key: string]: any;

    async init() {
        this.islands                = [];
        this.extruders              = [];
        // Map specific
        if(this.world_id == 'demo') {
            await this.generateDemoMapStructures();
        }
    }

    //
    intersectChunkWithVoxelBuildings(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.voxel_buildings.length; i++) {
            const item = this.voxel_buildings[i];
            _createBlockAABB_second.set(
                item.coord.x - item.size.x,
                item.coord.y - item.size.y,
                item.coord.z - item.size.z,
                item.coord.x + item.size.x,
                item.coord.y + item.size.y,
                item.coord.z + item.size.z
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    intersectSpiralStairs(chunk) {
        return this.world_id == 'demo' && chunk.addr.x == 180 && chunk.addr.z == 174;
    }

    //
    intersectChunkWithIslands(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.islands.length; i++) {
            const item = this.islands[i];
            const rad = item.rad;
            _createBlockAABB_second.set(
                item.pos.x - rad,
                item.pos.y - rad,
                item.pos.z - rad,
                item.pos.x + rad,
                item.pos.y + rad,
                item.pos.z + rad
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    // extruders
    intersectChunkWithExtruders(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.extruders.length; i++) {
            const item = this.extruders[i];
            const rad = item.rad;
            _createBlockAABB_second.set(
                item.pos.x - rad,
                item.pos.y - rad,
                item.pos.z - rad,
                item.pos.x + rad,
                item.pos.y + rad,
                item.pos.z + rad
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    // Endless spiral staircase
    drawSpiralStaircases(chunk) {
        for(let y = 0; y < chunk.size.y; y += .25) {
            let y_abs = y + chunk.coord.y;
            let y_int = parseInt(y);
            let x = 8 + parseInt(Math.sin(y_abs / Math.PI) * 6);
            let z = 8 + parseInt(Math.cos(y_abs / Math.PI) * 6);
            let block = BLOCK.BEDROCK;
            if(y >= 1) {
                chunk.setBlockIndirect(x, y_int - 1, z, block.id);
            }
            if(y_abs % 16 == 1) {
                block = BLOCK.GOLD_BLOCK;
            }
            if(y_abs % 32 == 1) {
                block = BLOCK.DIAMOND_ORE;
            }
            chunk.setBlockIndirect(x, y_int, z, block.id);
        }
    }

    // drawBuilding...
    drawBuilding(xyz, x, y, z, chunk) {
        let vb = this.getVoxelBuilding(xyz);
        if(vb) {
            let block = vb.getBlock(xyz);
            if(block) {
                chunk.setBlockIndirect(x, y, z, block.id);
            }
            return true;
        }
        return false;
    }

    // drawIsland
    drawIsland(xyz, x, y, z, chunk, grass_level) {
        for(let i = 0; i < this.islands.length; i++) {
            const island = this.islands[i];
            let dist = xyz.distance(island.pos);
            if(dist < island.rad) {
                if(xyz.y < island.pos.y) {
                    if(xyz.y < island.pos.y - (3 + grass_level)) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.STONE.id);
                        return true;
                    } else {
                        if(dist < island.rad * (0.8 + (grass_level / 12))) {
                            chunk.setBlockIndirect(x, y, z, BLOCK.STONE.id);
                            return true;
                        } else {
                            chunk.setBlockIndirect(x, y, z, BLOCK.GRASS_BLOCK.id);
                            return true;
                        }
                    }
                }
                break;
            }
        }
        return false;
    }

    // extrude
    extrude(xyz) {
        for (let i = 0; i < this.extruders.length; i++) {
            const extruder = this.extruders[i];
            if(xyz.distance(extruder.pos) < extruder.rad) {
                return true;
            }
        }
        return false;
    }

    // getTreasureRoomMat
    getTreasureRoomMat(xyz, is_floor, level) {
        if(!is_floor && level == 0) {
            return BLOCK.LODESTONE.id;
        }
        let rb = randoms[Math.abs(xyz.x + xyz.y + xyz.z) % randoms.length];
        if(rb < .2) {
            return BLOCK.MOSS_BLOCK.id;
        } else if (rb < .8) {
            return BLOCK.STONE_BRICKS.id;
        } else {
            return BLOCK.MOSSY_STONE_BRICKS.id;
        }
    }

    // drawTreasureRoom...
    drawTreasureRoom(chunk, line, xyz, x, y, z) {
        if(xyz.y < line.p_start.y || xyz.y == line.p_start.y + Math.round(line.rad) - 1) {
            chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, true));
        } else {
            if(
                // long walls
                (xyz.z == line.p_start.z + Math.floor(line.rad)) ||
                (xyz.z == line.p_end.z - Math.floor(line.rad)) ||
                // short walls
                (xyz.x == line.p_end.x + Math.floor(line.rad)) ||
                (xyz.x == line.p_start.x - Math.floor(line.rad))
            ) {
                chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
            } else if (xyz.x == line.p_start.x - Math.floor(line.rad) + 7) {
                // 3-th short wall with door
                if(xyz.z != line.p_start.z || (xyz.z == line.p_start.z && xyz.y > line.p_start.y + 2)) {
                    chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
                } else {
                    // iron bars over door
                    if(xyz.y == line.p_start.y + 2) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.IRON_BARS.id);
                    }
                }
            }
            if(xyz.y == line.p_start.y) {
                // chest
                if(xyz.z == line.p_start.z) {
                    let cx = Math.round((line.p_start.x + line.p_end.x) / 2) - 6;
                    if(xyz.x == cx) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.CHEST.id, DEFAULT_CHEST_ROTATE, {generate: true, params: {source: 'treasure_room'}});
                    }
                    if(xyz.x == cx + 3) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.MOB_SPAWN.id, DEFAULT_CHEST_ROTATE);
                    }
                }
            }
        }
    }

    // Map specific
    async generateDemoMapStructures() {
        // Костыль для NodeJS
        let root_dir = '../www';
        if(typeof process === 'undefined') {
            root_dir = '';
        }
        await Vox_Loader.load(root_dir + '/data/vox/monu10.vox', (chunks) => {
            let palette = {
                81: BLOCK.STONE,
                97: BLOCK.OAK_PLANKS,
                121: BLOCK.STONE_BRICKS,
                122: BLOCK.SMOOTH_STONE,
                123: BLOCK.GRAVEL,
            };
            vox_templates.monu10 = {chunk: chunks[0], palette: palette};
        });
        await Vox_Loader.load(root_dir + '/data/vox/castle.vox', (chunks) => {
            let palette = {
                93: BLOCK.GRAVEL,
                106: BLOCK.STONE_BRICKS,
                114: BLOCK.STONE,
                72: BLOCK.GRASS_BLOCK,
                235: BLOCK.POWDER_SNOW,
                54: BLOCK.SPRUCE_PLANKS,
                150: BLOCK.OAK_LEAVES,
                139: BLOCK.OAK_LEAVES,
                58: BLOCK.OAK_LOG,
                107: BLOCK.GRASS_BLOCK,
                144: BLOCK.OAK_LEAVES,
                143: BLOCK.GRASS_BLOCK,
                253: BLOCK.OAK_PLANKS,
                238: BLOCK.SPRUCE_PLANKS,
                79: BLOCK.BIRCH_PLANKS,
                184: BLOCK.GRASS_BLOCK,
                174: BLOCK.GRASS_BLOCK,
            };
            vox_templates.castle = {chunk: chunks[0], palette: palette};
        });
        this.voxel_buildings.push(new Vox_Mesh(vox_templates.monu10, new Vector(2840, 58, 2830), new Vector(0, 0, 0), null, null));
        this.voxel_buildings.push(new Vox_Mesh(vox_templates.castle, new Vector(2980, 70, 2640), new Vector(0, 0, 0), null, new Vector(0, 1, 0)));
        this.islands.push({
            pos: new Vector(2865, 118, 2787),
            rad: 15
        });
        this.islands.push({
            pos: new Vector(2920, 1024, 2787),
            rad: 20
        });
        this.extruders.push({
            pos: this.islands[0].pos.sub(new Vector(0, 50, 0)),
            rad: this.islands[0].rad
        });
    }

}