import { BLOCK } from '../../blocks.js';
import { BLOCK_FLAG, FAST } from '../../constant.js';
import { IndexedColor, Mth, Vector } from '../../helpers.js';
import type { ChunkWorkerChunk } from '../../worker/chunk.js';
import { BiomeTree, TREES } from '../biomes.js';
import { WATER_LEVEL } from './terrain/manager_vars.js';

const CACTUS_MIN_HEIGHT     = 2;
const CACTUS_MAX_HEIGHT     = 5;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015 * 32 * (FAST ? 1/4 : 1); // 0.48
const PLANTS_FREQUENCY      = 0.015 * (FAST ? 1/8 : 1);
const GRASS_FREQUENCY       = 0.015 * (FAST ? 1/8 : 1);

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS; // new IndexedColor(82, 450, 0);
const DEFAULT_WATER_COLOR = IndexedColor.WATER;

const DESERT_BUILDINGS = {others: [
    {class: 'BuildingBlocks', max_count: 3, chance: .1, block_templates: ['waterwell', 'waterwell2']},
    {class: 'Farmland',       max_count: Infinity, chance: .2},
    {class: 'BuildingBlocks', max_count: Infinity, chance: 1., block_templates: ['sand_house', 'sand_house_2']},
]}

const TAIGA_BUILDINGS = {others: [
    {class: 'BuildingBlocks', max_count: 3, chance: .1, block_templates: ['waterwell', 'waterwell2']},
    {class: 'Farmland',       max_count: Infinity, chance: .2},
    {class: 'BuildingBlocks', max_count: Infinity, chance: .7, block_templates: ['farmer_house']},
    {class: 'BuildingBlocks', max_count: Infinity, chance: 1., block_templates: ['tiny_house2']},
]}

export class BiomeDirtLayer {
    blocks : int[] = []
    cap_block_id : int = 0

    constructor(blocks : int[] = [], cap_block_id : int = 0) {
        this.blocks = blocks
        this.cap_block_id = cap_block_id
    }
}

class ChunkGroundBlockGenerator {

    percent : float = 1

    when : object = null
    height : {min: int, max: int}
    blocks : {name? : string, id? : int, extra_data? : any}[]

    constructor(percent : float = 1) {
        this.percent = Mth.clamp(percent, 0, 1)
    }

}

class BambooGenerator extends ChunkGroundBlockGenerator {

    height = {min: 6, max: 20}

    blocks = [
        {name: 'BAMBOO', extra_data: {stage: 2, notick: true}},
        {name: 'BAMBOO', extra_data: {stage: 2, notick: true}},
        {name: 'BAMBOO', extra_data: {stage: 1, notick: true}},
        {name: 'BAMBOO'}
    ]

    when = {
        under_good_for_plant: true,
        d2: {min: .1, max: .5},
        d3: {min: .1, max: .5}
    }

    generate(xyz : Vector, chunk : ChunkWorkerChunk, random_seed : float) : [] | null {
        const bm = chunk.chunkManager.block_manager
        const blockFlags = bm.flags
        const ids = chunk.tblocks.id
        let height = Math.floor(random_seed * (this.height.max - this.height.min)) + this.height.min
        let blocks = null
        const _hvec = new Vector(0, 0, 0)
        // check world blocks
        for(let h = 0; h < height; h++) {
            _hvec.copyFrom(xyz)
            _hvec.y += h
            const index = _hvec.worldPosToChunkIndex()
            const block_id = ids[index]
            if(blockFlags[block_id] & BLOCK_FLAG.SOLID) {
                height = h
                break
            }
        }
        if(height >= this.height.min) {
            blocks = new Array(height)
            for(let j = 0; j < height; j++) {
                const block = this.blocks[Math.min(j, this.blocks.length - 1)]
                blocks[height - 1 - j] = block
            }
        }
        return blocks
    }

}

export class Biome {

    id:                         int
    title:                      string

    temperature:                float
    temp:                       float
    humidity:                   float
    dirt_layers:                any[]

    trees:                      any
    plants:                     any
    grass:                      any
    ground_block_generators:    ChunkGroundBlockGenerator[]

    dirt_color:                 IndexedColor
    water_color:                IndexedColor
    no_smooth_heightmap:        boolean
    building_options:           any

    is_desert:                  boolean
    is_sand:                    boolean
    is_taiga:                   boolean
    is_swamp:                   boolean
    is_snowy:                   boolean
    is_grassy_surface:          boolean

