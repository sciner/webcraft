import {BLOCK} from '../../js/blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from '../../js/chunk_const.js';
import { Color, getChunkAddr, Vector, VectorCollector } from '../../js/helpers.js';
import { ClusterManager } from '../../js/terrain_generator/cluster/manager.js';
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
                if(biome.code == 'OCEAN' || biome.code == 'RIVER') {
                    biome.dirt_color = new Color(740/1024, 995/1024);
                } else if(biome.code == 'SNOW') {
                    biome.dirt_color = new Color(772/1024, 995/1024);
                } else if(biome.code == 'BEACH') {
                    biome.dirt_color = new Color(748/1024, 995/1024);
                } else if(biome.code == 'JUNGLE') {
                    biome.dirt_color = new Color(810/1024, 780/1024);
                } else if(biome.code == 'GRASSLAND') {
                    biome.dirt_color = new Color(756/1024, 995/1024);
                }
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

globalThis.BLOCK = BLOCK;
const chunk_addr_start = new Vector(180, 0, 170);
const chunk_coord_start = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const all_maps = new VectorCollector();

export function showCoordInfo(x, z) {
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
}

await import('../../js/terrain_generator/terrain_map.js').then(module => {
    globalThis.GENERATOR_OPTIONS = module.GENERATOR_OPTIONS;
    globalThis.TerrainMapManager = module.TerrainMapManager;

    //
    const CHUNK_RENDER_DIST = 8;
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

    let maps_generated = 0;
    let imgData = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);

    const fake_chunk = {
        chunkManager: {
            clusterManager: new ClusterManager({}, seed)
        }
    };

    const xyz = new Vector();
    for(let sx = 0; sx < SZ; sx++) {
        for(let sz = 0; sz < SZ; sz++) {
            const chunk_addr = chunk_addr_start.clone().addScalarSelf(sx, 0, sz);
            let maps = Tmaps.generateAround(fake_chunk, chunk_addr, true, true);
            let map = maps[4];
            all_maps.set(chunk_addr, map);
            maps_generated++;
            for(var i = 0; i < CHUNK_SIZE_X; i++) {
                for(var j = 0; j < CHUNK_SIZE_Z; j++) {
                    let has = false;
                    for(let y = 64; y > 0; y--) {
                        xyz.set(
                            chunk_addr.x * CHUNK_SIZE_X + i,
                            y,
                            chunk_addr.z * CHUNK_SIZE_Z + j
                        );
                        const caveDensity = map.caves.getPoint(xyz, null, false);
                        if(caveDensity !== null && caveDensity != undefined) {
                            has = (y / 64) * caveDensity;
                            break;
                        }
                    }
                    //
                    const color = has ? (255 * has) : 0;
                    const z = sx * CHUNK_SIZE_X + i;
                    const x = sz * CHUNK_SIZE_Z + j;
                    let index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;
                    imgData.data[index + 0] = color;
                    imgData.data[index + 1] = color;
                    imgData.data[index + 2] = color;
                    imgData.data[index + 3] = 255;
                }
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);

    let elapsed = performance.now() - pn;
    let text = Math.round(elapsed) + ' ms';
    text += '\nmaps: ' + maps_generated;
    text += '\none map: ' + Math.round((elapsed / maps_generated) * 100) / 100 + ' ms';
    text += '\nmaps per sec: ' + Math.round(1000 / (elapsed / maps_generated) * 100) / 100;
    text += '\nchunk render dist: ' + CHUNK_RENDER_DIST;
    document.getElementById('timer').innerText = text;

});