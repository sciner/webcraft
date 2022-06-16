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

/*
await Resources.loadImage('media/card.png', false).then(async (img) => {
    
    let canvas          = document.createElement('canvas');
    const w             = img.width;
    const h             = img.height;
    canvas.width        = w;
    canvas.height       = h;
    let ctx             = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    
    const rad = 35;
    const rad_width = rad * 2 + 1;
    let p = performance.now();
    
    if(false) {
        //
        const data_orig = new Array(w * h * 4).fill(null);
        for(let i = 0; i < data_orig.length; i++) {
            data_orig[i] = imgData.data[i];
        }
        for(let y = 0; y < h; y++) {
            for(let x = 0; x < w; x++) {
                let sum = [0, 0, 0];
                let cnt = 0;
                for(let i = -rad; i < rad; i++) {
                    let j = 0;
                    for(let j = -rad; j < rad; j++) {
                        let ax = x + i;
                        let ay = y + j;
                        if(ax < 0) ax = 0;
                        if(ay < 0) ay = 0;
                        if(ax >= w) ax = w - 1;
                        if(ay >= h) ay = h - 1;
                        const index = (ay * w + ax) * 4;
                        sum[0] += data_orig[index + 0];
                        sum[1] += data_orig[index + 1];
                        sum[2] += data_orig[index + 2];
                        cnt++;
                    }
                }
                const index = (y * w + x) * 4;
                imgData.data[index + 0] = sum[0] / cnt;
                imgData.data[index + 1] = sum[1] / cnt;
                imgData.data[index + 2] = sum[2] / cnt;
            }
        }
    } else {

        const chs = 4;
        const data = imgData.data;
        const frame = new Uint8Array(rad_width);

        for(let z = 0; z < 1; z++) {
            // horizontal
            for(let c = 0; c < 3; c++) {
                for(let y = 0; y < h; y++) {
                    let sum = 0;
                    let i = 0;
                    for(; i < rad; i++) {
                        sum += frame[i] = data[y * w * chs + c];
                    }
                    for(let x = 0; x < w + rad_width; x++) {
                        const index = ((y * w) + (x < w ? x : w - 1)) * chs;
                        frame[i++ % rad_width] = data[index + c];
                        if(x >= rad) {
                            if(x < w + rad) {
                                const set_index = (y * w + (x - rad)) * chs;
                                data[set_index + c] = sum / (rad_width - 1);
                            }
                            sum -= frame[i % rad_width];
                        }
                        sum += data[index + c];
                    }
                }
            }
            // vertical
            for(let c = 0; c < 3; c++) {
                for(let x = 0; x < w; x++) {
                    let sum = 0;
                    let i = 0;
                    for(; i < rad; i++) {
                        sum += frame[i] = data[x * chs + c];
                    }
                    for(let y = 0; y < h + rad_width; y++) {
                        const index = ((y < h ? y : h - 1) * w + x) * chs;
                        frame[i++ % rad_width] = data[index + c];
                        if(y >= rad) {
                            if(y < h + rad) {
                                const set_index = ((y - rad) * w + x) * chs;
                                data[set_index + c] = sum / (rad_width - 1);
                            }
                            sum -= frame[i % rad_width];
                        }
                        sum += data[index + c];
                    }
                }
            }
        }
    }

    console.log(performance.now() - p);
    ctx.putImageData(imgData, 0, 0);
    document.body.appendChild(canvas);
});
*/

// load module
await import('../../js/terrain_generator/cluster/manager.js').then(module => {
    globalThis.ClusterManager = module.ClusterManager;
});

globalThis.BLOCK = BLOCK;
const chunk_addr_start = new Vector(180, 0, 170);
const chunk_coord_start = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const all_maps = new VectorCollector();

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
        text += `\n${cell.biome.code}`;
        document.getElementById('dbg').innerText = text;
    }
    */
}

await import('../../js/terrain_generator/terrain_map.js').then(module => {

    globalThis.GENERATOR_OPTIONS = module.GENERATOR_OPTIONS;
    globalThis.TerrainMapManager = module.TerrainMapManager;

    //
    const CHUNK_RENDER_DIST = 16;
    const demo_map_seed     = 'undefined';
    const seed              = demo_map_seed | 0; // allow only numeric values
    const world_id          = 'demo';

    noise.seed(seed);

    const noisefn           = noise.perlin2;
    const Tmaps             = new TerrainMapManager(seed, world_id, noisefn);
    const pn                = performance.now();
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

            const px = chunk_coord_start.x + x;
            const pz = chunk_coord_start.z + z;
            const river_point = Tmaps.makeRiverPoint(px, pz);

            imgData.data[index + 0] = 0;
            imgData.data[index + 1] = 0;
            imgData.data[index + 2] = river_point ? river_point * 255 : 0;
            imgData.data[index + 3] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    let elapsed = performance.now() - pn;
    let text = Math.round(elapsed) + ' ms';
    text += '\nmaps: ' + maps_generated;
    text += '\none map: ' + Math.round((elapsed / maps_generated) * 100) / 100 + ' ms';
    text += '\nmaps per sec: ' + Math.round(1000 / (elapsed / maps_generated) * 100) / 100;
    text += '\npoints: ' + (SZ * CHUNK_SIZE_X) * (SZ * CHUNK_SIZE_Z);
    text += '\nchunk render dist: ' + CHUNK_RENDER_DIST;
    document.getElementById('timer').innerText = text;

});