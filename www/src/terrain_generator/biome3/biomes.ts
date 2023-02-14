import { BLOCK } from '../../blocks.js';
import { IndexedColor } from '../../helpers.js';
import { BiomeTree, TREES } from '../biomes.js';
import { ClimateParams } from './terrain/manager_vars.js';

const CACTUS_MIN_HEIGHT     = 2;
const CACTUS_MAX_HEIGHT     = 5;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015 * 32;
const PLANTS_FREQUENCY      = 0.015;
const GRASS_FREQUENCY       = 0.015;

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS; // new IndexedColor(82, 450, 0);
const DEFAULT_WATER_COLOR = IndexedColor.WATER;

const DESERT_BUILDINGS = {others: [
    {class: 'WaterWell',      max_count: 3,        chance: .1},
    {class: 'Farmland',       max_count: Infinity, chance: .2},
    {class: 'BuildingBlocks', max_count: Infinity, chance: 1., block_templates: ['sand_house', 'sand_house_2']},
]}

const TAIGA_BUILDINGS = {others: [
    {class: 'WaterWell',      max_count: 3,        chance: .1},
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

export class Biome {
    [key: string]: any;

    constructor(id, title, temperature, humidity, dirt_layers, trees, plants, grass, dirt_color? : IndexedColor, water_color? : IndexedColor, no_smooth_heightmap : boolean = false, building_options?) {
        this.id = id;
        this.title = title;
        this.temperature = temperature;
        this.temp = temperature;
        this.humidity = humidity;
        this.dirt_layers = dirt_layers;
        this.trees = trees;
        this.plants = plants;
        this.grass = grass;
        this.dirt_color = dirt_color;
        this.water_color = water_color;
        this.no_smooth_heightmap = no_smooth_heightmap;
        this.building_options = building_options
        // 
        this.is_desert = title.toLowerCase().indexOf('пустын') >= 0
        this.is_sand = this.is_desert || title.toLowerCase().indexOf('пляж') >= 0
        this.is_taiga = title.toLowerCase().indexOf('тайга') >= 0
        this.is_snowy = false
        for(let dl of dirt_layers) {
            for(let block_id of dl.blocks) {
                if(block_id == BLOCK.SNOW_DIRT.id) {
                    this.is_snowy = true
                    break
                }
            }
        }
    }

}

export class Biomes {
    [key: string]: any;

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

    calcNoise(px, pz, t, div = 1.2) {
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
        building_options? : any) {
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
                    /*{percent: .125, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                    {percent: .125, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                    {percent: .125, ...TREES.JUNGLE, height: {min: 16, max: 22}},
                    {percent: .125, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                    {percent: .125, ...TREES.SPRUCE, height: {min: 6, max: 24}},
                    {percent: .125, ...TREES.BIRCH, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                    {percent: .125, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}},
                    {percent: .125, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}}
                    */
                ]
            };
        }
        // plants
        if(typeof plants == 'undefined') {
            plants = {
                frequency: .5,
                list: [
                    {percent: .01, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .02, blocks: [{id: BLOCK.DANDELION.id}]}
                ]
            };
        }
        // grass
        if(typeof grass == 'undefined') {
            grass = {
                frequency: .5,
                list: [
                    {percent: .85, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .01, blocks: [{id: BLOCK.PEBBLES.id}]},
                    {percent: .14, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]}
                ]
            };
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
        const biome = new Biome(id, title, temperature, humidity, dirt_layers, trees, plants, grass, dirt_color, water_color, no_smooth_heightmap, building_options);
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
                {percent: .8, blocks: [{id: BLOCK.DEAD_BUSH.id}]},
                {percent: .2, blocks: [{id: BLOCK.GRASS.id}]}
            ]
        };
        this.addBiome(13, 'Заснеженные горы', -1, 0.5,               snow_dirt_layers, null, null, snow_grass);
        this.addBiome(140, 'Ледяные пики', -0.8, 0.5,                [new BiomeDirtLayer([BLOCK.ICE.id])]);
        this.addBiome(12, 'Заснеженная тундра', 0, 0.5,              snow_dirt_layers, null, null, snow_grass)
        this.addBiome(30, 'Заснеженная тайга', -0.8, 0.4,            snow_dirt_layers, {
            frequency: TREE_FREQUENCY * 2,
            list: [
                // {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {percent: 0.05, ...TREES.SPRUCE, height: {min: 6, max: 24}},
                {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                {percent: 0.681 + 0.150, ...TREES.SPRUCE, height: {min: 6, max: 11}}
            ]
        }, {
            frequency: PLANTS_FREQUENCY,
            list: [
                {percent: .5, blocks: [{id: BLOCK.BROWN_MUSHROOM.id}]},
                {percent: .5, blocks: [{id: BLOCK.SWEET_BERRY_BUSH.id, extra_data: {'stage': 3, 'complete': true}}]},
            ]
        }, {
            frequency: GRASS_FREQUENCY * 10,
            list: [
                {percent: .578, blocks: [{id: BLOCK.GRASS.id}]},
                {percent: .095, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                {percent: .300, blocks: [{id: BLOCK.FERN.id}]},
                {percent: .0025, blocks: [{id: BLOCK.DEAD_BUSH.id}]},
                {percent: .0025, blocks: [{id: BLOCK.PEBBLES.id}]},
                {percent: .011, blocks: [{id: BLOCK.LARGE_FERN.id}, {id: BLOCK.LARGE_FERN.id, extra_data: {is_head: true}}]},
            ]
        }, new IndexedColor(200, 510, 0), new IndexedColor(255, 255, 0), TAIGA_BUILDINGS);
        this.addBiome(31, 'Заснеженная холмистая тайга', -0.5, 0.4,  snow_dirt_layers, {
            frequency: TREE_FREQUENCY / 4,
            list: [
                // {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {percent: 0.05, ...TREES.SPRUCE, height: {min: 6, max: 24}},
                {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                {percent: 0.681 + 0.150, ...TREES.SPRUCE, height: {min: 6, max: 11}}
            ]
        }, null, snow_grass, new IndexedColor(232, 510, 0), new IndexedColor(236, 249, 0), TAIGA_BUILDINGS);
        this.addBiome(158, 'Заснеженная гористая тайга', -0.8, 0.4,   snow_dirt_layers, null, null, snow_grass, new IndexedColor(232, 510, 0), new IndexedColor(236, 249, 0), TAIGA_BUILDINGS);
        this.addBiome(26, 'Заснеженный пляж', -0.05, 0.3,            [new BiomeDirtLayer([BLOCK.SANDSTONE.id, BLOCK.STONE.id], BLOCK.SNOW.id), new BiomeDirtLayer([BLOCK.STONE.id], BLOCK.SNOW.id)], null, null, snow_grass, undefined, new IndexedColor(170, 225, 0)); // SNOWY_BEACH
        // this.addBiome('Замерзшая река', 0. -0.2);
        // this.addBiome('Замерзший океан', 0. -0.1);
        // this.addBiome('Глубокий замерзший океан', 0.8, -0.1);
    
        // Умеренные биомы
        this.addBiome(1, 'Равнины', 0.8, 0.4, undefined, {
            frequency: TREE_FREQUENCY / 12,
            list: [
                {percent: .95, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                {percent: .05, ...TREES.BIG_OAK}
            ]
        }, undefined, undefined, new IndexedColor(75, 435, 0));
        this.addBiome(129, 'Подсолнечниковые равнины', 0.8, 0.4);
        this.addBiome(4, 'Лес', 0.7, 0.8, null, {
            frequency: TREE_FREQUENCY * 3,
            list: [
                {percent: 0.01, trunk: TREES.BIRCH.trunk, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {percent: 0.4, ...TREES.OAK},
                {percent: 0.4, ...TREES.BIRCH},
                {percent: .09, ...TREES.BIG_OAK},
                {percent: .1, ...TREES.BIG_OAK, trunk: TREES.BIRCH.trunk, leaves: TREES.BIRCH.leaves},
            ]
        });
        this.addBiome(18, 'Холмистый лес', 0.7, 0.8);
        this.addBiome(132, 'Цветочный лес', 0.7, 0.8);
        this.addBiome(27, 'Березняк', 0.6, 0.6, null, {
            frequency: TREE_FREQUENCY * 1.2,
            list: [
                {percent: 0.01, trunk: TREES.BIRCH.trunk, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {percent: 0.97, ...TREES.BIRCH, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}},
                {percent: .02, ...TREES.BIG_OAK, trunk: TREES.BIRCH.trunk, leaves: TREES.BIRCH.leaves},
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
                {percent: .05, ...TREES.BIG_OAK}
            ]
        }, {
            frequency: PLANTS_FREQUENCY,
            list: [
                {percent: .5, blocks: [{id: BLOCK.RED_MUSHROOM.id}]},
                {percent: .5, blocks: [{id: BLOCK.BROWN_MUSHROOM.id}]},
            ]
        }, undefined, new IndexedColor(140, 480, 0), new IndexedColor(1, 254, 0));
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
                    {percent: .025, ...TREES.JUNGLE, height: {min: 16, max: 22}},
                    {percent: .1, ...TREES.JUNGLE, height: {min: 9, max: 14}},
                    {percent: .4, ...TREES.JUNGLE, height: {min: 3, max: 8}},
                    {percent: .2 + .175, ...TREES.JUNGLE, height: {min: 1, max: 1}},
                    // bamboo
                    {percent: .1, trunk: BLOCK.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
                ]
            }, {
                frequency: GRASS_FREQUENCY * 5.8,
                list: [
                    {percent: .600, blocks: [{id: BLOCK.OAK_LEAVES.id}]},
                    {percent: .327, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .053, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .010, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .005, blocks: [{id: BLOCK.MELON.id, not_transparent: true}]},
                    {percent: .005, blocks: [{id: BLOCK.DANDELION.id}]}
                ]
            }, {
                frequency: GRASS_FREQUENCY * 100,
                list: [
                    {percent: .500, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .400, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                    {percent: .027, blocks: [{id: BLOCK.OAK_LEAVES.id}]},
                    {percent: .010, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .005, blocks: [{id: BLOCK.MELON.id, not_transparent: true}]},
                    {percent: .005, blocks: [{id: BLOCK.DANDELION.id}]}
                ]
            }, new IndexedColor(32, 345, 0), new IndexedColor(20, 140, 0));
        this.addBiome(149, 'Рельефные джунгли', 0.95, 0.9);
        this.addBiome(22, 'Холмистые джунгли', 0.95, 0.9);
        this.addBiome(23, 'Окраина джунглей', 0.95, 0.8, undefined, {
                frequency: TREE_FREQUENCY * 4,
                list: [
                    {percent: .025, ...TREES.JUNGLE, height: {min: 16, max: 22}},
                    {percent: .1, ...TREES.JUNGLE, height: {min: 9, max: 14}},
                    {percent: .4, ...TREES.JUNGLE, height: {min: 3, max: 8}},
                    {percent: .2, ...TREES.JUNGLE, height: {min: 1, max: 1}},
                    // bamboo
                    {percent: .1, trunk: BLOCK.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
                ]
            }, {
                frequency: PLANTS_FREQUENCY * .8,
                list: [
                    {percent: .1, blocks: [{id: BLOCK.RED_TULIP.id}]},
                    {percent: .4, blocks: [{id: BLOCK.MELON.id, not_transparent: true}]},
                    {percent: .5, blocks: [{id: BLOCK.DANDELION.id}]}
                ]
            }, {
                frequency: GRASS_FREQUENCY * 100,
                list: [
                    {percent: .2, blocks: [{id: BLOCK.OAK_LEAVES.id}]},
                    {percent: .3, blocks: [{id: BLOCK.GRASS.id}]},
                    {percent: .5, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                ]
            }, new IndexedColor(32, 345, 0), new IndexedColor(20, 140, 0));
        this.addBiome(151, 'Рельефная окраина джунглей', 0.95, 0.8);
        this.addBiome(168, 'Бамбуковые джунгли', 0.95, 0.9);
        this.addBiome(169, 'Холмистые бамбуковые джунгли', 0.95, 0.9);
        this.addBiome(14, 'Грибные поля', 0.9, 1, undefined, {
            frequency: TREE_FREQUENCY / 4,
            list: [
                {percent: .5, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}},
                {percent: .5, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}}
            ]
        }, {
            frequency: PLANTS_FREQUENCY * 5,
            list: [
                {percent: .5, blocks: [{id: BLOCK.RED_MUSHROOM.id}]},
                {percent: .5, blocks: [{id: BLOCK.BROWN_MUSHROOM.id, not_transparent: true}]}
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
                    new BiomeTree(BLOCK.CACTUS.id, null, 'cactus', {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}, 1)
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .1, blocks: [{id: BLOCK.PEBBLES.id}]},
                    {percent: .9, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
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
                    new BiomeTree(BLOCK.CACTUS.id, null, 'cactus', {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}, 1)
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: .1, blocks: [{id: BLOCK.PEBBLES.id}]},
                    {percent: .9, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
                ]
            },
            null, undefined, undefined, DESERT_BUILDINGS
        );
        this.addBiome(130, 'Пустынные озера', 2, 0);
        this.addBiome(35, 'Саванна', 1.2, 0, undefined, {
            frequency: TREE_FREQUENCY,
            list: [
                {percent: .9, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                {percent: .1, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: 1}},
            ]
        }, null, undefined, new IndexedColor(0, 510, 0), new IndexedColor(128, 194, 0));
        this.addBiome(36, 'Плато саванны', 1, 0, undefined, {
            frequency: TREE_FREQUENCY,
            list: [
                {percent: .25, ...TREES.ACACIA, height: {min: 2, max: 2}},
                {percent: .75, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
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
        if(!resp) debugger
        return resp;
    }

}