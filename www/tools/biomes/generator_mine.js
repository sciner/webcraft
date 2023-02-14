import { BLOCK} from '../../js/blocks.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../js/chunk_const.js';
import { Vector } from '../../js/helpers.js';
import { Biomes } from '../../js/terrain_generator/biome3/biomes.js';
import Terrain_Generator from '../../js/terrain_generator/biome3/index.js';
// import { createNoise2D, createNoise3D } from '../../vendors/simplex-noise.js';
// import { alea } from '../../js/terrain_generator/default.js';
// import { TerrainMapManager2 } from '../../js/terrain_generator/biome3/terrain/manager.js';

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
globalThis.maps            = null;

const CHUNK_RENDER_DIST     = 32;
const chunk_addr_start      = new Vector(0 - CHUNK_RENDER_DIST, 0, 0 - CHUNK_RENDER_DIST);
const chunk_coord_start     = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const SZ                    = CHUNK_RENDER_DIST * 2;

class Mth {

    static sqrt(n) {
        if(n >= 0) return Math.sqrt(n)
        return -Math.sqrt(-n)
    }

    static square(n) {
        return n * n
    }

    static clamp(n, min, max) {
        if(n < min) return min
        if(n > max) return max
        return n
    }

}

class QuartPos {

    /**
     * @param {int} p_175403_ 
     */
    static toBlock(p_175403_) {
        return p_175403_ << 2;
    }
    
    /**
     * @param {int} p_175401_
     */
    static fromBlock(p_175401_) {
        return p_175401_ >> 2;
     }

}

class SectionPos {

    /**
     * @param {int} p_123172_
     */
    static blockToSectionCoord(p_123172_) {
        return p_123172_ >> 4;
    }

}

class LinearCongruentialGenerator {

    static MULTIPLIER = 6364136223846793005n;
    static INCREMENT = 1442695040888963407n;
 
    static next(p_13973_, p_13974_) {
        p_13974_ = BigInt(p_13974_)
        const b = new BigInt64Array([p_13973_, p_13974_])
        b[0] *= b[0] * 6364136223846793005n + 1442695040888963407n;
        return b[0] + b[1];
    }

}

class BiomeGenerator {

    constructor() {
        this.biomeZoomSeed = 5017357443398579235n;
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

        // debugger

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

        // return this.noiseBiomeSource.getNoiseBiome(l2, i3, j3);
        return this.getNoiseBiome(l2, i3, j3);

    }

    /**
     * @param {int} p_204347_ 
     * @param {int} p_204348_ 
     * @param {int} p_204349_ 
     * @returns 
     */
    getNoiseBiome(p_204347_, p_204348_, p_204349_) {
        /**
        * @type {int}
        */
        const i = QuartPos.fromBlock(this.getMinBuildHeight());
        /**
        * @type {int}
        */
        const k = i + QuartPos.fromBlock(this.getHeight()) - 1;
        /**
        * @type {int}
        */
        const l = Mth.clamp(p_204348_, i, k);
        /**
        * @type {int}
        */
        const j = this.getSectionIndex(QuartPos.toBlock(l));
        debugger
        return this.sections[j].getNoiseBiome(p_204347_ & 3, l & 3, p_204349_ & 3);
    }

    /**
     * 
     * @param {int} p_151565_ 
     */
    getSectionIndex(p_151565_) {
        return this.getSectionIndexFromSectionY(SectionPos.blockToSectionCoord(p_151565_));
    }

    /**
     * @param {int} p_151567_ 
     */
    getSectionIndexFromSectionY(p_151567_) {
        return p_151567_ - this.getMinSection();
    }

    getMinSection() {
       return SectionPos.blockToSectionCoord(this.getMinBuildHeight());
    }

    getMinBuildHeight() {
        return -64;
    }

    getHeight() {
        return 384
    }

    getFiddle(p_186690_) {
        // const d0 = Math.floorMod(p_186690_ >> 24, 1024) / 1024.0;
        const d0 = Number((p_186690_ >> 24n) & 1023n) / 1024;
        // const d0 = (Math.floor(p_186690_ >> 24) % 1024) / 1024.0;
        return (d0 - 0.5) * 0.9;
    }

    getFiddledDistance(p_186680_, p_186681_, p_186682_, p_186683_, p_186684_, p_186685_, p_186686_) {
        let resp = LinearCongruentialGenerator.next(p_186680_, p_186681_);
        resp = LinearCongruentialGenerator.next(resp, p_186682_);
        resp = LinearCongruentialGenerator.next(resp, p_186683_);
        resp = LinearCongruentialGenerator.next(resp, p_186681_);
        resp = LinearCongruentialGenerator.next(resp, p_186682_);
        resp = LinearCongruentialGenerator.next(resp, p_186683_);
        const d0 = this.getFiddle(resp);
        resp = LinearCongruentialGenerator.next(resp, p_186680_);
        const d1 = this.getFiddle(resp);
        resp = LinearCongruentialGenerator.next(resp, p_186680_);
        const d2 = this.getFiddle(resp);
        return Mth.square(p_186686_ + d2) + Mth.square(p_186685_ + d1) + Mth.square(p_186684_ + d0);
     }

}

// showCoordInfo
export function showCoordInfo(x, z) {
    if(!maps) return
    const ax = chunk_coord_start.x + z;
    const az = chunk_coord_start.z + x;
    const biome = maps.calcBiome(new Vector(ax, 0, az));
    let text = ax + 'x' + az;
    text += `\n${biome.title} #${biome.id}`;
    document.getElementById('dbg').innerText = text;
}

export async function calcBiomes() {

    /*
    const bm = new BiomeGenerator();
    return console.log(bm.getBiome(new Vector(54, -8, 22)))
    */

    const canvas = document.getElementById('canvas3D');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = SZ * CHUNK_SIZE_X;
    canvas.height = SZ * CHUNK_SIZE_Z;
    ctx.fillStyle = "#fc0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const maps_generated    = SZ * SZ;
    const imgData           = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);
    const seed              = '1';
    const world_id          = seed;
    const world             = {chunkManager: null}
    const options           = {};

    const generator = new Terrain_Generator(world, seed, world_id, options)
    await generator.init()
    maps = generator.maps;
    const noise2d = generator.noise2d

    const biomes = new Biomes(noise2d);
    const pn = performance.now();
    const xyz = new Vector(0, 0, 0);
    const biomes_stat = new Map();

    let biomes_stat_count = 0;

    for(let x = 0; x < SZ * CHUNK_SIZE_X; x += 1) {
        for(let z = 0; z < SZ * CHUNK_SIZE_Z; z += 1) {

            const px = chunk_coord_start.x + x;
            const pz = chunk_coord_start.z + z;
            const index = (x * (SZ * CHUNK_SIZE_X) + z) * 4;

            xyz.set(px, 0, pz);

            // water
            const water = 1; // biomes.calcNoise(px, pz, 1)

            if(water < .3) {
                imgData.data[index + 0] = 12
                imgData.data[index + 1] = 25
                imgData.data[index + 2] = 128

            } else {

                const biome = maps.calcBiome(xyz);

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

}