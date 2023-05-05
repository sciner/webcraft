import { BLOCK } from '../../blocks.js';
import { BLOCK_FLAG, DEFAULT_DIRT_PALETTE, GRASS_PALETTE_OFFSET, FAST } from '../../constant.js';
import { Environment, IFogPreset } from '../../environment.js';
import { IndexedColor, Mth, Vector } from '../../helpers.js';
import type { ChunkWorkerChunk } from '../../worker/chunk.js';
import { BiomeTree, IBiomeTree, TREES } from '../biome2/biomes.js';
import { DensityParams, WATER_LEVEL } from './terrain/manager_vars.js';

const CACTUS_MIN_HEIGHT         = 2;
const CACTUS_MAX_HEIGHT         = 5;
const TREE_MIN_HEIGHT           = 4;
const TREE_MAX_HEIGHT           = 8;
const TREE_FREQUENCY            = 1 // 0.015 * 32 * (FAST ? 1/4 : 1); // 0.48
const UNDERWATER_TREE_FREQUENCY = FAST ? 1/4 : 1
const PLANTS_FREQUENCY          = 0.015 * (FAST ? 1/8 : 1);
const GRASS_FREQUENCY           = 0.015 * (FAST ? 1/8 : 1);

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS
const DEFAULT_WATER_COLOR = IndexedColor.WATER

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

const NETHER_BUILDINGS = {
    crossroad: [
        {class: 'BuildingBlocks', max_count: Infinity, chance: 1, block_templates: ['nether_streetlight', 'nether_streetlight2']}
    ],
    others: [
        {class: 'BuildingBlocks', max_count: 3, chance: .1, block_templates: ['waterwell', 'waterwell2']},
        // {class: 'Farmland',       max_count: Infinity, chance: .2},
        {class: 'BuildingBlocks', max_count: Infinity, chance: 0.6, block_templates: ['nether_house', 'nether_manor', 'tiny_nether_house']},
        {class: 'BuildingBlocks', max_count: Infinity, chance: 1., block_templates: ['tiny_nether_house']},
    ]
}

const DEFAULT_RIVER_BOTTOM_BLOCKS = [
    {value: 0, block_name: 'DIRT'},
    {value: .3, block_name: 'GRAVEL'},
    {value: 1, block_name: 'SAND'}
]

const DEFAULT_BIG_STONE_BLOCKS = [
    {value: 0, block_name: 'TUFF'},
    {value: .5, block_name: 'STONE'},
    {value: 1, block_name: 'MOSSY_COBBLESTONE'}
]

const DEFAULT_PLANTS = {
    frequency: PLANTS_FREQUENCY * 33.333,
    list: [
        {percent: .01, blocks: [{name: 'RED_TULIP'}]},
        {percent: .02, blocks: [{name: 'DANDELION'}]}
    ]
}

const DEFAULT_GRASS = {
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
}

