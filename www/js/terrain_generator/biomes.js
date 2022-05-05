import {Color} from '../helpers.js';
import {BLOCK} from "../blocks.js";

const CACTUS_MIN_HEIGHT     = 2;
const CACTUS_MAX_HEIGHT     = 5;
const TREE_MIN_HEIGHT       = 4;
const TREE_MAX_HEIGHT       = 8;
const TREE_FREQUENCY        = 0.015;

export const TREES = {
    BIRCH:          {trunk: BLOCK.BIRCH_TRUNK.id, leaves: BLOCK.BIRCH_LEAVES.id, style: 'wood', height: {min: 4, max: 8}},
    OAK:            {trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.OAK_LEAVES.id, style: 'wood', height: {min: 4, max: 8}},
    ACACIA:         {trunk: BLOCK.ACACIA_TRUNK.id, leaves: BLOCK.ACACIA_LEAVES.id, style: 'acacia', height: {min: 5, max: 12}},
    SPRUCE:         {trunk: BLOCK.SPRUCE_TRUNK.id, leaves: BLOCK.SPRUCE_LEAVES.id, style: 'spruce', height: {min: 6, max: 22}},
    TROPICAL_TREE:  {trunk: BLOCK.JUNGLE_TRUNK.id, leaves: BLOCK.JUNGLE_LEAVES.id, style: 'tropical_tree', height: {min: 1, max: 22}},
    RED_MUSHROOM:   {trunk: BLOCK.MUSHROOM_STRIPE.id, leaves: BLOCK.RED_MUSHROOM_BLOCK.id, style: 'mushroom', height: {min: 5, max: 12}},
    BROWN_MUSHROOM: {trunk: BLOCK.MUSHROOM_STRIPE.id, leaves: BLOCK.RED_MUSHROOM_BLOCK.id, style: 'mushroom', height: {min: 5, max: 12}},
};

let biome_stat = {
    height:     {min: 999999999, max: -99999},
    humidity:   {min: 999999999, max: -99999},
    equator:    {min: 999999999, max: -99999},
};

// 2. Biomes
export const BIOMES = {};

BIOMES.OCEAN = {
    block:      BLOCK.STILL_WATER.id,
    code:       'OCEAN',
    color:      '#017bbb',
    dirt_color: new Color(1012 / 1024, 988 / 1024, 0, 0),
    title:      'ОКЕАН',
    max_height: 64,
    dirt_block: [BLOCK.SAND.id, BLOCK.GRAVEL.id, BLOCK.GRASS_DIRT.id],
    no_smooth:  true,
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
    dirt_color: new Color(770 / 1024, 990 / 1024, 0, 0),
    title:      'ПЛЯЖ',
    max_height: 64,
    dirt_block: [BLOCK.SAND.id],
    no_smooth:  true,
    trees:      {
        frequency: 0,
        list: []
    },
    plants: {
        frequency: .005,
        list: [
            {percent: 1, block: BLOCK.DEAD_BUSH.id}
        ]
    }
};

BIOMES.TEMPERATE_DESERT = {
    block:      BLOCK.GRAVEL.id,
    code:       'TEMPERATE_DESERT',
    color:      '#f4a460',
    dirt_color: new Color(840 / 1024, 980 / 1024, 0, 0),
    title:      'УМЕРЕННАЯ ПУСТЫНЯ',
    dirt_block: [BLOCK.SAND.id],
    max_height: 6,
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY / 2,
        list: [
            {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: TREE_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .005,
        list: [
            {percent: 1, block: BLOCK.DEAD_BUSH.id}
        ]
    }
};

BIOMES.JUNGLE = {
    block:      BLOCK.OAK_PLANK.id,
    code:       'JUNGLE',
    color:      '#4eb41c',
    dirt_color: new Color(800 / 1024, 825 / 1024, 0, 0),
    title:      'ДЖУНГЛИ',
    max_height: 48,
    dirt_block: [BLOCK.GRASS_DIRT.id, BLOCK.GRASS_DIRT.id, BLOCK.DIRT.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY * 4,
        list: [
            {percent: .025, ...TREES.TROPICAL_TREE, height: {min: 16, max: 22}},
            {percent: .1, ...TREES.TROPICAL_TREE, height: {min: 9, max: 14}},
            {percent: .4, ...TREES.TROPICAL_TREE, height: {min: 3, max: 8}},
            {percent: .2, ...TREES.TROPICAL_TREE, height: {min: 1, max: 1}},
            // bamboo
            {percent: .1, trunk: BLOCK.BAMBOO.id, leaves: null, style: 'bamboo', height: {min: 6, max: 20}}
        ]
    },
    plants: {
        frequency: .8,
        list: [
            {percent: .6, block: BLOCK.OAK_LEAVES.id},
            {percent: .37, block: BLOCK.GRASS.id},
            {percent: .01, block: BLOCK.TULIP.id},
            {percent: .005, block: BLOCK.WATERMELON.id},
            {percent: .005, block: BLOCK.DANDELION.id}
        ]
    }
};

BIOMES.SUBTROPICAL_DESERT = {
    block:      BLOCK.OAK_PLANK.id,
    code:       'SUBTROPICAL_DESERT',
    color:      '#c19a6b',
    dirt_color: new Color(845 / 1024, 990 / 1024, 0, 0),
    title:      'СУБТРОПИЧЕСКАЯ ПУСТЫНЯ',
    max_height: 6,
    dirt_block: [BLOCK.GRASS_DIRT.id, BLOCK.GRASS_DIRT.id, BLOCK.DIRT.id, BLOCK.PODZOL.id],
    no_smooth:  false,
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
            {percent: .98, block: BLOCK.GRASS.id},
            {percent: .01, block: BLOCK.TULIP.id},
            {percent: .01, block: BLOCK.DANDELION.id}
        ]
    }
};

