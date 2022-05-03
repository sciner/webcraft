import {BLOCK} from '../../js/blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from '../../js/chunk.js';
import { Vector } from '../../js/helpers.js';
await BLOCK.init({
    texture_pack: 'base',
    json_url: '../../data/block_style.json',
    resource_packs_url: '../../data/resource_packs.json'
});
import {noise} from "../../js/terrain_generator/default.js";

// load module
await import('../../js/terrain_generator/cluster/manager.js').then(module => {
    globalThis.ClusterManager = module.ClusterManager;
});

globalThis.BLOCK = BLOCK;

await import('../../js/terrain_generator/terrain_map.js').then(module => {
    globalThis.GENERATOR_OPTIONS = module.GENERATOR_OPTIONS;
    globalThis.TerrainMapManager = module.TerrainMapManager;

    //
    const seed      = 'undefined';
    const world_id  = 'demo';
    const noisefn   = noise.perlin2;
    const Tmaps     = new TerrainMapManager(seed, world_id, noisefn);

    const chunk_addr_center = new Vector(180, 0, 170);
    const pn                = performance.now();
    const chunk_render_dist = 4;
    const SZ                = chunk_render_dist * 2 + 3;

    let canvas = document.getElementById('canvas3D');
    let ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = SZ * CHUNK_SIZE_X;
    canvas.height = SZ * CHUNK_SIZE_Z;

    // Отрисовка карты
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let maps_generated = 0;
    let imgData = ctx.getImageData(0, 0, SZ * CHUNK_SIZE_X, SZ * CHUNK_SIZE_Z);

    for(let sx = 0; sx < SZ; sx++) {
        for(let sz = 0; sz < SZ; sz++) {
            const chunk_addr = chunk_addr_center.add(new Vector(sx, 0, sz));
            let maps = Tmaps.generateAround(chunk_addr, true, true);
            let map = maps[4];
            maps_generated++;
            for(var i = 0; i < CHUNK_SIZE_X; i++) {
                for(var j = 0; j < CHUNK_SIZE_Z; j++) {
                    const z = sx * CHUNK_SIZE_X + i;
                    const x = sz * CHUNK_SIZE_Z + j;
                    const cell = map.cells[j * CHUNK_SIZE_X + i];
                    let index = (z * (SZ * CHUNK_SIZE_X) + x) * 4;
                    const light = (cell.value2 / 64);
                    imgData.data[index + 0] = cell.biome.color_rgba[0] * light;
                    imgData.data[index + 1] = cell.biome.color_rgba[1] * light;
                    imgData.data[index + 2] = cell.biome.color_rgba[2] * light;
                    imgData.data[index + 3] = 255;
                }
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);

    let elapsed = performance.now() - pn;
    let text = Math.round(elapsed) + ' ms';
    text += '\nMaps: ' + maps_generated;
    text += '\nmps: ' + Math.round((elapsed / maps_generated) * 100) / 100 + ' ms';
    document.getElementById('timer').innerText = text;

});