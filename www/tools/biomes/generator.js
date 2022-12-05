import {BLOCK} from '../../js/blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from '../../js/chunk_const.js';
import {Vector} from '../../js/helpers.js';
import { Biomes } from '../../js/terrain_generator/biome3/biomes.js';
import { createNoise2D, createNoise3D } from '../../vendors/simplex-noise.js';
import { alea } from '../../js/terrain_generator/default.js';
import { TerrainMapManager2 } from '../../js/terrain_generator/biome3/terrain/manager.js';

await BLOCK.init({
    texture_pack: 'base',
    json_url: '../../data/block_style.json',
    resource_packs_url: '../../data/resource_packs.json'
});

//
await import('../../js/terrain_generator/biomes.js').then(module => {
    globalThis.BIOMES = module.BIOMES;
    globalThis.TREES = module.TREES;
});

globalThis.BLOCK            = BLOCK;

const CHUNK_RENDER_DIST     = 32;
const chunk_addr_start      = new Vector(0 - CHUNK_RENDER_DIST, 0, 0 - CHUNK_RENDER_DIST);
const chunk_coord_start     = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const SZ                    = CHUNK_RENDER_DIST * 2;

// showCoordInfo
export function showCoordInfo(x, z) {
    /*
    const ax = chunk_coord_start.x + z;
    const az = chunk_coord_start.z + x;
    const chunk_addr = getChunkAddr(ax, 0, az);
    const map = all_maps.get(chunk_addr);
    if(map) {
        const mx = ax - map.chunk.coord.x;
        const mz = az - map.chunk.coord.z;
        const cell_index = mz * CHUNK_SIZE_X + mx;
        const cell = map.cells[cell_index];
        let text = ax + 'x' + az;
        text += `\n${cell.biome.color}`;
        document.getElementById('dbg').innerText = text;
    }*/
}


class LinearCongruentialGenerator {

    static MULTIPLIER = BigInt(6364136223846793005);
    static INCREMENT = BigInt(1442695040888963407);
 
    static next(p_13973_, p_13974_) {
        const b = new BigInt64Array([p_13973_, p_13974_])
        // p_13973_ = BigInt(p_13973_)
        // p_13974_ = BigInt(p_13974_)
        b[0] *= b[0] * 6364136223846793005n + 1442695040888963407n;
        return b[0] + b[1];
    }

 }

 //
class BiomeGenerator {

    constructor() {
        this.biomeZoomSeed = BigInt(-4234997244040992158);
    }

    getBiome(xyz) {
        const i = xyz.x - 2;
        const j = xyz.y - 2;
        const k = xyz.z - 2;
        const l = i >> 2;
        const i1 = j >> 2;
        const j1 = k >> 2;
        const d0 = (i & 3) / 4.0;
        const d1 = (j & 3) / 4.0;
        const d2 = (k & 3) / 4.0;

        debugger

        let k1 = 0;
        let d3 = Infinity;

        for (let l1 = 0; l1 < 8; ++l1) {
            const flag = (l1 & 4) == 0;
            const flag1 = (l1 & 2) == 0;
            const flag2 = (l1 & 1) == 0;
            const i2 = flag ? l : l + 1;
            const j2 = flag1 ? i1 : i1 + 1;
            const k2 = flag2 ? j1 : j1 + 1;
            const d4 = flag ? d0 : d0 - 1.0;
            const d5 = flag1 ? d1 : d1 - 1.0;
            const d6 = flag2 ? d2 : d2 - 1.0;
            const d7 = this.getFiddledDistance(this.biomeZoomSeed, i2, j2, k2, d4, d5, d6);
            if (d3 > d7) {
                k1 = l1;
                d3 = d7;
            }
        }

        const l2 = (k1 & 4) == 0 ? l : l + 1;
        const i3 = (k1 & 2) == 0 ? i1 : i1 + 1;
        const j3 = (k1 & 1) == 0 ? j1 : j1 + 1;

        return { l2, i3, j3 };

        // return this.noiseBiomeSource.getNoiseBiome(l2, i3, j3);

    }

    getFiddle(p_186690_) {
        // const d0 = Math.floorMod(p_186690_ >> 24, 1024) / 1024.0;
        const d0 = ((p_186690_ >> 24) & 1023) / 1024.0

        // const d0 = (Math.floor(p_186690_ >> 24) % 1024) / 1024.0;
        return (d0 - 0.5) * 0.9;
    }