    constructor(id : int, title : string, temperature : float, humidity : float, dirt_layers : any[], trees : any, plants : any, grass : any, ground_block_generators? : ChunkGroundBlockGenerator[], dirt_color? : IndexedColor, water_color? : IndexedColor, no_smooth_heightmap : boolean = false, building_options? : any) {
        this.id                         = id
        this.title                      = title
        this.temperature                = temperature
        this.temp                       = temperature
        this.humidity                   = humidity
        this.dirt_layers                = dirt_layers
        //
        this.trees                      = trees
        this.plants                     = plants
        this.grass                      = grass
        this.ground_block_generators    = ground_block_generators
        //
        this.dirt_color                 = dirt_color
        this.water_color                = water_color
        //
        this.no_smooth_heightmap        = no_smooth_heightmap
        this.building_options           = building_options
        // 
        this.is_desert                  = title.toLowerCase().indexOf('пустын') >= 0
        this.is_sand                    = this.is_desert || title.toLowerCase().indexOf('пляж') >= 0
        this.is_taiga                   = title.toLowerCase().indexOf('тайга') >= 0
        this.is_swamp                   = title.toLowerCase().indexOf('болото') >= 0
        // calc is_snowy
        this.is_snowy = title.toLowerCase().indexOf('заснеж') >= 0
        this.is_grassy_surface = false
        for(let dl of dirt_layers) {
            for(let block_id of dl.blocks) {
                if([BLOCK.SNOW_DIRT.id, BLOCK.ICE.id].includes(block_id)) {
                    this.is_snowy = true
                }
                if([BLOCK.GRASS_BLOCK.id].includes(block_id)) {
                    this.is_grassy_surface = true
                }
            }
        }
    }

}

export class Biomes {
    noise2d:        any
    scale:          number
    octaves:        number
    max_pow:        number
    pows:           any[]
    list:           any
    byName:         any
    byID:           any
    biomes_palette: any

    constructor(noise2d) {
        this.noise2d = noise2d;
        this.scale = 512;
        TREES.init();
        this.initBiomes();
        this.calcPalette();
        //
        this.octaves = 6;
        this.max_pow = Math.pow(2, this.octaves);
        this.pows = [];
        for(let i = 0; i < this.octaves; i++) {
            const value = Math.pow(2, this.octaves - i);
            this.pows.push(value);
        }
    }

    calcNoise(px : int, pz : int, t, div = 1.2) {
        const s = 1 * 40;
        let resp = 0;
        for(let i = 0; i < this.octaves; i++) {
            const d = this.pows[i];
            const shift = i * 1000 * t;
            const h = this.noise2d((px + shift) / (d * s), (pz + shift) / (d * s));
            resp += h * (d / this.max_pow);
        }
        return (resp / 2 + .5) / div;
    }

