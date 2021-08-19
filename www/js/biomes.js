import {Color} from './helpers.js';

const CACTUS_MAX_HEIGHT     = 7;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015;

let biome_stat = {
    height:     {min: 999999999, max: -99999},
    humidity:   {min: 999999999, max: -99999},
    equator:    {min: 999999999, max: -99999},
};

// 1. All blocks
let all_blocks = [];
for(let b of BLOCK.getAll()) {
    b = {...b},
    delete(b.texture);
    all_blocks.push(b);
}
for(let k in all_blocks) {
    all_blocks[k] = {...all_blocks[k]};
    delete(all_blocks[k].texture);
}

// 2. Plants
let plant_blocks = []
for(let b of BLOCK.getPlants()) {
    b = {...b},
    delete(b.texture);
    plant_blocks.push(b);
}

// 4. Blocks used for generators
export let blocks = {
    DIRT:           BLOCK.DIRT,
    GLOWSTONE:      BLOCK.GLOWSTONE,
    COBBLESTONE:    BLOCK.COBBLESTONE,
    SNOW_DIRT:      BLOCK.SNOW_DIRT,
    AIR:            BLOCK.AIR,
    BRICK:          BLOCK.BRICK,
    DIAMOND_ORE:    BLOCK.DIAMOND_ORE,
    COAL_ORE:       BLOCK.COAL_ORE,
    CONCRETE:       BLOCK.CONCRETE,
    BEDROCK:        BLOCK.BEDROCK,
    GRAVEL:         BLOCK.GRAVEL,
    PLANK:          BLOCK.PLANK,
    GRASS:          BLOCK.GRASS,
    RED_MUSHROOM:   BLOCK.RED_MUSHROOM,
    BROWN_MUSHROOM: BLOCK.BROWN_MUSHROOM,
    GOLD:           BLOCK.GOLD,
    WOOD:           BLOCK.WOOD,
    SPRUCE:         BLOCK.SPRUCE,
    SAND:           BLOCK.SAND,
    GLASS:          BLOCK.GLASS,
    DEAD_BUSH:      BLOCK.DEAD_BUSH,
    WOOD_BIRCH:     BLOCK.WOOD_BIRCH,
    WOOD_LEAVES:    BLOCK.WOOD_LEAVES,
    WOOD_ACACIA:    BLOCK.WOOD_ACACIA,
    SPRUCE_LEAVES:  BLOCK.SPRUCE_LEAVES,
    OAK_LEAVES:     BLOCK.OAK_LEAVES,
    LEAVES2:        BLOCK.LEAVES2,
    LEAVES_ACACIA:  BLOCK.LEAVES_ACACIA,
    STILL_WATER:    BLOCK.STILL_WATER,
    SNOW_BLOCK:     BLOCK.SNOW_BLOCK,
    CACTUS:         BLOCK.CACTUS,
    //
    GRASS_BLOCK:    BLOCK.DIRT,
    STONE:          BLOCK.CONCRETE,
    TALLGRASS:      BLOCK.GRASS,
    TULIP:          BLOCK.TULIP,
    DANDELION:      BLOCK.DANDELION,
};

for(let key of Object.keys(blocks)) {
    let b = blocks[key];
    b = {...b},
    delete(b.texture);
    blocks[key] = b;
}

export const BIOMES = {};

BIOMES.OCEAN = {
    block:      blocks.STILL_WATER,
    code:       'OCEAN',
    color:      '#017bbb',
    dirt_color: new Color(1012 / 1024, 988 / 1024, 0, 0),
    title:      'ОКЕАН',
    max_height: 64,
    dirt_block: [blocks.SAND, blocks.GRAVEL, blocks.DIRT],
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
    block: blocks.SAND,
    code:       'BEACH',
    color:      '#ffdc7f',
    dirt_color: new Color(770 / 1024, 990 / 1024, 0, 0),
    title:      'ПЛЯЖ',
    max_height: 64,
    dirt_block: [blocks.SAND],
    trees:      {
        frequency: 0,
        list: []
    },
    plants: {
        frequency: .005,
        list: [
            {percent: 1, block: blocks.DEAD_BUSH}
        ]
    }
};

BIOMES.TEMPERATE_DESERT = {
    block: blocks.GRAVEL,
    code:       'TEMPERATE_DESERT',
    color:      '#f4a460',
    dirt_color: new Color(840 / 1024, 980 / 1024, 0, 0),
    title:      'УМЕРЕННАЯ ПУСТЫНЯ',
    dirt_block: [blocks.SAND],
    max_height: 6,
    trees:      {
        frequency: TREE_FREQUENCY / 2,
        list: [
            {percent: 1, trunk: blocks.CACTUS, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .005,
        list: [
            {percent: 1, block: blocks.DEAD_BUSH}
        ]
    }
};

BIOMES.SUBTROPICAL_DESERT = {
    block:      blocks.PLANK,
    code:       'SUBTROPICAL_DESERT',
    color:      '#c19a6b',
    dirt_color: new Color(845 / 1024, 990 / 1024, 0, 0),
    title:      'СУБТРОПИЧЕСКАЯ ПУСТЫНЯ',
    max_height: 6,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 1, trunk: blocks.WOOD_ACACIA, leaves: blocks.LEAVES_ACACIA, style: 'acacia', height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .5,
        list: [
            {percent: .98, block: blocks.GRASS},
            {percent: .01, block: blocks.TULIP},
            {percent: .01, block: blocks.DANDELION}
        ]
    }
};

BIOMES.SCORCHED = {
    block: blocks.CONCRETE,
    code:       'SCORCHED',
    color:      '#ff5500',
    dirt_color: new Color(770 / 1024, 990 / 1024, 0, 0),
    title:      'ОБОГРЕВАЮЩИЙ',
    max_height: 12,
    dirt_block: [blocks.SAND],
    trees:      {frequency: 0},
    plants:     {frequency: 0}
};

BIOMES.BARE = {
    block: blocks.WOOD,
    code:       'BARE',
    color:      '#CCCCCC',
    dirt_color: new Color(960 / 1024, 950 / 1024, 0, 0),
    title:      'ПУСТОШЬ',
    max_height: 64,
    dirt_block: [blocks.CONCRETE],
    trees:      {},
    plants:     {frequency: 0}
};

BIOMES.TUNDRA = {
    block: blocks.SPRUCE,
    code:       'TUNDRA',
    color:      '#74883c',
    dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0),
    title:      'ТУНДРА',
    max_height: 48,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY * 1.5,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce', height: {min: 7, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 1, block: blocks.BROWN_MUSHROOM}
        ]
    }
};