    getFiddledDistance(p_186680_, p_186681_, p_186682_, p_186683_, p_186684_, p_186685_, p_186686_) {
        let resp = LinearCongruentialGenerator.next(p_186680_, p_186681_ + 0n);
        resp = LinearCongruentialGenerator.next(resp, p_186682_ + 0n);
        resp = LinearCongruentialGenerator.next(resp, p_186683_ + 0n);
        resp = LinearCongruentialGenerator.next(resp, p_186681_ + 0n);
        resp = LinearCongruentialGenerator.next(resp, p_186682_ + 0n);
        resp = LinearCongruentialGenerator.next(resp, p_186683_ + 0n);
        const d0 = this.getFiddle(resp);
        resp = LinearCongruentialGenerator.next(resp, p_186680_ + 0n);
        const d1 = this.getFiddle(resp);
        resp = LinearCongruentialGenerator.next(resp, p_186680_ + 0n);
        const d2 = this.getFiddle(resp);
        return Math.sqrt(p_186686_ + d2) + Math.sqrt(p_186685_ + d1) + Math.sqrt(p_186684_ + d0);
     }

}

await import('../../js/terrain_generator/biome3/biomes.js').then(module => {

    globalThis.Biomes = module.Biomes;

    const bm = new BiomeGenerator();
    console.log(bm.getBiome(new Vector(152, 65, 209)))
    return;

    const canvas = document.getElementById('canvas3D');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = SZ * CHUNK_SIZE_X;
    canvas.height = SZ * CHUNK_SIZE_Z;
    ctx.fillStyle = "#fc0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const maps_generated = SZ * SZ;
    const imgData = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);

    const seed = '1';

    const al = new alea(seed);
    const noise2d = createNoise2D(al.double);
    const noise3d = null; // createNoise3D(al.double);

    const world_id = al.double();

    const maps = new TerrainMapManager2(seed, world_id, noise2d, noise3d);

    const biomes = new Biomes(noise2d);
    const pn = performance.now();

    const xyz = new Vector(0, 0, 0);

    const biomes_stat = new Map();
    let biomes_stat_count = 0;

    for(let x = 0; x < SZ * CHUNK_SIZE_X; x += 1) {
        for(let z = 0; z < SZ * CHUNK_SIZE_Z; z += 1) {

            const px = chunk_coord_start.x + x;
            const pz = chunk_coord_start.z + z;
            const index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;

            xyz.set(px, 0, pz);

            // water
            const water = 1; // biomes.calcNoise(px, pz, 1)

            if(water < .3) {
                imgData.data[index + 0] = 12
                imgData.data[index + 1] = 25
                imgData.data[index + 2] = 128

            } else {

                const {biome, temperature, humidity} = maps.calcBiome(xyz);

                let bs = biomes_stat.get(biome.title)
                biomes_stat.set(biome.title, bs ? bs + 1 : 1);
                biomes_stat_count++

                const c = biome.id / biomes.list.length;

                if(biome.temp <= 0) {
                    imgData.data[index + 0] = c * 128
                    imgData.data[index + 1] = c * 128
                    imgData.data[index + 2] = c * 255
                } else {
                    imgData.data[index + 0] = c * 255
                    imgData.data[index + 1] = c * 128
                    imgData.data[index + 2] = c * 128
                }

            }

        }
    }

    const elapsed = performance.now() - pn;

    // chunks net
    for(let x = 0; x < SZ * CHUNK_SIZE_X; x += 16) {
        for(let z = 0; z < SZ * CHUNK_SIZE_Z; z += 16) {
            let index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;
            imgData.data[index + 0] = (255 - imgData.data[index + 0]) / 4;
            imgData.data[index + 1] = (255 - imgData.data[index + 1]) / 4;
            imgData.data[index + 2] = (255 - imgData.data[index + 2]) / 4;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    let text = Math.round(elapsed * 1000) / 1000 + ' ms';
    text += '\nmaps: ' + maps_generated;
    text += '\none map: ' + Math.round((elapsed / maps_generated) * 1000) / 1000 + ' ms';
    text += '\nmaps per sec: ' + Math.round(1000 / (elapsed / maps_generated) * 100) / 100;
    text += '\nchunk render dist: ' + CHUNK_RENDER_DIST;
    document.getElementById('timer').innerText = text;

    console.table(biomes.list);

    //
    const stat = [];
    for(const [title, cnt] of biomes_stat.entries()) {
        stat.push({title, percent: Math.round(cnt/biomes_stat_count*100000) / 1000});
    }

    stat.sort((a, b) => b.percent - a.percent)
    console.table(stat)

});