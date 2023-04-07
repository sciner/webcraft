import { Color, IndexedColor } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { DEFAULT_DIRT_PALETTE, GRASS_PALETTE_OFFSET } from '../constant.js';

const CACTUS_MIN_HEIGHT     = 2;
const CACTUS_MAX_HEIGHT     = 5;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015;

const biome_stat = {
    height:     {min: 999999999, max: -99999},
    humidity:   {min: 999999999, max: -99999},
    equator:    {min: 999999999, max: -99999},
};

export class BiomeTree {
    
    trunk: int
    leaves: int | null
    basis: int | null // block under tree e.g. DIRT or SAND
    style: string
    height: {min: int, max: int}
    percent?: float
    has_cavity: boolean

    constructor(trunk: string, leaves: string | null, style: string, height: {min: int, max: int}, percent : float = 1, has_cavity : boolean = false, basis_block_id? : int) {
        this.trunk = BLOCK.fromName(trunk).id
        this.leaves = leaves ? BLOCK.fromName(leaves).id : null
        this.basis = basis_block_id
        this.style = style
        this.height = height
        this.percent = percent
        this.has_cavity = has_cavity
    }

}

// 1. Trees
export class TREES {

    static BIRCH: BiomeTree;
    static OAK: BiomeTree
    static ACACIA: BiomeTree
    static SPRUCE: BiomeTree
    static JUNGLE: BiomeTree
    static RED_MUSHROOM: BiomeTree
    static BROWN_MUSHROOM: BiomeTree
    static BIG_OAK: BiomeTree
    static CORAL_TREE: BiomeTree
    static CORAL_PAW: BiomeTree
    static CORAL_MUSHROOM: BiomeTree

    static init() {
        if(TREES.BIRCH) {
            return false;
        }
        TREES.BIRCH             = new BiomeTree('BIRCH_LOG', 'BIRCH_LEAVES', 'birch', {min: 4, max: 8}, undefined, true, undefined)
        TREES.OAK               = new BiomeTree('OAK_LOG', 'OAK_LEAVES', 'oak', {min: 4, max: 8}, undefined, true)
        TREES.ACACIA            = new BiomeTree('ACACIA_LOG', 'ACACIA_LEAVES', 'acacia', {min: 5, max: 12}, undefined, true)
        TREES.SPRUCE            = new BiomeTree('SPRUCE_LOG', 'SPRUCE_LEAVES', 'spruce', {min: 6, max: 22}, undefined, true)
        TREES.JUNGLE            = new BiomeTree('JUNGLE_LOG', 'JUNGLE_LEAVES', 'jungle', {min: 1, max: 22}, undefined, true)
        TREES.RED_MUSHROOM      = new BiomeTree('MUSHROOM_STEM', 'RED_MUSHROOM_BLOCK', 'red_mushroom', {min: 5, max: 12})
        TREES.BROWN_MUSHROOM    = new BiomeTree('MUSHROOM_STEM', 'BROWN_MUSHROOM_BLOCK', 'brown_mushroom', {min: 5, max: 12})
        TREES.BIG_OAK           = new BiomeTree('OAK_LOG', 'OAK_LEAVES', 'big_oak', {min: 20, max: 35}),
        TREES.CORAL_TREE        = new BiomeTree('HORN_CORAL_BLOCK', 'OAK_LEAVES', 'coral_tree', {min: 0, max: 5}),
        TREES.CORAL_PAW         = new BiomeTree('BRAIN_CORAL_BLOCK', 'OAK_LEAVES', 'coral_paw', {min: 0, max: 5})
        TREES.CORAL_MUSHROOM    = new BiomeTree('FIRE_CORAL_BLOCK', 'OAK_LEAVES', 'coral_mushroom', {min: 0, max: 5})
        return true;
    }

}

// 2. Biomes
export class  BIOMES {