BIOMES.SCORCHED = {
    block: BLOCK.CONCRETE.id,
    code:       'SCORCHED',
    color:      '#ff5500',
    dirt_color: new Color(770 / 1024, 990 / 1024, 0, 0),
    title:      'ОБОГРЕВАЮЩИЙ',
    max_height: 12,
    dirt_block: [BLOCK.SAND.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY / 4,
        list: [
            {percent: 1, trunk: BLOCK.CACTUS.id, leaves: null, style: 'cactus', height: {min: CACTUS_MIN_HEIGHT, max: CACTUS_MAX_HEIGHT}}
        ]
    },
    plants:     {frequency: 0}
};

BIOMES.BARE = {
    block: BLOCK.OAK_TRUNK.id,
    code:       'BARE',
    color:      '#CCCCCC',
    dirt_color: new Color(960 / 1024, 950 / 1024, 0, 0),
    title:      'ПУСТОШЬ',
    max_height: 64,
    dirt_block: [BLOCK.CONCRETE.id],
    no_smooth:  false,
    trees:      {},
    plants:     {frequency: 0}
};

BIOMES.TUNDRA = {
    block: BLOCK.SPRUCE_TRUNK.id,
    code:       'TUNDRA',
    color:      '#74883c',
    dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0),
    title:      'ТУНДРА',
    max_height: 48,
    dirt_block: [BLOCK.GRASS_DIRT.id, BLOCK.PODZOL.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY * 1.5,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.01, ...TREES.SPRUCE, height: {min: 6, max: 24}},
            {percent: 0.1, trunk: BLOCK.MOSS_STONE.id, leaves: null, style: 'tundra_stone', height: {min: 2, max: 2}},
            {percent: 0.2, trunk: BLOCK.LARGE_FERN.id, leaves: BLOCK.LARGE_FERN_TOP.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.681, ...TREES.SPRUCE, height: {min: 6, max: 11}}
        ]
    },
    plants: {
        frequency: .65,
        list: [
            {percent: .68, block: BLOCK.GRASS.id},
            {percent: .3, block: BLOCK.FERN.id},
            {percent: .001, block: BLOCK.BROWN_MUSHROOM.id},
            {percent: .009, block: BLOCK.DEAD_BUSH.id}
        ]
    }
};