    addBiome(
        id: int,
        title : string,
        temperature : float,
        humidity: float,
        dirt_layers? : any[],
        trees? : any,
        plants? : any,
        grass? : any,
        dirt_color? : IndexedColor,
        water_color? : IndexedColor,
        building_options? : any,
        ground_block_generators? : any) {
        // const id = this.list.length + 1;
        if(!dirt_layers) {
            dirt_layers = [
                new BiomeDirtLayer([BLOCK.GRASS_BLOCK.id, BLOCK.DIRT.id, BLOCK.STONE.id]),
                new BiomeDirtLayer([BLOCK.STONE.id]),
                new BiomeDirtLayer([BLOCK.MOSS_BLOCK.id], BLOCK.STONE.id)
            ];
        }
        // trees
        if(!trees) {
            trees = {
                frequency: 0, // TREE_FREQUENCY,
                list: [
                    /*
                    {percent: .125, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {...TREES.OAK, percent: .125, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                    {...TREES.JUNGLE, percent: .125, height: {min: 16, max: 22}},
                    {...TREES.ACACIA, percent: .125, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                    {...TREES.SPRUCE, percent: .125, height: {min: 6, max: 24}},
                    {...TREES.BIRCH, percent: .125, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                    {...TREES.BROWN_MUSHROOM, percent: .125, height: {min: 5, max: 8}},
                    {...TREES.RED_MUSHROOM, percent: .125, height: {min: 8, max: 12}}
                    */
                ]
            };
        }
        // plants
        if(typeof plants == 'undefined') {
            plants = {
                frequency: PLANTS_FREQUENCY * 33.333,
                list: [
                    {percent: .01, blocks: [{name: 'RED_TULIP'}]},
                    {percent: .02, blocks: [{name: 'DANDELION'}]}
                ]
            };
        }
        // grass
        if(typeof grass == 'undefined') {
            grass = {
                frequency: GRASS_FREQUENCY * 33.333,
                list: [
                    {percent: .0125, blocks: [{name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}], when: {y: {min: WATER_LEVEL, max: WATER_LEVEL + 2}, d3: {min: .1, max: .15}}},
                    {percent: .0125, blocks: [{name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}], when: {y: {min: WATER_LEVEL, max: WATER_LEVEL + 2}, d3: {min: .15, max: .2}}},
                    {percent: .725, blocks: [{name: 'GRASS'}]},
                    {percent: .05, blocks: [{name: 'WINDFLOWERS'}]},
                    {percent: .05, blocks: [{name: 'BURDOCK'}]},
                    {percent: .005, blocks: [{name: 'PEBBLES'}]},
                    {percent: .005, blocks: [{name: 'PINK_PETALS'}]},
                    {percent: .13, blocks: [{name: 'TALL_GRASS'}, {name: 'TALL_GRASS', extra_data: {is_head: true}}]},
                    {percent: .005, blocks: [{name: 'PEONY'}, {name: 'PEONY', extra_data: {is_head: true}}]},
                    {percent: .005, blocks: [{name: 'LILAC'}, {name: 'LILAC', extra_data: {is_head: true}}]},
                    // {percent: .01, blocks: [{name: 'ROSE_BUSH'}, {name: 'ROSE_BUSH', extra_data: {is_head: true}}]},
                ]
            };
        }
        //
        for(let pack of [grass, plants, ground_block_generators]) {
            if(!pack) {
                continue
            }
            for(let pack_set of pack.list) {
                if(pack_set.blocks) {
                    for(let b of pack_set.blocks) {
                        const block = b.name ? BLOCK.fromName(b.name) : BLOCK.fromId(b.id)
                        if(!block) {
                            throw 'error_block_not_defined'
                        }
                        delete(b.name)
                        b.id = block.id
                        b.is_petals = block.tags.includes('is_petals')
                        b.is_grass = block.is_grass
                        b.is_flower = pack === plants
                    }
                }
            }
        }
        //
        if(trees?.list) {
            for(let tree of trees.list) {
                if(tree.trunk) {
                    const trunk_block = BLOCK.fromId(tree.trunk)
                    if(!trunk_block) throw 'invalid_trunk_block'
                    tree.transparent_trunk = trunk_block.transparent
                }
            }
        }
        //
        dirt_color = dirt_color ?? DEFAULT_DIRT_COLOR;
        water_color = water_color ?? DEFAULT_WATER_COLOR;
        const no_smooth_heightmap = true;
        const biome = new Biome(id, title, temperature, humidity, dirt_layers, trees, plants, grass, ground_block_generators, dirt_color, water_color, no_smooth_heightmap, building_options);
        this.list.push(biome);
        this.byName.set(title, biome);
        this.byID.set(biome.id, biome);
    }

