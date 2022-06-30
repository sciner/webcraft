import {impl as alea} from '../../vendors/alea.js';
import { BLOCK } from "../blocks.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import { Vector } from "../helpers.js";

// Ores
const ORE_RANDOMS = [];

const MAX_ORE_RAD = 2;
const CHUNK_SIZE_VEC = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

const CHUNK_SIZE_X_SM = (CHUNK_SIZE_X - MAX_ORE_RAD * 2);
const CHUNK_SIZE_Y_SM = (CHUNK_SIZE_Y - MAX_ORE_RAD * 2);
const CHUNK_SIZE_Z_SM = (CHUNK_SIZE_Z - MAX_ORE_RAD * 2);

const MAX_INDEX = CHUNK_SIZE_X_SM * CHUNK_SIZE_Y_SM * CHUNK_SIZE_Z_SM;

class OreSource {

    constructor(pos, rad, block_id, max_y) {
        this.pos = pos;
        this.rad = rad;
        this.block_id = block_id;
        this.max_y = max_y;
    }

}

export class OreGenerator {

    constructor(seed, chunk_addr, noisefn, noise3d, map) {

        if(ORE_RANDOMS.length == 0) {
            ORE_RANDOMS.push(...[
                {max_rad: 1.5, block_id: BLOCK.DIAMOND_ORE.id, max_y: 32},
                {max_rad: 2, block_id: BLOCK.GOLD_ORE.id, max_y: 48},
                {max_rad: 2, block_id: BLOCK.REDSTONE_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: MAX_ORE_RAD, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: MAX_ORE_RAD, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: MAX_ORE_RAD, block_id: BLOCK.COAL_ORE.id, max_y: Infinity}
            ]);
        }

        const aleaRandom = new alea(seed + '_' + chunk_addr.toHash());
        const chunk_coord = chunk_addr.clone().multiplyVecSelf(CHUNK_SIZE_VEC);

        // @todo для каждого блока в чанке считается расстояние до каждого источника руды
        this.ores = [];
        this.noisefn = noisefn;
        this.noise3d = noise3d;

        for(let y = 0; y < 4; y++) {
            chunk_coord.y = y * CHUNK_SIZE_Y;
            let count = Math.floor(aleaRandom.double() * 30);
            for(let i = 0; i < count; i++) {
                const index = Math.floor(aleaRandom.double() * MAX_INDEX);
                let ore_x = index % CHUNK_SIZE_X_SM;
                let ore_y = index / (CHUNK_SIZE_X_SM * CHUNK_SIZE_Z_SM) | 0;
                let ore_z = (index % (CHUNK_SIZE_X_SM * CHUNK_SIZE_Z_SM) - ore_x) / CHUNK_SIZE_X_SM;
                ore_x += MAX_ORE_RAD;
                ore_y += MAX_ORE_RAD;
                ore_z += MAX_ORE_RAD;
                const cell = map.cells[ore_z * CHUNK_SIZE_X + ore_x];
                if(ore_y + chunk_coord.y < cell.value2) {
                    const ore_index_seed = aleaRandom.double() * ORE_RANDOMS.length;
                    const r = Math.floor(ore_index_seed);
                    const f = ORE_RANDOMS[r];
                    if(ore_y + chunk_coord.y > f.max_y) {
                        i--;
                        continue;
                    }
                    const pos = new Vector(ore_x, ore_y, ore_z).addSelf(chunk_coord);
                    const rad = Math.min(Math.round((ore_index_seed - r) * f.max_rad) + 1, f.max_rad) / 1.5;
                    const ore = new OreSource(
                        pos,
                        rad,
                        f.block_id,
                        f.max_y
                    );
                    this.ores.push(ore);
                }
            }
        }

        this.ores.sort((a, b) => a.pos.y - b.pos.y);

    }

    // 
    get(xyz, dirt_height) {

        let stone_block_id;
        const noise = this.noise3d(xyz.x / 10, xyz.z / 10, xyz.y / 10);
        const density = noise / 2 + .5;

        //
        if(density > 0.65) {
            let den = this.noisefn(xyz.x / 10, xyz.z / 10) / 2 + .5;
            if(den < .4) {
                stone_block_id = BLOCK.ANDESITE.id;
            } else if(den < .6) {
                stone_block_id = BLOCK.GRANITE.id;
            } else {
                stone_block_id = BLOCK.DIORITE.id;
            }
        } else if(density > .1 && xyz.y < dirt_height - 5) {
            const noise_dist = noise * 2.3;
            for(let i = 0; i < this.ores.length; i++) {
                const ore = this.ores[i];
                if(ore.pos.y < xyz.y - MAX_ORE_RAD) continue;
                if(ore.pos.y > xyz.y + MAX_ORE_RAD) break;
                if(ore.pos.distance(xyz) <= ore.rad + noise_dist) {
                    stone_block_id = ore.block_id;
                    break;
                }
            }
        }
        return stone_block_id || BLOCK.STONE.id;
    }

}