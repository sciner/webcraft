import { alea } from "./default.js";
import { BLOCK } from "../blocks.js";
import { Vector } from "../helpers.js";
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { ChunkGrid } from "../core/ChunkGrid.js";

// Ores
const ORE_RANDOMS        : (OreRandom | null)[] = [];
const ORE_RANDOMS_SIMPLE : OreRandom[] = [];

type OreRandom = {
    max_rad: number;
    block_id: number;
    max_y: number;
}

// OreSource
class OreSource {
    pos: Vector;
    rad: number;
    block_id: number;
    max_y: number;

    constructor(pos: Vector, rad: number, block_id: number, max_y: number) {
        this.pos = pos;
        this.rad = rad;
        this.block_id = block_id;
        this.max_y = max_y;
    }

}

// OreGenerator
export class OreGenerator {
    [key: string]: any;
    grid: ChunkGrid;
    //
    constructor(grid, seed, noisefn, noise3d, map) {
        this.grid     = grid;
        this.seed     = seed;
        this.map      = map;
        this.noisefn  = noisefn;
        this.noise3d  = noise3d; // noise.simplex3
    }

    // Generate
    generate(chunk_addr, chunk_coord, layer): OreSource[] {

        //
        const seed              = this.seed;
        const aleaRandom        = new alea(seed + '_' + chunk_addr.toHash() + '_' + layer.id);
        const ores              : OreSource[] = [];
        const map               = this.map;

        const CHUNK_SIZE_X = this.grid.chunkSize.x;
        const CHUNK_SIZE_Z = this.grid.chunkSize.z;
        const CHUNK_SIZE_X_SM   = (CHUNK_SIZE_X - layer.max_ore_rad * 2);
        const CHUNK_SIZE_Z_SM   = (CHUNK_SIZE_Z - layer.max_ore_rad * 2);

        //
        if(ORE_RANDOMS.length == 0) {
            //
            ORE_RANDOMS_SIMPLE.push(
                {max_rad: layer.max_ore_rad, block_id: BLOCK.GRANITE.id, max_y: Infinity},
                {max_rad: layer.max_ore_rad, block_id: BLOCK.DIORITE.id, max_y: Infinity},
                {max_rad: layer.max_ore_rad, block_id: BLOCK.ANDESITE.id, max_y: Infinity}
            );
            //
            ORE_RANDOMS.push(
                {max_rad: 1.5, block_id: BLOCK.DIAMOND_ORE.id, max_y: 32},
                {max_rad: 2, block_id: BLOCK.GOLD_ORE.id, max_y: 48},
                {max_rad: 2, block_id: BLOCK.REDSTONE_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: 52},
                {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: 52},
                {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: 52},
                null,
                null,
                null,
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: layer.max_ore_rad, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: layer.max_ore_rad, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
                {max_rad: layer.max_ore_rad, block_id: BLOCK.COAL_ORE.id, max_y: Infinity}
            );
        }

        //
        for(let i = 0; i < layer.source_count; i++) {
            const rnd    = aleaRandom.double();
            const ore_x  = Math.floor(aleaRandom.double() * CHUNK_SIZE_X_SM) + layer.max_ore_rad;
            const ore_y  = Math.floor(2.75 * i) + layer.max_ore_rad;
            const ore_z  = Math.floor(aleaRandom.double() * CHUNK_SIZE_Z_SM) + layer.max_ore_rad;
            const cell   = map.cells[ore_z * CHUNK_SIZE_X + ore_x];
            if(ore_y + chunk_coord.y < cell.value2 - 6) {
                const pos             = new Vector(ore_x, ore_y, ore_z).addSelf(chunk_coord);
                const ore_index_seed  = rnd * layer.palette.length;
                const rad             = layer.max_ore_rad + 1;
                const palette_index   = Math.floor(ore_index_seed);
                const ore             = layer.palette[palette_index];
                if(!ore) continue;
                if(pos.y > ore.max_y) {
                    i--;
                    continue;
                }
                const source = new OreSource(pos, rad, ore.block_id, ore.max_y);
                ores.push(source);
            }
        }

        return ores;

    }

    // Draw ores in chunk
    draw(chunk : ChunkWorkerChunk) {

        const xyz               = new Vector(0, 0, 0);
        const max_noise_dist    = 0.15;
        const stone_id          = BLOCK.STONE.id;

        const layers = [
            {id: 'main', palette: ORE_RANDOMS, max_ore_rad: 1, source_count: 12},
            {id: 'simple', palette: ORE_RANDOMS_SIMPLE, max_ore_rad: 3, source_count: 6}
        ];

        //
        for(let layer of layers) {
            const ores = this.generate(chunk.addr, chunk.coord, layer);
            for(let i = 0; i < ores.length; i++) {
                const ore           = ores[i];
                const R             = ore.rad;
                const source_noise  = this.noise3d(ore.pos.x / 10, ore.pos.y / 10, ore.pos.z / 10);
                xyz.copyFrom(ore.pos);
                for(xyz.x = ore.pos.x - R; xyz.x < ore.pos.x + R; xyz.x++) {
                    for(xyz.z = ore.pos.z - R; xyz.z < ore.pos.z + R; xyz.z++) {
                        for(xyz.y = ore.pos.y - R; xyz.y < ore.pos.y + R; xyz.y++) {
                            const x               = xyz.x - chunk.coord.x;
                            const y               = xyz.y - chunk.coord.y;
                            const z               = xyz.z - chunk.coord.z;
                            const exist_block_id  = chunk.getBlockID(x, y, z);
                            if(exist_block_id == stone_id) {
                                const dist = xyz.distance(ore.pos);
                                if(dist < ore.rad) {
                                    const xyz_noise = this.noise3d(xyz.x / 10, xyz.y / 10, xyz.z / 10);
                                    const noise_dist = xyz_noise - source_noise;
                                    if(Math.abs(noise_dist) < max_noise_dist) {
                                        chunk.setBlockIndirect(x, y, z, ore.block_id);
                                    }
                                }
                            }

                        }
                    }
                }
            }
        }

    }

}