    initBiomes() {

        this.byName = new Map();

        /**
         * @type {Map<string, Biome>}
         */
        this.byID = new Map();

        /**
         * @type { Biome[] }
         */
        this.list = [];
    
        // Снежные биомы
        const snow_dirt_layers = [
            new BiomeDirtLayer([BLOCK.SNOW_DIRT.id, BLOCK.DIRT.id, BLOCK.STONE.id]),
            new BiomeDirtLayer([BLOCK.STONE.id], BLOCK.SNOW.id)
        ];
        const snow_grass = {
            frequency: GRASS_FREQUENCY / 2,
            list: [
                {percent: .8, blocks: [{name: 'DEAD_BUSH'}]},
                {percent: .2, blocks: [{name: 'GRASS'}]}
            ]
        };
        this.addBiome(13, 'Заснеженные горы', -1, 0.5,               snow_dirt_layers, null, null, snow_grass);
        this.addBiome(140, 'Ледяные пики', -0.8, 0.5,                [new BiomeDirtLayer([BLOCK.ICE.id])]);
        this.addBiome(12, 'Заснеженная тундра', 0, 0.5,              snow_dirt_layers, null, null, snow_grass)
        this.addBiome(30, 'Заснеженная тайга', -0.8, 0.4,            snow_dirt_layers, {
            frequency: TREE_FREQUENCY * 2,
            list: [
                // {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {...TREES.SPRUCE, percent: 0.05, height: {min: 6, max: 24}},
                {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                {...TREES.SPRUCE, percent: 0.681 + 0.150, height: {min: 6, max: 11}}
            ]
        }, {
            frequency: PLANTS_FREQUENCY,
            list: [
                {percent: .5, blocks: [{name: 'BROWN_MUSHROOM'}]},
                {percent: .5, blocks: [{name: 'SWEET_BERRY_BUSH', extra_data: {'stage': 3, 'complete': true}}]},
            ]
        }, {
            frequency: GRASS_FREQUENCY * 10,
            list: [
                {percent: .578, blocks: [{name: 'GRASS'}]},
                {percent: .095, blocks: [{name: 'TALL_GRASS'}, {name: 'TALL_GRASS', extra_data: {is_head: true}}]},
                {percent: .300, blocks: [{name: 'FERN'}]},
                {percent: .0025, blocks: [{name: 'DEAD_BUSH'}]},
                {percent: .0025, blocks: [{name: 'PEBBLES'}]},
                {percent: .011, blocks: [{name: 'LARGE_FERN'}, {name: 'LARGE_FERN', extra_data: {is_head: true}}]},
            ]
        }, new IndexedColor(200, 510, 0), new IndexedColor(255, 255, 0), TAIGA_BUILDINGS);
        this.addBiome(31, 'Заснеженная холмистая тайга', -0.5, 0.4,  snow_dirt_layers, {
            frequency: TREE_FREQUENCY / 4,
            list: [
                // {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {...TREES.SPRUCE, percent: 0.05, height: {min: 6, max: 24}},
                {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                {...TREES.SPRUCE, percent: 0.681 + 0.150, height: {min: 6, max: 11}}
            ]
        }, null, snow_grass, new IndexedColor(232, 510, 0), new IndexedColor(236, 249, 0), TAIGA_BUILDINGS);
        this.addBiome(158, 'Заснеженная гористая тайга', -0.8, 0.4, snow_dirt_layers, null, null, snow_grass, new IndexedColor(232, 510, 0), new IndexedColor(236, 249, 0), TAIGA_BUILDINGS);
        this.addBiome(26, 'Заснеженный пляж', -0.05, 0.3, [new BiomeDirtLayer([BLOCK.SANDSTONE.id, BLOCK.STONE.id], BLOCK.SNOW.id), new BiomeDirtLayer([BLOCK.STONE.id], BLOCK.SNOW.id)], null, null, snow_grass, undefined, new IndexedColor(170, 225, 0)); // SNOWY_BEACH
        // this.addBiome('Замерзшая река', 0. -0.2);
        // this.addBiome('Замерзший океан', 0. -0.1);
        // this.addBiome('Глубокий замерзший океан', 0.8, -0.1);
    
        // Умеренные биомы
        this.addBiome(1, 'Равнины', 0.8, 0.4, undefined, {
            frequency: TREE_FREQUENCY / 12,
            list: [
                {...TREES.OAK, percent: .95, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                {...TREES.BIG_OAK, percent: .05}
            ]
        }, undefined, undefined, new IndexedColor(75, 435, 0));
        this.addBiome(129, 'Подсолнечниковые равнины', 0.8, 0.4);
        this.addBiome(4, 'Лес', 0.7, 0.8, null, {
            frequency: TREE_FREQUENCY * 3,
            list: [
                {percent: 0.01, trunk: TREES.BIRCH.trunk, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {...TREES.OAK, percent: 0.4},
                {...TREES.BIRCH, percent: 0.4},
                {...TREES.BIG_OAK, percent: .09},
                {...TREES.BIG_OAK, percent: .1, trunk: TREES.BIRCH.trunk, leaves: TREES.BIRCH.leaves},
            ]
        });
        this.addBiome(18, 'Холмистый лес', 0.7, 0.8);
        this.addBiome(132, 'Цветочный лес', 0.7, 0.8);
        this.addBiome(27, 'Березняк', 0.6, 0.6, null, {
            frequency: TREE_FREQUENCY * 1.2,
            list: [
                {percent: 0.01, trunk: TREES.BIRCH.trunk, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {...TREES.BIRCH, percent: 0.98, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                {...TREES.BIG_OAK, percent: .008, trunk: TREES.BIRCH.trunk, leaves: TREES.BIRCH.leaves},
                {...TREES.RED_MUSHROOM, percent: .002, height: {min: 8, max: 12}},
            ]
        }, undefined, undefined, new IndexedColor(70, 370, 0));
        this.addBiome(28, 'Холмистый березняк', 0.6, 0.6);
        this.addBiome(155, 'Крупномерный березняк', 0.6, 0.6);
        this.addBiome(156, 'Крупномерный холмистый березняк', 0.6, 0.6);
        this.addBiome(29, 'Темный лес', 0.7, 0.8);
        this.addBiome(159, 'Холмистый темный лес', 0.7, 0.8);
        this.addBiome(6, 'Болото', 0.8, 0.9, undefined, {
            frequency: TREE_FREQUENCY * .25,
            list: [
                {percent: .95, trunk: TREES.OAK.trunk, leaves: BLOCK.OAK_LEAVES.id, style: 'acacia', height: {min: 3, max: 7}},
                {...TREES.BIG_OAK, percent: .05}
            ]
        }, {
            frequency: PLANTS_FREQUENCY,
            list: [
                {percent: .5, blocks: [{name: 'RED_MUSHROOM'}]},
                {percent: .45, blocks: [{name: 'BROWN_MUSHROOM'}]},
            ]
        }, {
            frequency: GRASS_FREQUENCY * 100,
            list: [
                {percent: .0125, blocks: [{name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}, {name: 'SUGAR_CANE'}], when: {y: {min: WATER_LEVEL, max: WATER_LEVEL + 2}, d3: {min: .1, max: .15}}},
                {percent: .7375, blocks: [{name: 'GRASS'}]},
                {percent: .05, blocks: [{name: 'WINDFLOWERS'}]},
                {percent: .05, blocks: [{name: 'BURDOCK'}]},
                {percent: .005, blocks: [{name: 'PEBBLES'}]},
                {percent: .005, blocks: [{name: 'PINK_PETALS'}]},
                {percent: .14, blocks: [{name: 'TALL_GRASS'}, {name: 'TALL_GRASS', extra_data: {is_head: true}}]}
            ]
        }, new IndexedColor(140, 480, 0), new IndexedColor(1, 254, 0));
        this.addBiome(134, 'Холмистое болото', 0.8, 0.9);
        this.addBiome(16, 'Пляж', 0.8, 0.4, [new BiomeDirtLayer([BLOCK.SANDSTONE.id, BLOCK.SAND.id]), new BiomeDirtLayer([BLOCK.STONE.id])]);
        // this.addBiome('Река', 0.5, 0.5);
        // this.addBiome('Океан', 0.5, 0.5);
        // this.addBiome('Глубокий океан', 0.5, 0.5);
        // this.addBiome('Умеренный океан', 0.8, 0.5);
        // this.addBiome('Глубокий умеренный океан.', 0.8, 0.5);

        // Теплые биомы
        this.addBiome(21, 'Джунгли', 0.95, 0.9, undefined, {
                frequency: TREE_FREQUENCY * 40,
                list: [
                    {...TREES.JUNGLE, percent: .025, height: {min: 16, max: 22}},
                    {...TREES.JUNGLE, percent: .1, height: {min: 9, max: 14}},
                    {...TREES.JUNGLE, percent: .4, height: {min: 3, max: 8}},
                    {...TREES.JUNGLE, percent: .2 + .175, height: {min: 1, max: 1}},
                    // bamboo
                    {percent: .1, trunk: BLOCK.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
                ]
            }, {
                frequency: GRASS_FREQUENCY * 5.8,
                list: [
                    {percent: .600, blocks: [{name: 'OAK_LEAVES'}]},
                    {percent: .327, blocks: [{name: 'GRASS'}]},
                    {percent: .053, blocks: [{name: 'TALL_GRASS'}, {name: 'TALL_GRASS', extra_data: {is_head: true}}]},
                    {percent: .010, blocks: [{name: 'RED_TULIP'}]},
                    {percent: .005, blocks: [{name: 'MELON', not_transparent: true}]},
                    {percent: .005, blocks: [{name: 'DANDELION'}]}
                ]
            }, {
                frequency: GRASS_FREQUENCY * 100,
                list: [
                    {percent: .500, blocks: [{name: 'GRASS'}]},
                    {percent: .400, blocks: [{name: 'TALL_GRASS'}, {name: 'TALL_GRASS', extra_data: {is_head: true}}]},
                    {percent: .027, blocks: [{name: 'OAK_LEAVES'}]},
                    {percent: .010, blocks: [{name: 'RED_TULIP'}]},
                    {percent: .005, blocks: [{name: 'MELON', not_transparent: true}]},
                    {percent: .005, blocks: [{name: 'DANDELION'}]}
                ]
            }, new IndexedColor(32, 345, 0), new IndexedColor(20, 140, 0));
        this.addBiome(149, 'Рельефные джунгли', 0.95, 0.9);
        this.addBiome(22, 'Холмистые джунгли', 0.95, 0.9);
        this.addBiome(23, 'Окраина джунглей', 0.95, 0.8, undefined, {
                frequency: TREE_FREQUENCY * 4,
                list: [
                    {...TREES.JUNGLE, percent: .025, height: {min: 16, max: 22}},
                    {...TREES.JUNGLE, percent: .1, height: {min: 9, max: 14}},
                    {...TREES.JUNGLE, percent: .4, height: {min: 3, max: 8}},
                    {...TREES.JUNGLE, percent: .2, height: {min: 1, max: 1}},
                    // bamboo
                    {percent: .1, trunk: BLOCK.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
                ]
            }, {
                frequency: PLANTS_FREQUENCY * .8,
                list: [
                    {percent: .1, blocks: [{name: 'RED_TULIP'}]},
                    {percent: .4, blocks: [{name: 'MELON', not_transparent: true}]},
                    {percent: .5, blocks: [{name: 'DANDELION'}]}
                ]
            }, {
                frequency: GRASS_FREQUENCY * 100,
                list: [
                    {percent: .2, blocks: [{name: 'OAK_LEAVES'}]},
                    {percent: .3, blocks: [{name: 'GRASS'}]},
                    {percent: .5, blocks: [{name: 'TALL_GRASS'}, {name: 'TALL_GRASS', extra_data: {is_head: true}}]},
                ]
            }, new IndexedColor(32, 345, 0), new IndexedColor(20, 140, 0), undefined, {
                frequency: GRASS_FREQUENCY * 10,
                list: [
                    new BambooGenerator(1)
                ]
            });
        this.addBiome(151, 'Рельефная окраина джунглей', 0.95, 0.8);
        this.addBiome(168, 'Бамбуковые джунгли', 0.95, 0.9);
        this.addBiome(169, 'Холмистые бамбуковые джунгли', 0.95, 0.9);
        this.addBiome(14, 'Грибные поля', 0.9, 1, undefined, {
            frequency: TREE_FREQUENCY / 4,
            list: [
                {...TREES.BROWN_MUSHROOM, percent: .5, height: {min: 5, max: 8}},
                {...TREES.RED_MUSHROOM, percent: .5, height: {min: 8, max: 12}}
            ]
        }, {
            frequency: PLANTS_FREQUENCY * 5,
            list: [
                {percent: .5, blocks: [{name: 'RED_MUSHROOM'}]},
                {percent: .5, blocks: [{name: 'BROWN_MUSHROOM', not_transparent: true}]}
            ]
        });
        this.addBiome(15, 'Грибной берег', 0.9, 1);
        this.addBiome(2, 'Пустыня', 2, 0,
            [
                new BiomeDirtLayer([BLOCK.SAND.id, BLOCK.SANDSTONE.id, BLOCK.STONE.id]),
                new BiomeDirtLayer([BLOCK.STONE.id])
            ],
            {
                frequency: TREE_FREQUENCY / 10,
                list: [
                    new BiomeTree(BLOCK.CACTUS.id, null, 'cactus', {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}, 1)
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .1, blocks: [{name: 'PEBBLES'}]},
                    {percent: .9, blocks: [{name: 'DEAD_BUSH'}]}
                ]
            },
            null, undefined, undefined, DESERT_BUILDINGS
        );
        this.addBiome(17, 'Холмистая пустыня', 2, 0,
            [
                new BiomeDirtLayer([BLOCK.SAND.id, BLOCK.SANDSTONE.id])
            ],
            {
                frequency: TREE_FREQUENCY / 2,
                list: [
                    new BiomeTree(BLOCK.CACTUS.id, null, 'cactus', {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}, 1)
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .1, blocks: [{name: 'PEBBLES'}]},
                    {percent: .9, blocks: [{name: 'DEAD_BUSH'}]}
                ]
            },
            null, undefined, undefined, DESERT_BUILDINGS
        );
        this.addBiome(130, 'Пустынные озера', 2, 0);
        this.addBiome(35, 'Саванна', 1.2, 0, undefined, {
            frequency: TREE_FREQUENCY,
            list: [
                {...TREES.ACACIA, percent: .9, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                {...TREES.ACACIA, percent: .1, height: {min: TREE_MIN_HEIGHT, max: 1}},
            ]
        }, null, undefined, new IndexedColor(0, 510, 0), new IndexedColor(128, 194, 0));
        this.addBiome(36, 'Плато саванны', 1, 0, undefined, {
            frequency: TREE_FREQUENCY,
            list: [
                {...TREES.ACACIA, percent: .25, height: {min: 2, max: 2}},
                {...TREES.ACACIA, percent: .75, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                // {percent: .05, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}},
                // {percent: .05, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}}
            ]
        }, null, undefined, new IndexedColor(0, 510, 0), new IndexedColor(128, 194, 0));
        this.addBiome(163, 'Выветренная саванна', 1.1, 0, undefined, undefined, undefined, undefined, new IndexedColor(0, 510, 0), new IndexedColor(128, 194, 0));
        this.addBiome(164, 'Плато выветренной саванны', 1, 0, undefined, undefined, undefined, undefined, new IndexedColor(0, 510, 0), new IndexedColor(128, 194, 0));
        this.addBiome(37, 'Пустошь', 2, 0);
        this.addBiome(165, 'Выветренная пустошь', 2, 0);
        this.addBiome(39, 'Плато пустоши', 2, 0);
        this.addBiome(167, 'Рельефное плато пустоши', 2, 0);
        this.addBiome(38, 'Лесистое плато пустоши', 2, 0);
        this.addBiome(166, 'Рельефное лесистое плато пустоши', 2, 0);
        // this.addBiome('Теплый океан', 0.8, 0.5);
    
        /*
        this.addBiome('Пустоши нижнего мира', 2, 0);
        this.addBiome('Базальтовые дельты', 2, 0);
        this.addBiome('Искаженный лес', 2, 0);
        this.addBiome('Багровый лес', 2, 0);
        this.addBiome('Долина песка душ', 2, 0);
        */

        this.addBiome(500, 'Летающие острова', .911, .911);

    }

    /**
     */
    getPaletteBiome(x: int, z: int): Biome {
        x = x | 0
        z = z | 0
        const palette_index = z * this.scale + x
        return this.biomes_palette[palette_index]
    }

    calcPalette() {

        this.biomes_palette = new Array(this.scale * this.scale);

        let m = new Map();
        // debugger
        for(let x = 0; x < this.scale; x++) {
            for(let z = 0; z < this.scale; z++) {
                const temp = x / this.scale
                const temp_value = temp * 3 - 1;
                const humidity = z / this.scale;
                const humidity_value = humidity // * 2 - 1;
                let min_dist = Infinity;
                let biome = null;
                for(let bi in this.list) {
                    const b = this.list[bi];
                    const dist = Math.sqrt((temp_value - b.temperature) * (temp_value - b.temperature) +
                                 (humidity_value - b.humidity) * (humidity_value - b.humidity))
                    if(dist < min_dist) {
                        min_dist = dist;
                        biome = b;
                        m.set(bi, b)
                    }
                }
                this.biomes_palette[z * this.scale + x] = biome;
            }
        }

    }

    /**
     * @param {ClimateParams} Params 
     * @returns { Biome }
     */
    getBiome(params) {

        /*
        const temp_value = temp * 3 - 1;
        const humidity_value = humidity * 2 - 1;
        let min_dist = Infinity;
        let biome;
        for(let bi in this.list) {
            const b = this.list[bi];
            const dist = (temp_value - b.temp) * (temp_value - b.temp) + (humidity_value - b.humidity) * (humidity_value - b.humidity);
            if(dist < min_dist) {
                min_dist = dist;
                biome = b;
            }
        }
        return biome;
        */

        // return this.byName.get('Холмистая пустыня')

        let x = Math.floor(this.scale * params.temperature);
        let z = Math.floor(this.scale * params.humidity);
        x = Math.max(Math.min(x, this.scale - 1), 0)
        z = Math.max(Math.min(z, this.scale - 1), 0)

        const resp = this.biomes_palette[z * this.scale + x]
        if(!resp) {
            throw 'error_empty_biome'
        }
        return resp;
    }

}