export declare type ITreeList = {
    frequency: float
    list: IBiomeTree[]
}

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
        const {worldPosToChunkIndex} = chunk.chunkManager.grid.math;
        const blockFlags = bm.flags
        const ids = chunk.tblocks.id
        let height = Math.floor(random_seed * (this.height.max - this.height.min)) + this.height.min
        let blocks = null
        const _hvec = new Vector(0, 0, 0)
        // check world blocks
        for(let h = 0; h < height; h++) {
            _hvec.copyFrom(xyz)
            _hvec.y += h
            const index = worldPosToChunkIndex(_hvec)
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
    river_bottom_blocks:        IRiverBottomBlocks
    big_stone_blocks:           IRiverBottomBlocks
    blocks?:                    { [key: string]: IBlockMaterial; } = {}

    trees:                      ITreeList
    underwater_trees:           ITreeList
    plants:                     any
    grass:                      any
    ground_block_generators:    ChunkGroundBlockGenerator[]

    dirt_palette:               DirtPalette
    grass_palette:              DirtPalette
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
    is_underworld:              boolean
    hanging_foliage_block_id:   any
    fog_preset_name?:           string

    constructor(id : int, title : string, temperature : float, humidity : float, dirt_layers : any[], trees : any, plants : any, grass : any, dirt_color : IndexedColor, water_color : IndexedColor, ground_block_generators? : ChunkGroundBlockGenerator[], no_smooth_heightmap : boolean = false, building_options? : any, river_bottom_blocks ?: IRiverBottomBlocks, big_stone_blocks ?: IRiverBottomBlocks, blocks ?: { [key: string]: string; }, dirt_palette? : DirtPalette, fog_preset? : IFogPreset, underwater_trees? : ITreeList) {
        this.id                         = id
        this.title                      = title
        this.temperature                = temperature
        this.temp                       = temperature
        this.humidity                   = humidity
        this.dirt_layers                = dirt_layers
        this.river_bottom_blocks        = river_bottom_blocks
        this.big_stone_blocks           = big_stone_blocks
        //
        this.trees                      = trees
        this.underwater_trees           = underwater_trees
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
                if([BLOCK.NETHERRACK.id].includes(block_id)) {
                    this.is_underworld = true
                }
            }
        }
        //
        for(let block_set of [river_bottom_blocks, big_stone_blocks]) {
            for(let item of block_set) {
                if(!item.block) {
                    item.block = BLOCK.fromName(item.block_name)
                    if(!item.block) throw 'invalid_river_bottom_block'
                }
            }
        }

        this.blocks.hanging_foliage = this.is_snowy ? BLOCK.ICE : BLOCK.OAK_LEAVES

        // register fog preset
        if(typeof fog_preset != 'undefined') {
            this.fog_preset_name = `biomeFog${id}`
            Environment.registerFogPreset(this.fog_preset_name, fog_preset)
        }

        //
        if(typeof dirt_palette == 'undefined') {
            dirt_palette = DEFAULT_DIRT_PALETTE
        }
        this.dirt_palette = dirt_palette
        this.grass_palette = {
            x:              dirt_palette.x + GRASS_PALETTE_OFFSET.x,
            y:              dirt_palette.y + GRASS_PALETTE_OFFSET.y,
            w:              dirt_palette.w,
            h:              dirt_palette.h,
            noise_range:    dirt_palette.noise_range,
        } as DirtPalette

        if(blocks) {
            for(let k in blocks) {
                const block = BLOCK.fromName(blocks[k])
                if(!block) throw 'invalid_river_bottom_block'
                this.blocks[k] = block
            }
        }

    }

    getRiverBottomBlock(density_params : DensityParams, blocks? : IRiverBottomBlocks) : int {
        let block_id = 0
        if(!blocks) {
            blocks = this.river_bottom_blocks
        }
        const d4 = density_params.d4
        for(let i = 0; i < blocks.length; i++) {
            const item = blocks[i]
            if(d4 <= item.value) {
                block_id = item.block.id
                break
            }
        }
        if(block_id == 0) {
            throw 'error_river_bottom_block_not_selected'
        }
        return block_id
    }

    getBigStoneBlock(density_params : DensityParams) : int {
        return this.getRiverBottomBlock(density_params, this.big_stone_blocks)
    }

}

declare type IRiverBottomBlocks = {value: float, block_name: string, block ?: IBlockMaterial}[]

export class Biomes {
    noise2d:            any
    scale:              number
    octaves:            number
    max_pow:            number
    pows:               any[]
    list:               any
    byName:             Map<string, Biome>
    byID:               Map<int, Biome>
    biomes_palette:     any
    filter_biome_list:  int[]

