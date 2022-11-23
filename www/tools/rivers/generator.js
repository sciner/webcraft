import {BLOCK} from '../../js/blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from '../../js/chunk_const.js';
import { Color, Vector, VectorCollector } from '../../js/helpers.js';

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
//
import {noise} from "../../js/terrain_generator/default.js";

// Fix biomes color
import {Resources} from "../../js/resources.js";
await Resources.loadImage('resource_packs/base/textures/default.png', false).then(async (img) => {
    let canvas          = document.createElement('canvas');
    const w             = img.width;
    const h             = img.height;
    canvas.width        = w;
    canvas.height       = h;
    let ctx             = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;
        for(let [code, biome] of Object.entries(BIOMES)) {
            if(typeof biome === 'object') {
                const dirt_color = biome.dirt_color;
                const x = (dirt_color.r * w) | 0;
                const y = (dirt_color.g * h) | 0;
                const index = (y * w + x) * 4;
                const color = new Color(
                    imgData[index + 0],
                    imgData[index + 1],
                    imgData[index + 2],
                    imgData[index + 3]
                );
                biome.color_rgba = color;
                biome.color = color.toHex();
                // console.log(biome.code, biome.color);
            }
        }
    }
);

// load module
await import('../../js/terrain_generator/cluster/manager.js').then(module => {
    globalThis.ClusterManager = module.ClusterManager;
});

//
const CHUNK_RENDER_DIST = 16;
const demo_map_seed     = 'undefined';
const seed              = 20; // allow only numeric values
const world_id          = 'demo';

globalThis.BLOCK = BLOCK;
const chunk_addr_start = new Vector(-CHUNK_RENDER_DIST, 0, -CHUNK_RENDER_DIST);
const chunk_coord_start = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const all_maps = new VectorCollector();

export function showCoordInfo(x, z) {
}

await import('../../js/terrain_generator/terrain_map.js').then(module => {

    globalThis.GENERATOR_OPTIONS = module.GENERATOR_OPTIONS;
    globalThis.TerrainMapManager = module.TerrainMapManager;

    noise.seed(seed);

    const noisefn           = noise.simplex2;
    const Tmaps             = new TerrainMapManager(seed, world_id, noisefn);
    const SZ                = CHUNK_RENDER_DIST * 2 + 3;

    let canvas = document.getElementById('canvas3D');
    let ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = SZ * CHUNK_SIZE_X;
    canvas.height = SZ * CHUNK_SIZE_Z;

    // Отрисовка карты
    ctx.fillStyle = "#fc0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let maps_generated = SZ * SZ;
    let imgData = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);

    for(let x = 0; x < SZ * CHUNK_SIZE_X; x++) {
        for(let z = 0; z < SZ * CHUNK_SIZE_Z; z++) {
            let index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;
            imgData.data[index + 0] = 0;
            imgData.data[index + 1] = 0;
            imgData.data[index + 2] = 0;
            imgData.data[index + 3] = 255;
        }
    }

    let steps = 0;
    const step = 1;
    const pn = performance.now();

    for(let x = 0; x < SZ * CHUNK_SIZE_X; x += step) {
        for(let z = 0; z < SZ * CHUNK_SIZE_Z; z += step) {

            const px = chunk_coord_start.x + x;
            const pz = chunk_coord_start.z + z;
            const point = Tmaps.makeRiverPoint2(px, pz);
            const index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;

            if(point) {
                const {value, percent, river_percent, waterfront_percent} = point;
                imgData.data[index + 2] = (waterfront_percent) * 255;
                imgData.data[index + 1] = (river_percent) * 255;
            } else {
                imgData.data[index + 0] = 255;
                imgData.data[index + 1] = 0;
                imgData.data[index + 2] = 255;
            }

            steps++;

        }
    }

    // chunks net
    for(let x = 0; x < SZ * CHUNK_SIZE_X; x+=16) {
        for(let z = 0; z < SZ * CHUNK_SIZE_Z; z+=16) {
            let index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;
            imgData.data[index + 0] = 64
            imgData.data[index + 1] = 64
            imgData.data[index + 2] = 64
        }
    }

    const elapsed = performance.now() - pn;

    ctx.putImageData(imgData, 0, 0);
    let text = Math.round(elapsed * 1000) / 1000 + ' ms';
    text += '\nmaps: ' + maps_generated;
    text += '\none map: ' + Math.round((elapsed / maps_generated) * 1000) / 1000 + ' ms';
    text += '\nmaps per sec: ' + Math.round(1000 / (elapsed / maps_generated) * 100) / 100;
    text += '\npoints: ' + steps;
    text += '\nchunk render dist: ' + CHUNK_RENDER_DIST;
    document.getElementById('timer').innerText = text;

});