BIOMES.TAIGA = {
    block: BLOCK.OAK_TRUNK.id,
    code:       'TAIGA',
    dirt_color: new Color(1000 / 1024, 990 / 1024, 0, 0),
    color:      '#879b89',
    title:      'ТАЙГА',
    max_height: 12,
    dirt_block: [BLOCK.GRASS_DIRT.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, ...TREES.SPRUCE, height: {min: 7, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: 0,
        list: []
    }
};

BIOMES.SNOW = {
    block:      BLOCK.SNOW_BLOCK.id,
    code:       'SNOW',
    color:      '#f5f5ff',
    dirt_color: new Color(1020 / 1024, 990 / 1024, 0, 0),
    title:      'СНЕГ',
    max_height: 35,
    dirt_block: [BLOCK.SNOW_DIRT.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
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
    dirt_color: new Color(880 / 1024, 870 / 1024, 0, 0),
    title:      'КУСТАРНИКИ',
    dirt_block: [BLOCK.GRASS_DIRT.id],
    no_smooth:  false,
    max_height: 8,
    trees:      {frequency: 0},
    plants: {
        frequency: .3,
        list: [
            {percent: 1, block: BLOCK.GRASS.id}
        ]
    }
};

BIOMES.GRASSLAND = {
    block:      BLOCK.GRASS_DIRT.id,
    code:       'GRASSLAND',
    color:      '#98a136',
    dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0),
    title:      'ТРАВЯНАЯ ЗЕМЛЯ',
    max_height: 18,
    dirt_block: [BLOCK.GRASS_DIRT.id],
    no_smooth:  false,
    plants: {
        frequency: .5,
        list: [
            {percent: .800, block: BLOCK.GRASS.id},
            {percent: .025, block: BLOCK.TULIP.id},
            {percent: .025, block: BLOCK.FLOWER_ALLIUM.id},
            {percent: .025, block: BLOCK.FLOWER_BLUE_ORCHID.id},
            {percent: .025, block: BLOCK.FLOWER_OXEYE_DAISY.id},
            {percent: .025, block: BLOCK.FLOWER_LILY_OF_THE_VALLEY.id},
            {percent: .025, block: BLOCK.FLOWER_CORNFLOWER.id},
            {percent: .025, block: BLOCK.DANDELION.id},
            {percent: .015, block: BLOCK.PUMPKIN.id},
            {percent: .025, trunk: BLOCK.FLOWER_LILAC.id, leaves: BLOCK.FLOWER_LILAC_TOP.id, style: 'stump', height: {min: 1, max: 1}}
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
    block: BLOCK.GLASS.id,
    code:       'TEMPERATE_DECIDUOUS_FOREST',
    color:      '#228b22',
    dirt_color: new Color(800 / 1024, 880 / 1024, 0, 0),
    title:      'УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС',
    max_height: 48,
    dirt_block: [BLOCK.GRASS_DIRT.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, ...TREES.BIRCH, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .3,
        list: [
            {percent: .975, block: BLOCK.GRASS.id},
            {percent: .025, block: BLOCK.RED_MUSHROOM.id}
        ]
    }
};

BIOMES.TEMPERATE_RAIN_FOREST = {
    block: BLOCK.COBBLESTONE.id,
    code:       'TEMPERATE_RAIN_FOREST',
    color:      '#00755e',
    dirt_color: new Color(900 / 1024, 880 / 1024, 0, 0),
    title:      'УМЕРЕННЫЙ ДОЖДЬ ЛЕС',
    max_height: 15,
    dirt_block: [BLOCK.GRASS_DIRT.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY * 1.5,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: 0,
        list: []
    }
};

BIOMES.TROPICAL_SEASONAL_FOREST = {
    block:      BLOCK.BRICK.id,
    code:       'TROPICAL_SEASONAL_FOREST',
    color:      '#008456',
    dirt_color: new Color(900 / 1024, 900 / 1024, 0, 0),
    // dirt_color: new Color(900 / 1024, 965 / 1024, 0, 0),
    title:      'ТРОПИЧЕСКИЙ СЕЗОННЫЙ ЛЕС',
    max_height: 32,
    dirt_block: [BLOCK.GRASS_DIRT.id],
    no_smooth:  false,
    trees:      {
        frequency: TREE_FREQUENCY / 2,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.99, ...TREES.OAK, height: {min: TREE_MIN_HEIGHT, max: TREE_MAX_HEIGHT}}
        ]
    },
    plants: {
        frequency: .35,
        list: [
            {percent: 1, block: BLOCK.GRASS.id}
        ]
    }
};

BIOMES.TROPICAL_RAIN_FOREST = {
    block:      BLOCK.GLOWSTONE.id,
    code:       'TROPICAL_RAIN_FOREST',
    color:      '#16994f',
    dirt_color: new Color(860 / 1024, 910 / 1024, 0, 0),
    title:      'ГРИБНОЙ',
    max_height: 64,
    dirt_block: [BLOCK.GRASS_DIRT.id, BLOCK.GRASS_DIRT.id, BLOCK.MYCELIUM.id, BLOCK.MOSS_BLOCK.id],
    no_smooth:  false,
    trees:      {
        frequency: .0085,
        list: [
            {percent: 0.01, trunk: BLOCK.OAK_TRUNK.id, leaves: BLOCK.RED_MUSHROOM.id, style: 'stump', height: {min: 1, max: 1}},
            {percent: 0.69, ...TREES.RED_MUSHROOM, height: {min: 8, max: 12}},
            {percent: 0.15, ...TREES.BROWN_MUSHROOM, height: {min: 5, max: 8}}
        ]
    },
    plants: {
        frequency: .75,
        list: [
            {percent: .1, block: BLOCK.RED_MUSHROOM.id},
            {percent: .1, block: BLOCK.BROWN_MUSHROOM.id},
            {percent: .7, block: BLOCK.GRASS.id}
        ]
    }
};

for(let k in BIOMES) {
    const biome = BIOMES[k];
    biome.code = k;
    biome.color_rgba = Color.hexToColor(biome.color);
}

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
    return this[b];

}