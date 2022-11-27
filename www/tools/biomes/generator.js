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

const CHUNK_RENDER_DIST     = 64;
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

await import('../../js/terrain_generator/biome3/biomes.js').then(module => {

    globalThis.Biomes = module.Biomes;

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
    const noise3d = createNoise3D(al.double);

    const world_id = al.double();

    const maps = new TerrainMapManager2(seed, world_id, noise2d, noise3d);

    const biomes = new Biomes(noise2d);
    const pn = performance.now();

    const xyz = new Vector(0, 0, 0);

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

});