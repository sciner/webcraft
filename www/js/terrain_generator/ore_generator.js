import { BLOCK } from "../blocks.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk.js";
import { Vector } from "../helpers.js";

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
    {max_rad: 3, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 3, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 3, block_id: BLOCK.COAL_ORE.id, max_y: Infinity}
];

export class OreGenerator {

    constructor(aleaRandom, chunk_coord, noise3d) {
        // @todo для каждого блока в чанке считается расстояние до каждого источника руды
        this.ores = [];
        this.noise3d = noise3d;
<<<<<<< Updated upstream
        const margin = 3;
        let count = Math.round(aleaRandom.double() * 15);
        for(let i = 0; i < count; i++) {
            const r = Math.floor(aleaRandom.double() * ORE_RANDOMS.length);
            const ore = ORE_RANDOMS[r];
            ore.rad = Math.min(Math.round(aleaRandom.double() * ore.max_rad) + 1, ore.max_rad),
            ore.pos = new Vector(
                margin + (CHUNK_SIZE_X - margin * 2) * aleaRandom.double(),
                margin + (CHUNK_SIZE_Y - margin * 2) * aleaRandom.double(),
                margin + (CHUNK_SIZE_Z - margin * 2) * aleaRandom.double()
            ).flooredSelf().addSelf(chunk_coord);
            this.ores.push(ore);
=======

        return;

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
>>>>>>> Stashed changes
        }
    }

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