    static OCEAN: any
    static RIVER: any
    static BEACH: any
    static TEMPERATE_DESERT: any
    static JUNGLE: any
    static SUBTROPICAL_DESERT: any
    static SCORCHED: any
    static BARE: any
    static TUNDRA: any
    static TAIGA: any
    static SNOW: any
    static SHRUBLAND: any
    static GRASSLAND: any
    static TEMPERATE_DECIDUOUS_FOREST: any
    static TEMPERATE_RAIN_FOREST: any
    static TROPICAL_SEASONAL_FOREST: any
    static TROPICAL_RAIN_FOREST: any

    static init() {

        if(BIOMES.OCEAN) {
            return false;
        }

        TREES.init();

        BIOMES.OCEAN = {
            block:      BLOCK.STILL_WATER.id,
            code:       'OCEAN',
            color:      '#017bbb',
            dirt_color: new IndexedColor(33, 292, 0),
            water_color: new IndexedColor(129, 194, 0),
            title:      'ОКЕАН',
            max_height: 64,
            dirt_block: [BLOCK.SAND.id, BLOCK.GRAVEL.id, BLOCK.DIRT.id, BLOCK.CLAY.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: .5,
                list: [
                    {percent: .8, blocks: [{id: BLOCK.SEAGRASS.id}]},
                    {percent: .2, blocks: [{id: BLOCK.SEAGRASS.id}, {id: BLOCK.SEAGRASS.id}]}
                ]
            }
        };

        BIOMES.RIVER = {
            block:      BLOCK.STILL_WATER.id,
            code:       'OCEAN',
            color:      '#017bbb',
            dirt_color: new IndexedColor(33, 292, 0),
            water_color: new IndexedColor(129, 194, 0),
            title:      'ОКЕАН',
            max_height: 64,
            dirt_block: [BLOCK.SAND.id, BLOCK.GRAVEL.id, BLOCK.CLAY.id, BLOCK.DIRT.id],
            no_smooth_heightmap: false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: 0,
                list: []
            }
        };

        BIOMES.BEACH = {
            block: BLOCK.SAND.id,
            code:       'BEACH',
            color:      '#ffdc7f',
            dirt_color: new IndexedColor(1, 383, 0),
            water_color: new IndexedColor(12, 36, 0),
            title:      'ПЛЯЖ',
            max_height: 64,
            dirt_block: [BLOCK.SAND.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: .005,
                list: [
                    {percent: 1, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
                ]
            }
        };

        BIOMES.TEMPERATE_DESERT = {
            block:      BLOCK.GRAVEL.id,
            code:       'TEMPERATE_DESERT',
            color:      '#f4a460',
            dirt_color: new IndexedColor(36, 378, 0),
            water_color: new IndexedColor(0, 255, 0),
            title:      'УМЕРЕННАЯ ПУСТЫНЯ',
            dirt_block: [BLOCK.SAND.id],
            max_height: 6,
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY / 2,
                list: [
                    {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, basis: BLOCK.SAND.id, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: TREE_FREQUENCY / 1,
                list: [
                    {percent: 1, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
                ]
            }
        };

        BIOMES.JUNGLE = {
            block:      BLOCK.OAK_PLANKS.id,
            code:       'JUNGLE',
            color:      '#4eb41c',
            dirt_color: new IndexedColor(16, 300.5, 0),
            water_color: new IndexedColor(12, 36, 0),
            title:      'ДЖУНГЛИ',
            max_height: 48,
            dirt_block: [BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK.id, BLOCK.COARSE_DIRT.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY * 4,
                list: [
                    {percent: .025, ...TREES.JUNGLE, height: {min: 16, max: 22}},
                    {percent: .1, ...TREES.JUNGLE, height: {min: 9, max: 14}},
                    {percent: .4, ...TREES.JUNGLE, height: {min: 3, max: 8}},
                    {percent: .2, ...TREES.JUNGLE, height: {min: 1, max: 1}},
                    // bamboo
                    {percent: .1, trunk: BLOCK.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
                ]
            },
            plants: {
                frequency: .8,
                list: [
                    {percent: .600, blocks: [{id: BLOCK.OAK_LEAVES.id}]},
                    {percent: .327, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .053, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .010, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .005, blocks: [{id: BLOCK.MELON.id, not_transparent: true}]},
                    {percent: .005, blocks: [{id: BLOCK.DANDELION.id}]}
                ]
            }
        };

        BIOMES.SUBTROPICAL_DESERT = {
            block:      BLOCK.OAK_PLANKS.id,
            code:       'SUBTROPICAL_DESERT',
            color:      '#c19a6b',
            dirt_color: new IndexedColor(38.5, 383, 0),
            water_color: new IndexedColor(0, 255, 0),
            title:      'СУБТРОПИЧЕСКАЯ ПУСТЫНЯ',
            max_height: 6,
            dirt_block: [BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK.id, BLOCK.COARSE_DIRT.id, BLOCK.PODZOL.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: .9, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.25}},
                    {percent: .1, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}}
                ]
            },
            plants: {
                frequency: .5,
                list: [
                    {percent: .84, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .14, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .01, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .01, blocks: [{id: BLOCK.DANDELION.id}]}
                ]
            }
        };

