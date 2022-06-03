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