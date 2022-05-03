import {BLOCK} from '../../js/blocks.js';
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

    let canvas = document.getElementById('canvas3D');
    let ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Отрисовка карты
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale             = 1;
    const chunk_addr_center = new Vector(180, 0, 170);
    const pn                = performance.now();
    const SZ                = 11;

    let maps_generated = 0;

    var imgData = ctx.getImageData(0, 0, SZ * 16, SZ * 16);

    for(let sx = 0; sx < SZ; sx++) {
        for(let sz = 0; sz < SZ; sz++) {
            const chunk_addr = chunk_addr_center.add(new Vector(sx, 0, sz));
            let maps = Tmaps.generateAround(chunk_addr, true, true);
            let map = maps[4];
            maps_generated++;
            for(var i = 0; i < 16; i++) {
                for(var j = 0; j < 16; j++) {
                    const z = sx * 16 + i;
                    const x = sz * 16 + j;
                    const cell = map.info.cells[i][j];
                    let index = (z * (SZ*16) + x) * 4;
                    imgData.data[index + 0] = cell.biome.color_rgba[0];
                    imgData.data[index + 1] = cell.biome.color_rgba[1];
                    imgData.data[index + 2] = cell.biome.color_rgba[2];
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