import {BLOCK} from '../../js/blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from '../../js/chunk_const.js';
import {Color, getChunkAddr, Vector, VectorCollector} from '../../js/helpers.js';

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
import {alea, noise} from "../../js/terrain_generator/default.js";

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
            }
        }
    }
);

// load module
await import('../../js/terrain_generator/cluster/manager.js').then(module => {
    globalThis.ClusterManager = module.ClusterManager;
});

globalThis.BLOCK            = BLOCK;
const CHUNK_RENDER_DIST     = 32;
const chunk_addr_start      = new Vector(0 - CHUNK_RENDER_DIST, 0, 0 - CHUNK_RENDER_DIST);
const chunk_coord_start     = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const all_maps              = new VectorCollector();
const all_clusters          = new VectorCollector();
let cnt                     = 0;
const CHUNK_SIZE_VEC        = new Vector(CHUNK_SIZE_X, 0, CHUNK_SIZE_Z);
const demo_map_seed         = 'undefined';
const seed                  = demo_map_seed | 0; // allow only numeric values
const world_id              = 'demo';
const noisefn               = noise.simplex2;
const SZ                    = CHUNK_RENDER_DIST * 2;

const ALL_BIOMES = [
    {color: [120, 10, 255]}, // cold
    {color: [65, 100, 250]},
    {color: [0, 180, 235]},
    {color: [65, 235, 210]},
    {color: [130, 255, 180]},
    {color: [190, 235, 140]},
    {color: [255, 175, 95]},
    {color: [254, 94, 47]},
    {color: [255, 6, 5]}, // hot
];

// showCoordInfo
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
        text += `\n${cell.biome.color}`;
        document.getElementById('dbg').innerText = text;
    }
}

await import('../../js/terrain_generator/terrain_map.js').then(module => {

    globalThis.GENERATOR_OPTIONS = module.GENERATOR_OPTIONS;
    globalThis.TerrainMapManager = module.TerrainMapManager;

    noise.seed(seed);

    const Tmaps             = new TerrainMapManager(seed, world_id, noisefn);
    const pn                = performance.now();

    let canvas = document.getElementById('canvas3D');
    let ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = SZ * CHUNK_SIZE_X;
    canvas.height = SZ * CHUNK_SIZE_Z;

    // Отрисовка карты
    ctx.fillStyle = "#fc0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let maps_generated = 0;
    let imgData = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);

    for(let sx = 0; sx < SZ; sx++) {
        for(let sz = 0; sz < SZ; sz++) {
            const chunk_addr = chunk_addr_start.clone().addScalarSelf(sx, 0, sz)
            let map = fillBiomes(chunk_addr, 123456789);
            all_maps.set(map.chunk.addr, map);
            maps_generated++;
            for(var i = 0; i < CHUNK_SIZE_X; i++) {
                for(var j = 0; j < CHUNK_SIZE_Z; j++) {
                    const z = sx * CHUNK_SIZE_X + i;
                    const x = sz * CHUNK_SIZE_Z + j;
                    const cell = map.cells[j * CHUNK_SIZE_X + i];
                    const biome = cell.biome;
                    let index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;
                    imgData.data[index + 0] = biome.color[0];
                    imgData.data[index + 1] = biome.color[1];
                    imgData.data[index + 2] = biome.color[2];
                    imgData.data[index + 3] = 255;
                }
            }
        }
    }

    let elapsed = performance.now() - pn;
    console.log(cnt)
    ctx.putImageData(imgData, 0, 0);

    let text = Math.round(elapsed) + ' ms';
    text += '\nmaps: ' + maps_generated;
    text += '\none map: ' + Math.round((elapsed / maps_generated) * 100) / 100 + ' ms';
    text += '\nmaps per sec: ' + Math.round(1000 / (elapsed / maps_generated) * 100) / 100;
    text += '\npoints: ' + (SZ * CHUNK_SIZE_X) * (SZ * CHUNK_SIZE_Z);
    text += '\nchunk render dist: ' + CHUNK_RENDER_DIST;
    document.getElementById('timer').innerText = text;

});

//
function fillBiomes(chunk_addr, seed) {

    const scale                 = 1;
    //
    const chunk_coord           = chunk_addr.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
    const cells                 = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
    //
    const CLUSTER_SIZE          = 16 / scale;
    const POINTS_PER_CLUSTER    = 20 / scale
    const TEMPER_OCT_1          = 512 / scale
    const DIST_NOISE            = 16 / scale;
    const DIST_NOISE_OCT1       = 1024 / scale
    const DIST_NOISE_OCT2       = 96 / scale
    //
    const cluster_addr          = new Vector(chunk_addr.x, chunk_addr.y, chunk_addr.z).divScalarSelf(CLUSTER_SIZE).flooredSelf();

    // create points
    let points = [];
    const ca = new Vector();
    for(let x = -1; x <= 1; x++) {
        for(let z = -1; z <= 1; z++) {
            ca.set(cluster_addr.x + x, 0, cluster_addr.z + z);
            let map_points = all_clusters.get(ca);
            if(!map_points) {
                map_points = [];
                const random = new alea(`${seed}${ca.x}${ca.z}`);
                for(let i = 0; i < POINTS_PER_CLUSTER; i++) {
                    const vec = new Vector(
                        ca.x * (CLUSTER_SIZE * CHUNK_SIZE_X) + random.nextInt(CLUSTER_SIZE * CHUNK_SIZE_X - 1),
                        0,
                        ca.z * (CLUSTER_SIZE * CHUNK_SIZE_Z) + random.nextInt(CLUSTER_SIZE * CHUNK_SIZE_Z - 1)
                    );
                    let temper_point = (noisefn(vec.x / TEMPER_OCT_1, vec.z / TEMPER_OCT_1) + 1) / 2;
                    const biome_idx = (temper_point * ALL_BIOMES.length) | 0;
                    vec.biome = ALL_BIOMES[biome_idx];
                    map_points.push(vec);
                }
                all_clusters.set(ca, map_points);
            }
            points.push(...map_points);
        }
    }

    // find closest point
    const getNear = (x, z) => {
        let closest = Number.MAX_VALUE;
        let chosenPoint;
        x += chunk_coord.x;
        z += chunk_coord.z;
        // border waves
        let si = DIST_NOISE ? noisefn(x / DIST_NOISE_OCT1, z / DIST_NOISE_OCT2) * DIST_NOISE : 0;
        let sj = DIST_NOISE ? noisefn(z / DIST_NOISE_OCT1, x / DIST_NOISE_OCT2) * DIST_NOISE : 0;
        for(let i = 0; i < points.length; i++) {
            const d = points[i];
            const a = (d.x - x + si);
            const b = (d.z - z + sj);
            const fake_distance = a * a + b * b; // Math.sqrt(a * a + b * b);
            cnt++;
            if (fake_distance < closest) {
                closest = fake_distance;
                chosenPoint = d;
            }
        }
        return chosenPoint;
    }

    for (let x = 0; x < CHUNK_SIZE_X; x++) {
        for (let z = 0; z < CHUNK_SIZE_Z; z++) {
            let index = (z * CHUNK_SIZE_X + x);
            cells[index] = getNear(x, z);
        }
    }

    return {
        cells,
        chunk: {
            addr: chunk_addr,
            coord: chunk_addr.mul(CHUNK_SIZE_VEC)
        }
    };

}