    constructor(noise2d : Function, filter_biome_list : int[] = []) {
        this.filter_biome_list = filter_biome_list
        this.noise2d = noise2d;
        this.scale = 512;
        TREES.init();
        this.initBiomes()
        this.calcPalette()
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
        id:                         int,
        title:                      string,
        temperature:                float,
        humidity:                   float,
        dirt_layers? :              any[],
        trees?:                     ITreeList,
        plants?:                    any,
        grass?:                     any,
        dirt_color?:                IndexedColor,
        water_color?:               IndexedColor,
        building_options?:          any,
        ground_block_generators?:   any,
        river_bottom_blocks?:       IRiverBottomBlocks,
        blocks?:                    { [key: string]: string; },
        dirt_palette?:              DirtPalette,
        big_stone_blocks?:          IRiverBottomBlocks,
        fog_preset?:                IFogPreset,
        underwater_trees?:          ITreeList) : Biome | null {

        if(this.filter_biome_list.length > 0 && !this.filter_biome_list.includes(id)) {
            return null
        }

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
        // Underwater trees
        if(typeof underwater_trees == 'undefined') {
            const DEFAULT_UNDERWATER_TREES = {
                frequency: 0,
                list: []
            }
            const TROPIC_UNDERWATER_TREES = {
                frequency: UNDERWATER_TREE_FREQUENCY,
                list: [
                    {...TREES.CORAL_PAW, percent: .333},
                    {...TREES.CORAL_MUSHROOM, percent: .333},
                    {...TREES.CORAL_TREE, percent: .334},
                ]
            }
            underwater_trees = title.includes('жунгл') ? TROPIC_UNDERWATER_TREES : DEFAULT_UNDERWATER_TREES;
        }
        // plants
        if(typeof plants == 'undefined') {
            plants = DEFAULT_PLANTS
        }
        // grass
        if(typeof grass == 'undefined') {
            grass = DEFAULT_GRASS;
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
                        b.is_flower = block.is_flower
                    }
                }
            }
        }
        //
        for(let list of [trees?.list, underwater_trees?.list]) {
            if(!list) {
                continue
            }
            for(let tree of list) {
                tree.underwater = !!tree.underwater
                if(tree.trunk) {
                    const trunk_block = BLOCK.fromId(tree.trunk)
                    if(!trunk_block) throw 'invalid_trunk_block'
                    tree.transparent_trunk = trunk_block.transparent
                }
            }
        }
        //
        if(typeof river_bottom_blocks == 'undefined') {
            river_bottom_blocks = DEFAULT_RIVER_BOTTOM_BLOCKS
        }
        //
        if(typeof big_stone_blocks == 'undefined') {
            big_stone_blocks = DEFAULT_BIG_STONE_BLOCKS
        }
        //
        dirt_color = dirt_color ?? DEFAULT_DIRT_COLOR
        water_color = water_color ?? DEFAULT_WATER_COLOR
        const no_smooth_heightmap = true;
        const biome = new Biome(id, title, temperature, humidity, dirt_layers, trees, plants, grass, dirt_color, water_color, ground_block_generators, no_smooth_heightmap, building_options, river_bottom_blocks, big_stone_blocks, blocks, dirt_palette, fog_preset, underwater_trees)
        this.list.push(biome);
        this.byName.set(title, biome);
        this.byID.set(biome.id, biome);
        return biome
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
            frequency: TREE_FREQUENCY / 2,
            list: [
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
        }, new IndexedColor(100, 383, 0), new IndexedColor(255, 255, 0), TAIGA_BUILDINGS);
        this.addBiome(31, 'Заснеженная холмистая тайга', -0.5, 0.4,  snow_dirt_layers, {
            frequency: TREE_FREQUENCY / 2,
            list: [
                // {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, basis: BLOCK.SAND.id, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {...TREES.SPRUCE, percent: 0.05, height: {min: 6, max: 24}},
                {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                {...TREES.SPRUCE, percent: 0.681 + 0.150, height: {min: 6, max: 11}}
            ]
        }, null, snow_grass, new IndexedColor(116, 383, 0), new IndexedColor(236, 249, 0), TAIGA_BUILDINGS);
        this.addBiome(158, 'Заснеженная гористая тайга', -0.8, 0.4, snow_dirt_layers, null, null, snow_grass, new IndexedColor(116, 383, 0), new IndexedColor(236, 249, 0), TAIGA_BUILDINGS);
        this.addBiome(26, 'Заснеженный пляж', -0.05, 0.3, [new BiomeDirtLayer([BLOCK.SANDSTONE.id, BLOCK.STONE.id], BLOCK.SNOW.id), new BiomeDirtLayer([BLOCK.STONE.id], BLOCK.SNOW.id)], null, null, snow_grass, undefined, new IndexedColor(170, 225, 0)); // SNOWY_BEACH
        // this.addBiome('Замерзшая река', 0. -0.2);
        // this.addBiome('Замерзший океан', 0. -0.1);
        // this.addBiome('Глубокий замерзший океан', 0.8, -0.1);

        // Умеренные биомы
        this.addBiome(1, 'Равнины', 0.8, 0.4, undefined, {
            frequency: TREE_FREQUENCY / 20,
            list: [
                {...TREES.OAK, percent: .95, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                {...TREES.BIG_OAK, percent: .05}
            ]
        }, undefined, undefined, new IndexedColor(37, 345, 0));
        this.addBiome(129, 'Подсолнечниковые равнины', 0.8, 0.4);
        this.addBiome(4, 'Лес', 0.7, 0.8, null, {
            frequency: TREE_FREQUENCY / 2,
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
            frequency: TREE_FREQUENCY / 4,
            list: [
                {percent: 0.01, trunk: TREES.BIRCH.trunk, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {...TREES.BIRCH, percent: 0.98, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                {...TREES.BIG_OAK, percent: .008, trunk: TREES.BIRCH.trunk, leaves: TREES.BIRCH.leaves},
                {...TREES.RED_MUSHROOM, percent: .002, height: {min: 8, max: 12}},
            ]
        }, undefined, undefined, new IndexedColor(35, 313, 0));
        this.addBiome(28, 'Холмистый березняк', 0.6, 0.6);
        this.addBiome(155, 'Крупномерный березняк', 0.6, 0.6);
        this.addBiome(156, 'Крупномерный холмистый березняк', 0.6, 0.6);
        this.addBiome(29, 'Темный лес', 0.7, 0.8);
        this.addBiome(159, 'Холмистый темный лес', 0.7, 0.8);
        this.addBiome(6, 'Болото', 0.8, 0.9, undefined, {
            frequency: TREE_FREQUENCY / 16,
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
        }, new IndexedColor(70, 368, 0), new IndexedColor(1, 254, 0), undefined, undefined, undefined, undefined, undefined, undefined, {
            color: [94 / 255, 113 / 255, 75 / 255, 0.1],
            addColor: [94 / 255, 113 / 255, 75 / 255, 0.1],
            density: 0.05,
            illuminate: 0.15,
        });
        this.addBiome(134, 'Холмистое болото', 0.8, 0.9);
        this.addBiome(16, 'Пляж', 0.8, 0.4, [new BiomeDirtLayer([BLOCK.SANDSTONE.id, BLOCK.SAND.id]), new BiomeDirtLayer([BLOCK.STONE.id])]);
        // this.addBiome('Река', 0.5, 0.5);
        // this.addBiome('Океан', 0.5, 0.5);
        // this.addBiome('Глубокий океан', 0.5, 0.5);
        // this.addBiome('Умеренный океан', 0.8, 0.5);
        // this.addBiome('Глубокий умеренный океан.', 0.8, 0.5);

        // Теплые биомы
        this.addBiome(21, 'Джунгли', 0.95, 0.9, undefined, {
                frequency: TREE_FREQUENCY,
                list: [
                    {...TREES.JUNGLE, percent: .025, height: {min: 16, max: 22}},
                    {...TREES.JUNGLE, percent: .1, height: {min: 9, max: 14}},
                    {...TREES.JUNGLE, percent: .4, height: {min: 3, max: 8}},
                    {...TREES.JUNGLE, percent: .375, height: {min: 1, max: 1}},
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
            }, new IndexedColor(16, 300, 0), new IndexedColor(20, 140, 0));
        this.addBiome(149, 'Рельефные джунгли', 0.95, 0.9);
        this.addBiome(22, 'Холмистые джунгли', 0.95, 0.9);
        this.addBiome(23, 'Окраина джунглей', 0.95, 0.8, undefined, {
                frequency: TREE_FREQUENCY,
                list: [
                    // {...TREES.JUNGLE, percent: 1, height: {min: 9, max: 14}},
                    {...TREES.JUNGLE, percent: .025, height: {min: 16, max: 22}},
                    {...TREES.JUNGLE, percent: .1, height: {min: 9, max: 14}},
                    {...TREES.JUNGLE, percent: .4, height: {min: 3, max: 8}},
                    {...TREES.JUNGLE, percent: .375, height: {min: 1, max: 1}},
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
            },
            new IndexedColor(16, 300, 0), new IndexedColor(20, 140, 0), undefined, {
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
                frequency: TREE_FREQUENCY / 40,
                list: [
                    new BiomeTree('CACTUS', null, 'cactus', {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}, 1, false, BLOCK.SAND.id)
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .195, blocks: [{name: 'PEBBLES'}]},
                    {percent: .005, blocks: [{name: 'SKULL_DESERT'}]},
                    {percent: .1, blocks: [{name: 'SMALL_CACTUS'}]},
                    {percent: .1, blocks: [{name: 'SANDED_STONES'}]},
                    {percent: .1, blocks: [{name: 'SMALL_STONES_DESERT'}]},
                    {percent: .5, blocks: [{name: 'DEAD_BUSH'}]}
                ]
            },
            null, undefined, undefined, DESERT_BUILDINGS
        );
        this.addBiome(17, 'Холмистая пустыня', 2, 0,
            [
                new BiomeDirtLayer([BLOCK.SAND.id, BLOCK.SANDSTONE.id])
            ],
            {
                frequency: TREE_FREQUENCY / 10,
                list: [
                    new BiomeTree('CACTUS', null, 'cactus', {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}, 1)
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
            frequency: TREE_FREQUENCY / 4,
            list: [
                {...TREES.ACACIA, percent: .9, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                {...TREES.ACACIA, percent: .1, height: {min: TREE_MIN_HEIGHT, max: 1}},
            ]
        }, null, undefined, new IndexedColor(0, 383, 0), new IndexedColor(128, 194, 0));
        this.addBiome(36, 'Плато саванны', 1, 0, undefined, {
            frequency: TREE_FREQUENCY / 4,
            list: [
                {...TREES.ACACIA, percent: .25, height: {min: 2, max: 2}},
                {...TREES.ACACIA, percent: .75, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                // {percent: .05, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}},
                // {percent: .05, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}}
            ]
        }, null, undefined, new IndexedColor(0, 383, 0), new IndexedColor(128, 194, 0));
        this.addBiome(163, 'Выветренная саванна', 1.1, 0, undefined, undefined, undefined, undefined, new IndexedColor(0, 383, 0), new IndexedColor(128, 194, 0));
        this.addBiome(164, 'Плато выветренной саванны', 1, 0, undefined, undefined, undefined, undefined, new IndexedColor(0, 383, 0), new IndexedColor(128, 194, 0));
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

        this.addBiome(500, 'Летающие острова', .911, .911, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, undefined, undefined, undefined,
            {
                color: [205 / 255, 200 / 255, 150 / 255, 0.1],
                addColor: [205 / 255, 200 / 255, 150 / 255, 0.1],
                density: 0.05,
                illuminate: 0.15,
            }
        )
        this.addBiome(
            501,
            'Эреб',
            .912,
            .912,
            [
                new BiomeDirtLayer([BLOCK.NETHERRACK.id])
            ],
            {
                frequency: .4,
                list: [
                    {percent: .2, trunk: BLOCK.ANCIENT_DEBRIS.id, leaves: BLOCK.WARPED_FENCE.id, basis: BLOCK.NETHERRACK.id, style: 'peak', height: {min: CACTUS_MIN_HEIGHT * 2, max: CACTUS_MAX_HEIGHT * 3}},
                    // {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    // {...TREES.SPRUCE, percent: 0.05, height: {min: 6, max: 24}},
                    {percent: .3, trunk: BLOCK.GLOWSTONE.id, leaves: null, style: 'tundra_stone', height: {min: 1, max: 2}},
                    // {percent: .333, trunk: BLOCK.MAGMA_BLOCK.id, leaves: null, style: 'tundra_stone', height: {min: 1, max: 2}},
                    {...TREES.RED_MUSHROOM, percent: .2, height: {min: 8, max: 12}, basis: null},
                    {...TREES.OAK, percent: .1, trunk: BLOCK.CRIMSON_STEM.id, leaves: BLOCK.SHROOMLIGHT.id, basis: null},
                    {percent: .2, trunk: BLOCK.SHROOMLIGHT.id, leaves: null, style: 'tundra_stone', height: {min: 1, max: 2}},
                    // {...TREES.SPRUCE, percent: 0.681 + 0.150, height: {min: 6, max: 11}}
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .1, blocks: [{name: 'PEBBLES'}]},
                    // {percent: .1, blocks: [{name: 'FIRE', extra_data: {up: true, age: .5}}]}
                ]
            },
            {
                frequency: .1,
                list: [
                    {percent: .1, blocks: [{name: 'GRASS'}]},
                ]
            },
            new IndexedColor(0, 511, 0),
            new IndexedColor(12, 268, 0),
            NETHER_BUILDINGS,
            undefined,
            [
                {value: 1, block_name: 'DEEPSLATE'}
            ],
            {
                hanging_foliage:    'ANCIENT_DEBRIS',
                basement:           'NETHERRACK',
                dirt_path:          'NETHER_BRICKS',
                caves_second:       'NETHER_BRICKS',
            },
            {x: 0, y : 384, w: 128, h : 128, noise_range: 10} as DirtPalette,
            [
                {value: 0, block_name: 'SMOOTH_BASALT'},
                {value: .5, block_name: 'NETHER_BRICKS'},
                {value: 1, block_name: 'SOUL_SAND'}
            ],
            {
                color: [78 / 255, 27 / 255, 21 / 255, 0.1],
                addColor: [78 / 255, 27 / 255, 21 / 255, 0.1],
                density: 0.05,
                illuminate: 0.15,
            }
        );
        this.addBiome(
            502,
            'Пещеры нижнего мира',
            .912,
            .912,
            [
                new BiomeDirtLayer([BLOCK.NETHERRACK.id])
            ],
            {
                frequency: .4,
                list: [
                    {percent: .2, trunk: BLOCK.ANCIENT_DEBRIS.id, leaves: BLOCK.WARPED_FENCE.id, basis: BLOCK.NETHERRACK.id, style: 'peak', height: {min: CACTUS_MIN_HEIGHT * 2, max: CACTUS_MAX_HEIGHT * 3}},
                    // {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    // {...TREES.SPRUCE, percent: 0.05, height: {min: 6, max: 24}},
                    {percent: .3, trunk: BLOCK.GLOWSTONE.id, leaves: null, style: 'tundra_stone', height: {min: 1, max: 2}},
                    // {percent: .333, trunk: BLOCK.MAGMA_BLOCK.id, leaves: null, style: 'tundra_stone', height: {min: 1, max: 2}},
                    {...TREES.RED_MUSHROOM, percent: .2, height: {min: 8, max: 12}, basis: null},
                    {...TREES.OAK, percent: .1, trunk: BLOCK.CRIMSON_STEM.id, leaves: BLOCK.SHROOMLIGHT.id, basis: null},
                    {percent: .2, trunk: BLOCK.SHROOMLIGHT.id, leaves: null, style: 'tundra_stone', height: {min: 1, max: 2}},
                    // {...TREES.SPRUCE, percent: 0.681 + 0.150, height: {min: 6, max: 11}}
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .1, blocks: [{name: 'PEBBLES'}]},
                    // {percent: .1, blocks: [{name: 'FIRE', extra_data: {up: true, age: .5}}]}
                ]
            },
            {
                frequency: .1,
                list: [
                    {percent: .1, blocks: [{name: 'GRASS'}]},
                ]
            },
            new IndexedColor(0, 511, 0),
            new IndexedColor(12, 268, 0),
            NETHER_BUILDINGS,
            undefined,
            [
                {value: 1, block_name: 'DEEPSLATE'}
            ],
            {
                hanging_foliage:    'ANCIENT_DEBRIS',
                basement:           'NETHERRACK',
                dirt_path:          'NETHER_BRICKS',
                caves_second:       'NETHER_BRICKS',
            },
            {x: 0, y : 384, w: 128, h : 128, noise_range: 10} as DirtPalette,
            [
                {value: 0, block_name: 'SMOOTH_BASALT'},
                {value: .5, block_name: 'NETHER_BRICKS'},
                {value: 1, block_name: 'SOUL_SAND'}
            ],
            {
                color: [78 / 255, 27 / 255, 21 / 255, 0.1],
                addColor: [78 / 255, 27 / 255, 21 / 255, 0.1],
                density: 0.05,
                fixLum: 1,
                illuminate: 0.15,
            }
        );

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