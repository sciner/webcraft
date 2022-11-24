import { IndexedColor } from '../../helpers.js';
import { TREES } from '../biomes.js';

const CACTUS_MIN_HEIGHT     = 2;
const CACTUS_MAX_HEIGHT     = 5;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015 * 32;
const PLANTS_FREQUENCY      = 0.015;
const GRASS_FREQUENCY       = 0.015;

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS; // new IndexedColor(82, 450, 0);
const DEFAULT_WATER_COLOR = IndexedColor.WATER;

export class Biomes {

    constructor(noise2d) {
        this.noise2d = noise2d;
        this.scale = 512;
        TREES.init();
        this.initBiomes();
        this.calcPalette();
        //
        this.octaves = 5;
        this.max_pow = Math.pow(2, this.octaves);
        this.pows = [];
        for(let i = 0; i < this.octaves; i++) {
            const value = Math.pow(2, this.octaves - i);
            this.pows.push(value);
        }
    }

    calcNoise(px, pz, t) {
        const s = 1 * 40;
        let resp = 0;
        for(let i = 0; i < this.octaves; i++) {
            const d = this.pows[i];
            const shift = i * 1000 * t;
            const h = this.noise2d((px + shift) / (d * s), (pz + shift) / (d * s));
            resp += h * (d / this.max_pow);
        }
        return (resp / 2 + .5) / 1.2;
    }

