import {impl as alea} from '../../vendors/alea.js';
import { BLOCK } from "../blocks.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk.js";
import { Vector } from "../helpers.js";

const MAX_ORE_RAD = 3;

// Ores
const ORE_RANDOMS = [
    {max_rad: 2, block_id: BLOCK.DIAMOND_ORE.id, max_y: 32},
    {max_rad: 2, block_id: BLOCK.GOLD_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.REDSTONE_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
    {max_rad: 1, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
    {max_rad: 1, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: MAX_ORE_RAD, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: MAX_ORE_RAD, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: MAX_ORE_RAD, block_id: BLOCK.COAL_ORE.id, max_y: Infinity}
];

const CHUNK_SIZE_VEC = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

class OreSource {

    constructor(pos, rad, block_id) {
        this.pos = pos;
        this.rad = rad;
        this.block_id = block_id;
    }

}

export class OreGenerator {

    constructor(seed, chunk_addr, noise3d) {

        const aleaRandom = new alea(seed + '_' + chunk_addr.toHash());
        const chunk_coord = chunk_addr.clone().multiplyVecSelf(CHUNK_SIZE_VEC);

        // @todo для каждого блока в чанке считается расстояние до каждого источника руды
        this.ores = [];
        this.noise3d = noise3d;
        const margin = MAX_ORE_RAD;

        for(let y = 0; y < 4; y++) {
            chunk_coord.t = y * CHUNK_SIZE_Y;
            let count = Math.round(aleaRandom.double() * 10);
            for(let i = 0; i < count; i++) {
                const r = Math.floor(aleaRandom.double() * ORE_RANDOMS.length);
                const f = ORE_RANDOMS[r];
                const ore = new OreSource(
                    new Vector(
                        margin + (CHUNK_SIZE_X - margin * 2) * aleaRandom.double(),
                        margin + (CHUNK_SIZE_Y - margin * 2) * aleaRandom.double(),
                        margin + (CHUNK_SIZE_Z - margin * 2) * aleaRandom.double()
                    ).flooredSelf().addSelf(chunk_coord),
                    Math.min(Math.round(aleaRandom.double() * f.max_rad) + 1, f.max_rad),
                    f.block_id
                );
                this.ores.push(ore);
            }
        }
        this.ores.sort((a, b) => a.pos.y - b.pos.y);
    }

    // 
    get(xyz, dirt_height) {
        let stone_block_id;
        const density = this.noise3d(xyz.x / 20, xyz.z / 20, xyz.y / 20) / 2 + .5;
        if(density > 0.5) {
            if(density < 0.66) {
                stone_block_id = BLOCK.DIORITE.id;
            } else if(density < 0.83) {
                stone_block_id = BLOCK.ANDESITE.id;
            } else {
                stone_block_id = BLOCK.GRANITE.id;
            }
        } else if(xyz.y < dirt_height - 5) {
            for(let i = 0; i < this.ores.length; i++) {
                const ore = this.ores[i];
                if(ore.pos.y < xyz.y - MAX_ORE_RAD) continue;
                if(ore.pos.y > xyz.y + MAX_ORE_RAD) break;
                if(ore.pos.distance(xyz) < ore.rad) {
                    if(xyz.y < ore.max_y) {
                        stone_block_id = ore.block_id;
                    }
                    break;
                }
            }
        }
        return stone_block_id || BLOCK.CONCRETE.id;
    }

}