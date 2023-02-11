import { BLOCK} from '../../js/blocks.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../js/chunk_const.js';
import { Helpers, Vector } from '../../js/helpers.js';
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

// showCoordInfo
export function showCoordInfo(x, z) {
    // if(!maps) return
    // const ax = chunk_coord_start.x + z;
    // const az = chunk_coord_start.z + x;
    // const biome = maps.calcBiome(new Vector(ax, 0, az));
    // let text = ax + 'x' + az;
    // text += `\n${biome.title} #${biome.id}`;
    // document.getElementById('dbg').innerText = text;
}

/**
 * @param {Biomes} biomes 
 */
function drawBiomes(biomes) {

    const w = biomes.scale
    const h = biomes.scale

    //
    const canvas = document.getElementById('biomes');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = "#fc0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, w, h);

    for(let x = 0; x < w; x += 1) {
        for(let z = 0; z < h; z += 1) {
            const index = (z * w + x) * 4
            const biome = biomes.getPaletteBiome(x, z)
            biome.used = (biome.used | 0) + 1
            const color = Helpers.clamp(biome.id, 0, 255)
            imgData.data[index + 0] = color
            imgData.data[index + 1] = color
            imgData.data[index + 2] = color
        }
    }

    ctx.putImageData(imgData, 0, 0);

    const biomes_list = []
    const params_stat = {
        temperature: {min: Infinity, max: -Infinity, size: 0},
        humidity: {min: Infinity, max: -Infinity, size: 0}
    }
    let not_zero = 0
    for(let biome of biomes.list) {
        biome.used = biome.used ?? 0
        if(biome.used) not_zero++
        const {id, title, temperature, humidity, used} = biome
        // calc stats
        for(let c of [{temperature}, {humidity}]) {
            for(const [k, v] of Object.entries(c)) {
                const stat = params_stat[k]
                if(v < stat.min) {
                    stat.min = v
                    stat.size = stat.max - stat.min
                }
                if(v > stat.max) {
                    stat.max = v
                    stat.size = stat.max - stat.min
                }
            }
        }
        biomes_list.push({id, title, temperature, humidity, used})
    }
    biomes_list.sort((a, b) => b.used - a.used)
    
    // biomes
    console.table(biomes_list)
    console.table(`Used biomes: ${not_zero} / ${biomes_list.length}`)

    // stat
    console.table(params_stat)

}

export async function calcBiomes() {

    const seed              = '1';
    const world_id          = seed;
    const world             = {chunkManager: null}
    const options           = {};

    const generator = new Terrain_Generator(world, seed, world_id, options)
    await generator.init()
    maps = generator.maps;
    const noise2d = generator.noise2d
    const biomes = new Biomes(noise2d);

    /*
    const bm = new BiomeGenerator();
    return console.log(bm.getBiome(new Vector(54, -8, 22)))
    */

    drawBiomes(biomes)

    drawMap()

}

/**
 * @param {Biomes} biomes 
 */
 function drawMap(biomes) {

    return

    const canvas = document.getElementById('map');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = SZ * CHUNK_SIZE_X;
    canvas.height = SZ * CHUNK_SIZE_Z;
    ctx.fillStyle = "#fc0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const maps_generated    = SZ * SZ;
    const imgData           = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);

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

            // // water
            // const water = 1; // biomes.calcNoise(px, pz, 1)

            // if(water < .3) {
            //     imgData.data[index + 0] = 12
            //     imgData.data[index + 1] = 25
            //     imgData.data[index + 2] = 128

            // } else {

            //     const biome = maps.calcBiome(xyz);

            //     let bs = biomes_stat.get(biome.title)
            //     biomes_stat.set(biome.title, bs ? bs + 1 : 1);
            //     biomes_stat_count++

            //     const c = biome.id / biomes.list.length;

            //     if(biome.temp <= 0) {
            //         imgData.data[index + 0] = c * 128
            //         imgData.data[index + 1] = c * 128
            //         imgData.data[index + 2] = c * 255
            //     } else {
            //         imgData.data[index + 0] = c * 255
            //         imgData.data[index + 1] = c * 128
            //         imgData.data[index + 2] = c * 128
            //     }

            // }

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

    //
    const stat = [];
    for(const [title, cnt] of biomes_stat.entries()) {
        stat.push({title, percent: Math.round(cnt/biomes_stat_count*100000) / 1000});
    }

    stat.sort((a, b) => b.percent - a.percent)
    console.table(stat)

}