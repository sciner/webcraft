import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {IndexedColor, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {noise, alea, Default_Terrain_Map, Default_Terrain_Map_Cell} from "../default.js";
// import {MineGenerator} from "../mine/mine_generator.js";
// import {DungeonGenerator} from "../dungeon.js";
// import FlyIslands from "../flying_islands/index.js";

// import { AABB } from '../../core/AABB.js';
import Demo_Map from "./demo_map.js";
// import BottomCavesGenerator from "../bottom_caves/index.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Terrain generator class
export default class Terrain_Generator extends Demo_Map {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        // this._createBlockAABB = new AABB();
        // this._createBlockAABB_second = new AABB();
        // this.temp_set_block = null;
        // this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {});
        // this.dungeon = new DungeonGenerator(seed);
    }

    async init() {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        // this.temp_vec       = new Vector(0, 0, 0);
        this.noise2d        = noise.perlin2;
        this.noise3d      = noise.perlin3;
        // this.maps           = new TerrainMapManager(this.seed, this.world_id, this.noisefn, this.noisefn3d);
    }

    // Draw fly islands in the sky
    drawFlyIslands(chunk) {
        if(!this.flying_islands) {
            return null;
        }
        const xyz = new Vector(0, 0, 0);
        const CHUNK_START_Y = 25;
        const coord = new Vector(0, 0, 0).copyFrom(chunk.coord);
        const addr = new Vector(0, 0, 0).copyFrom(chunk.addr);
        coord.y -= chunk.size.y * CHUNK_START_Y;
        addr.y -= CHUNK_START_Y;
        const fake_chunk = {...chunk, coord, addr};
        fake_chunk.setBlockIndirect = chunk.setBlockIndirect;
        return this.flying_islands.generate(fake_chunk);
    }

    // Generate
    generate(chunk) {

        const seed                      = chunk.id;
        const aleaRandom                = new alea(seed);
        // const maps                      = this.maps.generateAround(chunk, chunk.addr, true, true);
        // const map                       = maps[4];
        // const cluster                   = chunk.cluster;

        const xyz                       = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        const height                    = 80;
        // const temp_vec                  = new Vector(0, 0, 0);
        // const ywl                       = map.options.WATER_LINE - chunk.coord.y;

        //
        const water_id                  = BLOCK.STILL_WATER.id;
        const stone_block_id            = BLOCK.STONE.id;
        const grass_block_id            = BLOCK.GRASS_BLOCK.id;
        const dirt_block_id             = BLOCK.DIRT.id;

        const noise2d = this.noise2d;
        const noise3d = this.noise3d;

        //
        const generateMap = () => {
            const cell = {dirt_color: new IndexedColor(82, 450, 0), biome: new Default_Terrain_Map_Cell({
                code: 'Flat'
            })};
            return new Default_Terrain_Map(
                chunk.addr,
                chunk.size,
                chunk.addr.mul(chunk.size),
                {WATER_LINE: 63000},
                Array(chunk.size.x * chunk.size.z).fill(cell)
            );
        };

        if(!globalThis.sdfsdf) {
            globalThis.sdfsdf = true;
            globalThis.m = Infinity;
            globalThis.x = -Infinity;
        }

        //  1  6 16
        // 66 48 32

        const options = {
            min: {relief: 1, mid_level: 68},
            norm: {relief: 6, mid_level: 48},
            max: {relief: 12, mid_level: 32}
        };

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                const mh = Math.max(noise2d((chunk.coord.x + x) / 2048, (chunk.coord.z + z) / 2048) * 32, 8);

                let relief = options.norm.relief;
                let mid_level = options.norm.mid_level;

                xyz.set(chunk.coord.x + x, 0, chunk.coord.z + z);

                // Change relief
                const cx = Math.round((chunk.coord.x + x) / 2048) * 2048;
                const cz = Math.round((chunk.coord.z + z) / 2048) * 2048;
                let lx = cx - (chunk.coord.x + x);
                let lz = cz - (chunk.coord.z + z);
                const dist = Math.sqrt(lx * lx + lz * lz);
                const max_dist = 512;
                const w = 64;
                if((dist < max_dist)) {
                    const perc = 1 - Math.min( Math.max((dist - (max_dist - w)) / w, 0), 1);
                    const perc_side = noise2d(cx / 2048, cz / 2048);
                    if(perc_side < .35) {
                        relief -= ( (options.norm.relief - options.min.relief) * perc);
                        mid_level += ((options.min.mid_level - options.norm.mid_level) * perc);
                    } else {
                        relief += ( (options.max.relief - options.norm.relief) * perc);
                        mid_level -= ((options.norm.mid_level - options.max.mid_level) * perc);
                    }
                }

                //
                let mn = noise2d((chunk.coord.x + x) / 128, (chunk.coord.z + z) / 128);
                mn = (mn / 2 + .5) * relief;

                for(let y = 0; y < size_y; y++) {

                    xyz.set(chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);

                    let d = noise3d(xyz.x/100, xyz.y / 100, xyz.z/100) * 64;
                        d += noise3d(xyz.x/50, xyz.y / 50, xyz.z/50) * 32
                        d += noise3d(xyz.x/25, xyz.y / 25, xyz.z/25) * 16
                        d += noise3d(xyz.x/12.5, xyz.y / 12.5, xyz.z/12.5) * 8
                        d /= (64 + 32 + 16 + 8);

                    d = (d/2 + .5);

                    //if(xyz.y < 70) {
                    //    mid_level /= 8;
                    //}

                    let h = (mid_level - xyz.y) / mh;
                    h = 1 - Math.min(h, 1) / mn;

                    d *= h;

                    if(d > .15 && d < 1.) {
                        chunk.setBlockIndirect(x, y, z, grass_block_id);
                    } else {
                        if(xyz.y < 70) {
                            chunk.setBlockIndirect(x, y, z, water_id);
                        }
                    }

                }
            }
        }

        return generateMap();

    }

}