        BIOMES.SCORCHED = {
            block:      BLOCK.STONE.id,
            code:       'SCORCHED',
            color:      '#ff5500',
            dirt_color: new IndexedColor(1, 383, 0),
            water_color: new IndexedColor(12, 36, 0),
            title:      'ОБОГРЕВАЮЩИЙ',
            max_height: 12,
            dirt_block: [BLOCK.SAND.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY / 4,
                list: [
                    {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, basis: BLOCK.SAND.id, style: 'cactus', height: {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: TREE_FREQUENCY / 1,
                list: [
                    {percent: 1, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
                ]
            }
        };

        BIOMES.BARE = {
            block:      BLOCK.OAK_LOG.id,
            code:       'BARE',
            color:      '#CCCCCC',
            dirt_color: new IndexedColor(96, 363, 0),
            water_color: new IndexedColor(0, 255, 0),
            title:      'ПУСТОШЬ',
            max_height: 64,
            dirt_block: [BLOCK.STONE.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: 0,
                list: []
            },
            plants:     {frequency: 0}
        };

        BIOMES.TUNDRA = {
            block: BLOCK.SPRUCE_LOG.id,
            code:       'TUNDRA',
            color:      '#74883c',
            dirt_color: new IndexedColor(106, 378, 0),
            water_color: new IndexedColor(255, 255, 0),
            title:      'ТУНДРА',
            max_height: 48,
            dirt_block: [BLOCK.GRASS_BLOCK.id, BLOCK.PODZOL.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY * 1.5,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.01, ...TREES.SPRUCE, height: {min: 6, max: 24}},
                    {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                    {percent: 0.681, ...TREES.SPRUCE, height: {min: 6, max: 11}}
                ]
            },
            plants: {
                frequency: .65,
                list: [
                    {percent: .578, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .095, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .300, blocks: [{id: BLOCK.FERN.id}]},
                    {percent: .001, blocks: [{id: BLOCK.BROWN_MUSHROOM.id}]},
                    {percent: .008, blocks: [{id: BLOCK.SWEET_BERRY_BUSH.id, extra_data: {'stage': 3, 'complete': true}}]},
                    {percent: .007, blocks: [{id: BLOCK.DEAD_BUSH.id}]},
                    {percent: .011, blocks: [{id: BLOCK.LARGE_FERN.id}, {id: BLOCK.LARGE_FERN.id, extra_data: {is_head: true}}]},
                ]
            }
        };

        BIOMES.TAIGA = {
            block: BLOCK.OAK_LOG.id,
            code:       'TAIGA',
            dirt_color: new IndexedColor(116, 383, 0),
            water_color: new IndexedColor(255, 255, 0),
            color:      '#879b89',
            title:      'ТАЙГА',
            max_height: 12,
            dirt_block: [BLOCK.GRASS_BLOCK.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.SPRUCE, height: {min: 7, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: 0,
                list: []
            }
        };

        BIOMES.SNOW = {
            block:      BLOCK.POWDER_SNOW.id,
            code:       'SNOW',
            color:      '#f5f5ff',
            dirt_color: new IndexedColor(126, 383, 0),
            water_color: new IndexedColor(255, 255, 0),
            title:      'СНЕГ',
            max_height: 35,
            dirt_block: [BLOCK.SNOW_DIRT.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.SPRUCE, height: {min: 7, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: 0,
                list: []
            }
        };

        BIOMES.SHRUBLAND = {
            block: BLOCK.DIAMOND_ORE.id,
            code:       'SHRUBLAND',
            color:      '#316033',
            dirt_color: new IndexedColor(56, 323, 0),
            water_color: new IndexedColor(60, 220, 0),
            title:      'КУСТАРНИКИ',
            dirt_block: [BLOCK.GRASS_BLOCK.id],
            no_smooth_heightmap:  false,
            max_height: 8,
            trees:      {
                frequency: 0,
                list: []
            },
            plants: {
                frequency: .3,
                list: [
                    {percent: .858, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .142, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                ]
            }
        };

        BIOMES.GRASSLAND = {
            block:      BLOCK.GRASS_BLOCK.id,
            code:       'GRASSLAND',
            color:      '#98a136',
            dirt_color: IndexedColor.GRASS,
            water_color: new IndexedColor(129, 194, 0),
            title:      'ТРАВЯНАЯ ЗЕМЛЯ',
            max_height: 18,
            dirt_block: [BLOCK.GRASS_BLOCK.id],
            no_smooth_heightmap:  false,
            plants: {
                frequency: .5,
                list: [
                    {percent: .670, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .115, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .025, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .025, blocks: [{id: BLOCK.ALLIUM.id}]},
                    {percent: .025, blocks: [{id: BLOCK.BLUE_ORCHID.id}]},
                    {percent: .025, blocks: [{id: BLOCK.OXEYE_DAISY.id}]},
                    {percent: .025, blocks: [{id: BLOCK.LILY_OF_THE_VALLEY.id}]},
                    {percent: .025, blocks: [{id: BLOCK.CORNFLOWER.id}]},
                    {percent: .025, blocks: [{id: BLOCK.DANDELION.id}]},
                    {percent: .015, blocks: [{id: BLOCK.PUMPKIN.id, not_transparent: true}]},
                    {percent: .011, blocks: [{id: BLOCK.PEONY.id}, {id: BLOCK.PEONY.id, extra_data: {is_head: true}}]},
                    {percent: .014, blocks: [{id: BLOCK.LILAC.id}, {id: BLOCK.LILAC.id, extra_data: {is_head: true}}]}
                ]
            },
            trees:      {
                frequency: TREE_FREQUENCY / 10,
                list: [
                    {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            }
        };

        BIOMES.TEMPERATE_DECIDUOUS_FOREST = {
            block:      BLOCK.GLASS.id,
            code:       'TEMPERATE_DECIDUOUS_FOREST',
            color:      '#228b22',
            dirt_color: new IndexedColor(16, 328, 0),
            water_color: new IndexedColor(129, 194, 0),
            title:      'УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС',
            max_height: 48,
            dirt_block: [BLOCK.GRASS_BLOCK.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.BIRCH, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: .3,
                list: [
                    {percent: .835, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .140, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .025, blocks: [{id: BLOCK.RED_MUSHROOM.id}]}
                ]
            }
        };

        BIOMES.TEMPERATE_RAIN_FOREST = {
            block: BLOCK.COBBLESTONE.id,
            code:       'TEMPERATE_RAIN_FOREST',
            color:      '#00755e',
            dirt_color: new IndexedColor(66, 328, 0),
            water_color: new IndexedColor(129, 194, 0),
            title:      'УМЕРЕННЫЙ ДОЖДЬ ЛЕС',
            max_height: 15,
            dirt_block: [BLOCK.GRASS_BLOCK.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY * 1.5,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: 0,
                list: []
            }
        };

        BIOMES.TROPICAL_SEASONAL_FOREST = {
            block:      BLOCK.BRICKS.id,
            code:       'TROPICAL_SEASONAL_FOREST',
            color:      '#008456',
            dirt_color: new IndexedColor(66, 338, 0),
            water_color: new IndexedColor(37, 121, 0),
            title:      'ТРОПИЧЕСКИЙ СЕЗОННЫЙ ЛЕС',
            max_height: 32,
            dirt_block: [BLOCK.GRASS_BLOCK.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: TREE_FREQUENCY / 2,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
                ]
            },
            plants: {
                frequency: .35,
                list: [
                    {percent: .855, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .145, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                ]
            }
        };

        BIOMES.TROPICAL_RAIN_FOREST = {
            block:      BLOCK.GLOWSTONE.id,
            code:       'TROPICAL_RAIN_FOREST',
            color:      '#16994f',
            dirt_color: new IndexedColor(46, 343, 0),
            water_color: new IndexedColor(22, 58, 0),
            title:      'ГРИБНОЙ',
            max_height: 64,
            dirt_block: [BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK.id, BLOCK.MYCELIUM.id, BLOCK.MOSS_BLOCK.id],
            no_smooth_heightmap:  false,
            trees:      {
                frequency: .0085,
                list: [
                    {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: 0.69, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}},
                    {percent: 0.15, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}}
                ]
            },
            plants: {
                frequency: .75,
                list: [
                    {percent: .1, blocks: [{id: BLOCK.RED_MUSHROOM.id}]},
                    {percent: .1, blocks: [{id: BLOCK.BROWN_MUSHROOM.id}]},
                    {percent: .685, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .115, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                ]
            }
        };

        for(let k in BIOMES) {
            const biome = BIOMES[k];
            biome.code = k;
            biome.color_rgba = Color.hexToColor(biome.color);
            if(!Array.isArray(biome.trees.list)) {
                console.error(`biome '${k}' has undefined trees.list`);
            }
            for(let tree of biome.trees.list) {
                const trunk_block = BLOCK.fromId(tree.trunk);
                if(!trunk_block) throw 'invalid_trunk_block';
                tree.transparent_trunk = trunk_block.transparent;
            }
            biome.dirt_palette = DEFAULT_DIRT_PALETTE
            biome.grass_palette = {
                x:              biome.dirt_palette.x + GRASS_PALETTE_OFFSET.x,
                y:              biome.dirt_palette.y + GRASS_PALETTE_OFFSET.y,
                w:              biome.dirt_palette.w,
                h:              biome.dirt_palette.h,
                noise_range:    biome.dirt_palette.noise_range,
            } as DirtPalette
        }

        return true;

    }

    // Функция определения биома в зависимости от возвышенности, влажности и отдаленности от экватора
    static getBiome(v_height, humidity, equator) {

        let height = v_height + 0.;

        if(height < biome_stat.height.min) biome_stat.height.min = height;
        if(height > biome_stat.height.max) biome_stat.height.max = height;

        if(humidity < biome_stat.humidity.min) biome_stat.humidity.min = humidity;
        if(humidity > biome_stat.humidity.max) biome_stat.humidity.max = humidity;

        if(equator < biome_stat.equator.min) biome_stat.equator.min = equator;
        if(equator > biome_stat.equator.max) biome_stat.equator.max = equator;

        function _(humidity, height, equator) {

            if (height < 0.248) return 'OCEAN';
            if (height < 0.253) return 'BEACH';

            if (height > 0.5 || equator < .6) {
                if (humidity < 0.1) return 'SCORCHED';
                if (humidity < 0.2) return 'BARE';
                if (humidity < 0.4) return 'TUNDRA';
                return 'SNOW';
            }
            if (height > 0.6) {
                if (humidity < 0.33) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
                if (humidity < 0.66) return 'SHRUBLAND'; // кустарник
                return 'TAIGA';
            }
            if (height > 0.3) {
                if (humidity < 0.16) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
                if (humidity < 0.50) return 'GRASSLAND';
                if (humidity < 0.83) return 'TEMPERATE_DECIDUOUS_FOREST'; // УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС
                return 'TEMPERATE_RAIN_FOREST'; // УМЕРЕННЫЙ ДОЖДЬ ЛЕС
            }
            if (humidity < 0.24) return 'JUNGLE';
            if (humidity < 0.33) return 'GRASSLAND';
            if (humidity < 0.66) return 'TROPICAL_SEASONAL_FOREST';
            return 'TROPICAL_RAIN_FOREST';
        }

        let b = _(humidity, height, equator);
        return BIOMES[b];

    }

}