BIOMES.TAIGA = {
    block: blocks.WOOD,
    code:       'TAIGA',
    dirt_color: new Color(1000 / 1024, 990 / 1024, 0, 0),
    color:      '#879b89',
    title:      'ТАЙГА',
    max_height: 12,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce', height: {min: 7, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: 0,
        list: []
    }
};

BIOMES.SNOW = {
    block: blocks.SNOW_BLOCK,
    code:       'SNOW',
    color:      '#f5f5ff',
    dirt_color: new Color(1020 / 1024, 990 / 1024, 0, 0),
    title:      'СНЕГ',
    max_height: 30,
    dirt_block: [blocks.SNOW_DIRT],
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce', height: {min: 7, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: 0,
        list: []
    }
};

BIOMES.SHRUBLAND = {
    block: blocks.DIAMOND_ORE,
    code:       'SHRUBLAND',
    color:      '#316033',
    dirt_color: new Color(880 / 1024, 870 / 1024, 0, 0),
    title:      'КУСТАРНИКИ',
    dirt_block: [blocks.DIRT],
    max_height: 8,
    trees:      {frequency: 0},
    plants: {
        frequency: .3,
        list: [
            {percent: 1, block: blocks.GRASS}
        ]
    }
};

BIOMES.GRASSLAND = {
    block: blocks.DIRT,
    code:       'GRASSLAND',
    color:      '#98a136',
    dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0),
    title:      'ТРАВЯНАЯ ЗЕМЛЯ',
    max_height: 18,
    dirt_block: [blocks.DIRT],
    plants: {
        frequency: .5,
        list: [
            {percent: .95, block: blocks.GRASS},
            {percent: .025, block: blocks.TULIP},
            {percent: .025, block: blocks.DANDELION}
        ]
    },
    trees:      {
        frequency: TREE_FREQUENCY / 10,
        list: [
            {percent: 0.99, trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, style: 'wood', height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    }
};

BIOMES.TEMPERATE_DECIDUOUS_FOREST = {
    block: blocks.GLASS,
    code:       'TEMPERATE_DECIDUOUS_FOREST',
    color:      '#228b22',
    dirt_color: new Color(800 / 1024, 880 / 1024, 0, 0),
    title:      'УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС',
    max_height: 48,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.WOOD_BIRCH, leaves: blocks.WOOD_LEAVES, style: 'wood', height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .3,
        list: [
            {percent: .975, block: blocks.GRASS},
            {percent: .025, block: blocks.RED_MUSHROOM}
        ]
    }
};

BIOMES.TEMPERATE_RAIN_FOREST = {
    block: blocks.COBBLESTONE,
    code:       'TEMPERATE_RAIN_FOREST',
    color:      '#00755e',
    dirt_color: new Color(900 / 1024, 880 / 1024, 0, 0),
    title:      'УМЕРЕННЫЙ ДОЖДЬ ЛЕС',
    max_height: 15,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY * 1.5,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, style: 'wood', height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: 0,
        list: []
    }
};

BIOMES.TROPICAL_SEASONAL_FOREST = {
    block: blocks.BRICK,
    code:       'TROPICAL_SEASONAL_FOREST',
    color:      '#008456',
    dirt_color: new Color(900 / 1024, 900 / 1024, 0, 0),
    // dirt_color: new Color(900 / 1024, 965 / 1024, 0, 0),
    title:      'ТРОПИЧЕСКИЙ СЕЗОННЫЙ ЛЕС',
    max_height: 32,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY / 2,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.WOOD, leaves: blocks.OAK_LEAVES, style: 'wood', height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
            // {percent: 0.99, trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, style: 'wood', height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .35,
        list: [
            {percent: 1, block: blocks.GRASS}
        ]
    }
};

BIOMES.TROPICAL_RAIN_FOREST = {
    block: blocks.GLOWSTONE,
    code:       'TROPICAL_RAIN_FOREST',
    color:      '#16994f',
    dirt_color: new Color(840 / 1024, 880 / 1024, 0, 0),
    title:      'ТРОПИЧЕСКИЙ ЛЕС',
    max_height: 64,
    dirt_block: [blocks.DIRT],
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce', height: {min: 7, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: 0,
        list: []
    }
};

/**
* Функция определения биома в зависимости от возвышенности, влажности и отдаленности от экватора
*/
BIOMES.getBiome = function(v_height, humidity, equator) {

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
            if (humidity < 0.5) return 'TUNDRA';
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
        if (humidity < 0.16) return 'SUBTROPICAL_DESERT';
        if (humidity < 0.33) return 'GRASSLAND';
        if (humidity < 0.66) return 'TROPICAL_SEASONAL_FOREST';
        return 'TROPICAL_RAIN_FOREST';
    }

    let b = _(humidity, height, equator);
    return this[b];

}