    addBiome(title, temp, humidity, dirt_layers, trees, plants, grass, dirt_color, water_color) {
        const id = this.list.length + 1;
        if(!dirt_layers) {
            dirt_layers = [
                {blocks: [BLOCK.GRASS_BLOCK.id, BLOCK.DIRT.id, BLOCK.STONE.id]},
                {blocks: [BLOCK.STONE.id]},
                {blocks: [BLOCK.MOSS_BLOCK.id, BLOCK.STONE.id]
            }];
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
                    {percent: .15, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]}
                ]
            };
        }
        dirt_color = dirt_color ?? DEFAULT_DIRT_COLOR;
        water_color = water_color ?? DEFAULT_WATER_COLOR;
        const no_smooth_heightmap = true;
        this.list.push({id, title, temp, humidity, dirt_layers, trees, plants, grass, dirt_color, water_color, no_smooth_heightmap});
    }

    initBiomes() {

        this.list = [];
    
        // Снежные биомы
        const snow_dirt_layers = [{blocks: [BLOCK.SNOW_DIRT.id, BLOCK.DIRT.id, BLOCK.STONE.id]}, {blocks: [BLOCK.STONE.id], cap_block_id: BLOCK.SNOW.id}];
        const snow_grass = {
            frequency: GRASS_FREQUENCY / 2,
            list: [
                {percent: .8, blocks: [{id: BLOCK.DEAD_BUSH.id}]},
                {percent: .2, blocks: [{id: BLOCK.GRASS.id}]}
            ]
        };
        this.addBiome('Заснеженные горы', -1, 0.5,               snow_dirt_layers, null, null, snow_grass);
        this.addBiome('Ледяные пики', -0.8, 0.5,                 [{blocks: [BLOCK.ICE.id]}]);
        this.addBiome('Заснеженная тундра', 0, 0.5,              snow_dirt_layers, null, null, snow_grass)
        this.addBiome('Заснеженная тайга', -0.8, 0.4,            snow_dirt_layers, {
            frequency: TREE_FREQUENCY * 2,
            list: [
                // {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                {percent: 0.01, trunk: BLOCK.OAK_LOG.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {percent: 0.05, ...TREES.SPRUCE, height: {min: 6, max: 24}},
                {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
                {percent: 0.681 + 0.150, ...TREES.SPRUCE, height: {min: 6, max: 11}}
            ]
        }, {
            frequency: GRASS_FREQUENCY,
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
                {percent: .007, blocks: [{id: BLOCK.DEAD_BUSH.id}]},
                {percent: .011, blocks: [{id: BLOCK.LARGE_FERN.id}, {id: BLOCK.LARGE_FERN.id, extra_data: {is_head: true}}]},
            ]
        }, new IndexedColor(232, 510, 0), new IndexedColor(255, 255, 0));
        this.addBiome('Заснеженная холмистая тайга', -0.5, 0.4,  snow_dirt_layers, null, null, snow_grass, new IndexedColor(232, 510, 0), new IndexedColor(255, 255, 0));
        this.addBiome('Заснеженная гористая тайга', -0.8, 0.4,   snow_dirt_layers, null, null, snow_grass, new IndexedColor(232, 510, 0), new IndexedColor(255, 255, 0));
        this.addBiome('Заснеженный пляж', -0.05, 0.3,            [{blocks: [BLOCK.SANDSTONE.id], cap_block_id: BLOCK.SNOW.id}, {blocks: [BLOCK.STONE.id], cap_block_id: BLOCK.SNOW.id}], null, null, snow_grass); // SNOWY_BEACH
        // this.addBiome('Замерзшая река', 0. -0.2);
        // this.addBiome('Замерзший океан', 0. -0.1);
        // this.addBiome('Глубокий замерзший океан', 0.8, -0.1);
    
        // Умеренные биомы
        this.addBiome('Равнины', 0.8, 0.4, undefined, {
            frequency: TREE_FREQUENCY / 12,
            list: [
                {percent: 1, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
            ]
        });
        this.addBiome('Подсолнечниковые равнины', 0.8, 0.4);
        this.addBiome('Лес', 0.7, 0.8);
        this.addBiome('Холмистый лес', 0.7, 0.8);
        this.addBiome('Цветочный лес', 0.7, 0.8);
        this.addBiome('Березняк', 0.6, 0.6, null, {
            frequency: TREE_FREQUENCY * 1.2,
            list: [
                {percent: 0.01, trunk: TREES.BIRCH.trunk, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
                {percent: 0.99, ...TREES.BIRCH, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
            ]
        });
        this.addBiome('Холмистый березняк', 0.6, 0.6);
        this.addBiome('Крупномерный березняк', 0.6, 0.6);
        this.addBiome('Крупномерный холмистый березняк', 0.6, 0.6);
        this.addBiome('Темный лес', 0.7, 0.8);
        this.addBiome('Холмистый темный лес', 0.7, 0.8);
        this.addBiome('Болото', 0.8, 0.9);
        this.addBiome('Холмистое болото', 0.8, 0.9);
        this.addBiome('Пляж', 0.8, 0.4,                          [{blocks: [BLOCK.SANDSTONE.id, BLOCK.SAND.id]}, {blocks: [BLOCK.STONE.id]}]);
        // this.addBiome('Река', 0.5, 0.5);
        // this.addBiome('Океан', 0.5, 0.5);
        // this.addBiome('Глубокий океан', 0.5, 0.5);
        // this.addBiome('Умеренный океан', 0.8, 0.5);
        // this.addBiome('Глубокий умеренный океан.', 0.8, 0.5);
    
        // Теплые биомы
        this.addBiome('Джунгли', 0.95, 0.9, undefined, {
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
            frequency: GRASS_FREQUENCY * 5.8,
            list: [
                {percent: .600, blocks: [{id: BLOCK.OAK_LEAVES.id}]},
                {percent: .327, blocks: [{id: BLOCK.GRASS.id}]},
                {percent: .053, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
                {percent: .010, blocks: [{id: BLOCK.RED_TULIP.id}]},
                {percent: .005, blocks: [{id: BLOCK.MELON.id, not_transparent: true}]},
                {percent: .005, blocks: [{id: BLOCK.DANDELION.id}]}
            ]
        }, new IndexedColor(32, 345, 0), new IndexedColor(12, 36, 0));
        this.addBiome('Рельефные джунгли', 0.95, 0.9);
        this.addBiome('Холмистые джунгли', 0.95, 0.9);
        this.addBiome('Окраина джунглей', 0.95, 0.8, undefined, {
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
            frequency: GRASS_FREQUENCY * 105.8,
            list: [
                {percent: .2, blocks: [{id: BLOCK.OAK_LEAVES.id}]},
                {percent: .3, blocks: [{id: BLOCK.GRASS.id}]},
                {percent: .5, blocks: [{id: BLOCK.TALL_GRASS.id}, {id: BLOCK.TALL_GRASS.id, extra_data: {is_head: true}}]},
            ]
        }, new IndexedColor(32, 345, 0), new IndexedColor(12, 36, 0));
        this.addBiome('Рельефная окраина джунглей', 0.95, 0.8);
        this.addBiome('Бамбуковые джунгли', 0.95, 0.9);
        this.addBiome('Холмистые бамбуковые джунгли', 0.95, 0.9);
        this.addBiome('Грибные поля', 0.9, 1);
        this.addBiome('Грибной берег', 0.9, 1);
        this.addBiome('Пустыня', 2, 0,
            [
                {blocks: [BLOCK.SAND.id, BLOCK.SANDSTONE.id]},
                {blocks: [BLOCK.STONE.id]}
            ],
            {
                frequency: TREE_FREQUENCY / 5,
                list: [
                    {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: 1, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
                ]
            },
            null
        );
        this.addBiome('Холмистая пустыня', 2, 0,
            [
                {blocks: [BLOCK.SAND.id, BLOCK.SANDSTONE.id]}
            ],
            {
                frequency: TREE_FREQUENCY / 2,
                list: [
                    {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
                ]
            },
            {
                frequency: PLANTS_FREQUENCY / 1,
                list: [
                    {percent: 1, blocks: [{id: BLOCK.DEAD_BUSH.id}]}
                ]
            },
            null
        );
        this.addBiome('Пустынные озера', 2, 0);
        this.addBiome('Саванна', 1.2, 0, undefined, {
            frequency: TREE_FREQUENCY,
            list: [
                {percent: 1, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
            ]
        }, undefined, undefined, new IndexedColor(77, 510, 0), new IndexedColor(0, 255, 0));
        this.addBiome('Плато саванны', 1, 0, undefined, {
            frequency: TREE_FREQUENCY,
            list: [
                {percent: .2, ...TREES.ACACIA, height: {min: 2, max: 2}},
                {percent: .7, ...TREES.ACACIA, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT * 1.5}},
                {percent: .05, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}},
                {percent: .05, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}}
            ]
        }, undefined, undefined, new IndexedColor(77, 510, 0), new IndexedColor(0, 255, 0));
        this.addBiome('Выветренная саванна', 1.1, 0, undefined, undefined, undefined, undefined, new IndexedColor(77, 510, 0), new IndexedColor(0, 255, 0));
        this.addBiome('Плато выветренной саванны', 1, 0);
        this.addBiome('Пустошь', 2, 0);
        this.addBiome('Выветренная пустошь', 2, 0);
        this.addBiome('Плато пустоши', 2, 0);
        this.addBiome('Рельефное плато пустоши', 2, 0);
        this.addBiome('Лесистое плато пустоши', 2, 0);
        this.addBiome('Рельефное лесистое плато пустоши', 2, 0);
        // this.addBiome('Теплый океан', 0.8, 0.5);
    
        /*
        this.addBiome('Пустоши нижнего мира', 2, 0);
        this.addBiome('Базальтовые дельты', 2, 0);
        this.addBiome('Искаженный лес', 2, 0);
        this.addBiome('Багровый лес', 2, 0);
        this.addBiome('Долина песка душ', 2, 0);
        */

    }

    calcPalette() {

        this.biomes_palette = new Array(this.scale * this.scale);

        let m = new Map();
        for(let x = 0; x < this.scale; x++) {
            for(let z = 0; z < this.scale; z++) {
                const temp = x / this.scale
                const temp_value = temp * 3 - 1;
                const humidity = z / this.scale;
                const humidity_value = humidity * 2 - 1;
                let min_dist = Infinity;
                let biome = null;
                for(let bi in this.list) {
                    const b = this.list[bi];
                    const dist = (temp_value - b.temp) * (temp_value - b.temp) + (humidity_value - b.humidity) * (humidity_value - b.humidity);
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
     * @param {float} temperature 
     * @param {float} humidity 
     * @returns 
     */
    getBiome(temperature, humidity) {

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

        let x = Math.floor(this.scale * temperature);
        let z = Math.floor(this.scale * humidity);
        x = Math.max(Math.min(x, this.scale - 1), 0)
        z = Math.max(Math.min(z, this.scale - 1), 0)

        const resp = this.biomes_palette[z * this.scale + x]
        if(!resp) debugger
        return resp;
    }

}