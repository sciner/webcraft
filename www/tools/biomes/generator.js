import {BLOCK} from '../../js/blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr} from '../../js/chunk.js';
import {Color, Vector, VectorCollector} from '../../js/helpers.js';

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

const ALL_BIOMES = [
    {color: [0, 0, 0]},
    {color: [120, 10, 255]},
    {color: [65, 100, 250]},
    {color: [0, 180, 235]},
    {color: [65, 235, 210]},
    {color: [130, 255, 180]},
    {color: [190, 235, 140]},
    {color: [255, 175, 95]},
    {color: [254, 94, 47]},
    {color: [255, 6, 5]},
    {color: [0, 0, 0]},
];

let cnt = 0;
const CHUNK_SIZE_VEC = new Vector(CHUNK_SIZE_X, 0, CHUNK_SIZE_Z);

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

globalThis.BLOCK = BLOCK;
const chunk_addr_start = new Vector(180, 0, 170);
const chunk_coord_start = chunk_addr_start.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
const all_maps = new VectorCollector();
const all_clusters = new VectorCollector();
const noisefn = noise.simplex2;

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

    //
    const CHUNK_RENDER_DIST = 32;
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

    for(let sx = 0; sx < SZ; sx++) {
        for(let sz = 0; sz < SZ; sz++) {
            const chunk_addr = chunk_addr_start.add(new Vector(sx, 0, sz));
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

    const CLUSTER_SIZE = 22;
    const POINTS_PER_CLUSTER = 2;
    const cluster_addr = new Vector(chunk_addr.x, chunk_addr.y, chunk_addr.z).divScalar(CLUSTER_SIZE).flooredSelf();

    // create points
    let points = [];
    const scale = 1;
    const ca = new Vector();
    const margin = 1;
    const OCT_1 = 512 / scale;
    const OCT_2 = 64 / scale;
    for(let x = -margin; x <= margin; x++) {
        for(let z = -margin; z <= margin; z++) {
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
                    let temper_point = (
                        noisefn(vec.x / OCT_1, vec.z / OCT_1) +
                        noisefn(vec.x / OCT_2, vec.z / OCT_2)
                    + 2) / 4;
                    const biome_idx = (temper_point * ALL_BIOMES.length) | 0;
                    vec.biome = ALL_BIOMES[biome_idx];
                    map_points.push(vec);
                }
                all_clusters.set(ca, map_points);
            }
            points.push(...map_points);
        }
    }

    const chunk_coord = chunk_addr.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));

    // find closest point
    const getNear = (i, j) => {
        let closest = Number.MAX_VALUE;
        let chosenPoint;
        const x = (chunk_coord.x + i);
        const z = (chunk_coord.z + j);
        // border waves
        let si = noisefn(x / 1024, z / 96) * 32;
        let sj = noisefn(z / 1024, x / 96) * 32;
        for(let d of points) {
            let distance = Math.sqrt(
                (d.x - x + si) * (d.x - x + si) +
                (d.z - z + sj) * (d.z - z + sj)
            );
            cnt++;
            if (distance < closest) {
                closest = distance;
                chosenPoint = d;
            }
        }
        return chosenPoint;
    }

    const cells = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
    for (let i = 0; i < CHUNK_SIZE_X; i++) {
        for (let j = 0; j < CHUNK_SIZE_Z; j++) {
            let index = (j * CHUNK_SIZE_X + i);
            // get biome and return
            cells[index] = getNear(i, j);
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
