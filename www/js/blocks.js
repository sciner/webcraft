import {DIRECTION, Color} from './helpers.js';
import {BLOCK_FUNC} from './blocks_func.js';

// ==========================================
// Block types
//
// This file contains all available block types and their properties.
// ==========================================

export const CHUNK_SIZE_X      = 16;
export const CHUNK_SIZE_Y      = 16;
export const CHUNK_SIZE_Z      = 16;
export const CHUNK_SIZE_Y_MAX  = 8192;
export const MAX_CAVES_LEVEL   = 256;

let TRANS_TEX = [4, 12];

export class BLOCK extends BLOCK_FUNC {};

// Each block has the following properties:
// id,
// spawnable (always true for creative mode),
// transparent,
// selflit (always false for annotation purpose),
// gravity (always false for annotation purpose),
// fluid (always false for annotation purpose),
// style: 'planting', 'pane, 'fence'
// texture

// A purple dummy block
BLOCK.DUMMY = {
    id: -1,
    inventory_icon_id: 3270,
	spawnable: false,
    passable: 0,
    transparent: false,
    sound: 'webcraft:block.wood',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [9, 9]; }
};
// Air
BLOCK.AIR = {
	id: 0,
	spawnable: false,
    passable: 1,
	transparent: true
};

// Bedrock
BLOCK.BEDROCK = {
    id: 1,
    inventory_icon_id: 521,
    spawnable: false,
    passable: 0,
    transparent: false,
    sound: 'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 1, 1]; }
};

// Test
BLOCK.TEST = {
    id: 199,
    inventory_icon_id: 445, // 240,
    spawnable: true,
    passable: 0,
    transparent: false,
    sound: 'webcraft:block.wood',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP) {
            return [26, 31];
        } else if(dir == DIRECTION.DOWN) {
            return [27, 31];
        } else if(dir == DIRECTION.BACK) {
            return [28, 31];
        } else if(dir == DIRECTION.RIGHT) {
            return [29, 31];
        } else if(dir == DIRECTION.FORWARD) {
            return [30, 31];
        } else {
            return [31, 31];
        }
    }
};

// Булыжник
BLOCK.COBBLESTONE = {
    id: 8,
    inventory_icon_id: 3358,
    spawnable: true,
    transparent: false,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 0, 1]; }
};

// Деревянная кирка
BLOCK.WOODEN_PICKAXE = {
    id: 131,
    inventory_icon_id: 3589,
    spawnable: true,
    transparent: true,
    selflit: false,
    gravity: false,
    fluid: false,
    stackable: false,
    is_item: true,
    texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 31]; }
};

// Деревянный топор
BLOCK.WOODEN_AXE = {
    id: 132,
    inventory_icon_id: 3587,
    spawnable: true,
    transparent: true,
    selflit: false,
    gravity: false,
    fluid: false,
    stackable: false,
    is_item: true,
    texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 30]; }
};


// Деревянная лопата
BLOCK.WOODEN_SHOVEL = {
	id: 137,
    inventory_icon_id: 3590,
	spawnable: true,
	transparent: true,
	selflit: false,
	gravity: false,
	fluid: false,
    stackable: false,
    is_item: true,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 28]; }
};

// Верстак
BLOCK.CRAFTING_TABLE = {
    id: 58,
    inventory_icon_id: 3600,
	spawnable: true,
    transparent: false,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [11, 2];
        } else if(dir == DIRECTION.DOWN) {
            return [4, 0];
        } else {
            if(dir == DIRECTION.RIGHT || dir == DIRECTION.FORWARD) {
                return [12, 3];
            }
            return [11, 3];
        }
    }
};

// Dirt
BLOCK.DIRT = {
    id: 2,
    inventory_icon_id: 980,
    spawnable: true,
    transparent: false,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP && lit )
            return [ 0, 16 ];
        else if(dir == DIRECTION.DOWN || !lit )
            return [ 2, 0 ];
        else
            return [ 2, 16 ];
    }
};

// Dirt
BLOCK.SNOW_DIRT = {
	id: 145,
    inventory_icon_id: 2244,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		if(dir == DIRECTION.UP && lit )
			return [2, 4];
		else if(dir == DIRECTION.DOWN || !lit )
			return [2, 0];
		else
			return [4, 4];
	}
};

// TNT
BLOCK.TNT = {
	id: 4,
    inventory_icon_id: 3614,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP) {
            return [ 9, 0 ];
        } else if(dir == DIRECTION.DOWN) {
			return [ 10, 0 ];
		} else {
			return [ 8, 0 ];
        }
	}
};

// Листья дерева
BLOCK.WOOD_LEAVES = {
    id: 196,
    inventory_icon_id: 3403,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 4, 3]; }
};

// Листья дуба
BLOCK.OAK_LEAVES = {
    id: 233,
    inventory_icon_id: 3403,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 23, 18]; }
};

// Листья ели
BLOCK.SPRUCE_LEAVES = {
	id: 198,
    inventory_icon_id: 3441,
	spawnable: true,
	transparent: true,
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 4, 8]; }
};

// Wood
BLOCK.WOOD = {
    id: 3,
    inventory_icon_id: 3429,
    spawnable: true,
    transparent: false,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.wood',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
            return [ 5, 1 ];
        else
            return [ 4, 1 ];
    }
};

// Spruce
BLOCK.SPRUCE = {
	id: 138,
    inventory_icon_id: 3442,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
			return [23, 17];
		else
			return [23, 16];
	}
};

// Bookcase
BLOCK.BOOKCASE = {
	id: 5,
    inventory_icon_id: 3239,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [ 4, 0 ];
        } else {
            return [ 3, 2 ];
        }
	}
};

// Plank
BLOCK.PLANK = {
	id: 7,
    inventory_icon_id: 902,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 4, 0 ]; }
};

BLOCK.GLOWSTONE = {
    id:             89,
    inventory_icon_id: 3381, // 3381
    spawnable:      true,
    transparent:    true,
    lightPower:     new Color(255, 235, 35, 255),
    sound: 			'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 6];
    }
};

// Concrete
BLOCK.CONCRETE = {
    id: 9,
    inventory_icon_id: 232,
    spawnable: true,
    transparent: false,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 1, 0 ]; }
};

// Полированный камень
BLOCK.POLISHED_STONE = {
	id: 70,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 6, 0 ]; }
};

// Brick
BLOCK.BRICK = {
	id: 10,
    inventory_icon_id: 869,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 7, 0 ]; }
};

// Sand
BLOCK.SAND = {
	id: 11,
    // inventory_icon_id: 11,
    inventory_icon_id: 3375,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: true,
	fluid: false,
    sound: 'webcraft:block.sand',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 2, 1 ]; }
};

// Gravel
BLOCK.GRAVEL = {
	id: 12,
    inventory_icon_id: 3364,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: true,
	fluid: false,
    sound: 'webcraft:block.gravel',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 3, 1 ]; }
};


// Саженец дуба (растение)
BLOCK.OAK_SAPLING = {
    id: 6,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 0];
    }
};

// Ствол акации
BLOCK.WOOD_ACACIA = {
    id: 165,
    inventory_icon_id: 2237,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.wood',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
            return [22, 17];
        else
            return [22, 16];
    }
};

// Листья акации
BLOCK.LEAVES_ACACIA = {
    id: 220,
    inventory_icon_id: 3403,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {return [22, 18];}
};

// Ствол берёзы
BLOCK.WOOD_BIRCH = {
    id: 162,
    inventory_icon_id: 2237,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.wood',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
            return [19, 16];
        else
            return [5, 7];
    }
};

// Iron
BLOCK.IRON = {
	id: 13,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 6, 1 ]; }
};

// Gold
BLOCK.GOLD = {
	id: 69,
    inventory_icon_id: 3236,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 7, 1 ]; }
};

BLOCK.GOLD_ORE = {
    id: 14,
    inventory_icon_id: 3393,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 2]; }
};

// Diamond
BLOCK.DIAMOND = {
	id: 150,
    inventory_icon_id: 3391,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 8, 1 ]; }
};

// Obsidian
BLOCK.OBSIDIAN = {
	id: 90,
    inventory_icon_id: 3369,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 5, 2 ]; }
};

// Glass
BLOCK.GLASS = {
	id: 17,
    inventory_icon_id: 3262,
	spawnable: true,
	transparent: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.glass',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 1, 3 ]; }
};

// Sponge
BLOCK.SPONGE = {
	id: 201,
    inventory_icon_id: 3612,
	spawnable: true,
	transparent: false,
	selflit: false,
	gravity: false,
	fluid: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 0, 3 ]; }
};

BLOCK.STILL_LAVA = {
    id: 171,
    spawnable: true,
    transparent: true,
    passable: .25,
    selflit: true,
    gravity: true,
    lightPower: new Color(253, 200, 80, 255),
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 14];
    }
}

// Water
BLOCK.STILL_WATER = {
    id: 202,
    inventory_icon_id: 3272,
    spawnable: true,
    transparent: true,
    passable: .25,
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 12];
    }
};

BLOCK.FLOWING_WATER = {
    id: 200,
    spawnable: true,
    passable: .25,
    transparent: true,
    selflit: true,
    fluid: {
        max_power: 1,
        still_block_id: BLOCK.STILL_WATER.id
    },
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 12];
    }
};

// Lava
BLOCK.FLOWING_LAVA = {
    id: 170,
    spawnable: true,
    passable: .25,
    transparent: true,
    selflit: true,
    gravity: false,
    fluid: {
        max_power: 1,
        still_block_id: BLOCK.STILL_LAVA.id
    },
    lightPower: new Color(253, 200, 80, 255),
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 13, 14 ]; }
};

BLOCK.IRON_ORE = {
    id: 15,
    inventory_icon_id: 3394,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 2]; }
};

BLOCK.COAL_ORE = {
    id: 16,
    // inventory_icon_id: 15,
    inventory_icon_id: 3390,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [2, 2]; }
};


BLOCK.LEAVES = {
    id: 18,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [12, 14]; }
};

BLOCK.LAPIS_LAZULI_ORE = {
    id: 21,
    inventory_icon_id: 3395,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 10]; }
};

BLOCK.LAPIS_LAZULI = {
    id: 22,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 9]; }
};

BLOCK.DISPENSER = {
    id: 23,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [14, 3];
        } else if (dir == DIRECTION.FORWARD) {
            return [14, 2];
        } else {
            return [13, 2];
        }
    }
};

BLOCK.SANDSTONE = {
    id: 24,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.gravel',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.NOTE_BLOCK = {
    id: 25,
    inventory_icon_id: 3610,
    spawnable: true,
    transparent: false,
    texture: function(world, lightmap, lit, x, y, z, dir) { return [10, 4]; }
};

BLOCK.STICK = {
    id: 130,
    inventory_icon_id: 1139,
    spawnable: true,
    transparent: false,
    is_item: true,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 0]; }
};

// Подушка кровати
BLOCK.BED = {
    id: 26,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [7, 8];
        } else if (dir == DIRECTION.DOWN) {
            return TRANS_TEX;
        } else if (dir == DIRECTION.BACKWARD) {
            return [8, 9];
        } else {
            return [5, 9];
        }
    }
};

BLOCK.STICKY_PISTON = {
    id: 29,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [10, 6];
        } else if (dir == DIRECTION.DOWN) {
            return [13, 6];
        } else {
            return [12, 6];
        }
    }
};

BLOCK.COBWEB = {
    id: 30,
    inventory_icon_id: 3359,
    spawnable: true,
    passable: .1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [11, 0];
    }
};

BLOCK.GRASS = {
    id: 31,
    inventory_icon_id: 3419,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 16];
    }
};

BLOCK.DEAD_BUSH = {
    id: 32,
    inventory_icon_id: 1038,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 3];
    }
};

BLOCK.PISTON = {
    id: 33,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [11, 6];
        } else if (dir == DIRECTION.DOWN) {
            return [13, 6];
        } else {
            return [12, 6];
        }
    }
};

// Шерсть
BLOCK.WOOL_BLACK = {
    id: 350,
    inventory_icon_id: 708,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 18];
    }
};
BLOCK.WOOL_BLUE = {
    id: 351,
    inventory_icon_id: 714,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 18];
    }
};
BLOCK.WOOL_BROWN = {
    id: 352,
    inventory_icon_id: 729,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 18];
    }
};
BLOCK.WOOL_CYAN = {
    id: 353,
    inventory_icon_id: 726,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 18];
    }
};
BLOCK.WOOL_GRAY = {
    id: 354,
    inventory_icon_id: 229,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 18];
    }
};
BLOCK.WOOL_GREEN = {
    id: 355,
    inventory_icon_id: 738,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 18];
    }
};

// Терракота
BLOCK.TERRACOTTA_BLACK = {
    id: 450,
    // inventory_icon_id: 1535,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 19];
    }
};
BLOCK.TERRACOTTA_BLUE = {
    id: 451,
    // inventory_icon_id: 1535,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 19];
    }
};
BLOCK.TERRACOTTA_BROWN = {
    id: 452,
    // inventory_icon_id: 1535,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 19];
    }
};
BLOCK.TERRACOTTA_CYAN = {
    id: 453,
    // inventory_icon_id: 1535,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 19];
    }
};
BLOCK.TERRACOTTA_GRAY = {
    id: 454,
    // inventory_icon_id: 1535,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 19];
    }
};
BLOCK.TERRACOTTA_GREEN = {
    id: 455,
    // inventory_icon_id: 1535,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 19];
    }
};

//
BLOCK.DANDELION = {
    id: 36,
    inventory_icon_id: 3413,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 0];
    }
};

/*
BLOCK.POPPY = {
    id: 37,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [12, 0];
    }
};
*/

BLOCK.TULIP = {
    id: 38,
    inventory_icon_id: 3435,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [12, 0];
    }
};

BLOCK.BROWN_MUSHROOM = {
    id: 39,
    inventory_icon_id: 3408,
    spawnable: true,
    transparent: true,
    passable: 1,
    style: 'planting',
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 1];
    }
};

BLOCK.RED_MUSHROOM = {
    id: 40,
    inventory_icon_id: 3438,
    spawnable: true,
    transparent: true,
    passable: 1,
    style: 'planting',
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [12, 1];
    }
};

BLOCK.DOUBLE_SLAB = {
    id: 43,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 0];
    }
};

BLOCK.SLAB = {
    id: 44,
    inventory_icon_id: 922,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [6, 0];
    }
};

BLOCK.MOSS_STONE = {
    id: 48,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [4, 2]; }
};

// Факел
BLOCK.TORCH = {
    id:             50,
    width:          2 / 16,
    height:         10 / 16,
    inventory_icon_id: 3389,
    spawnable:      true,
    passable:       1,
    transparent:    true,
    lightPower:     new Color(253, 241, 131, 180),
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [0, 6];
        } else if (dir == DIRECTION.DOWN) {
            return [0, 7];
        }
        return [0, 5];
    }
};

BLOCK.WOOD_STAIRS = {
    id: 53,
    inventory_icon_id: 3318,
    spawnable: true,
    transparent: false,
    style: 'stairs',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [4, 0];
	}
};

// Сундук
BLOCK.CHEST = {
    id: 54,
    width: 14 / 16,
    height: 14 / 16,
    inventory_icon_id: 58,
    is_entity: true,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.chest',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [17, 6];
        } else if (dir == DIRECTION.FORWARD) {
            return [19, 6];
        } else {
            return [18, 6];
        }
    }
};

BLOCK.DIAMOND_ORE = {
    id: 56,
    inventory_icon_id: 3391,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [2, 3]; }
};

BLOCK.WHEAT = {
    id: 59,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 5];
    }
};

BLOCK.FARMLAND = {
    id: 60,
    inventory_icon_id: 885,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [7, 5]; }
};

BLOCK.FURNACE = {
    id: 61,
    inventory_icon_id: 3606,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [14, 3];
        } else if (dir == DIRECTION.FORWARD) {
            return [12, 2];
        } else {
            return [13, 2];
        }
    }
};

BLOCK.BURNING_FURNACE = {
    id: 62,
    inventory_icon_id: 3606, // @todo!
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [14, 3];
        } else if (dir == DIRECTION.FORWARD) {
            return [13, 3];
        } else {
            return [13, 2];
        }
    }
};

BLOCK.STANDING_SIGN = {
    id: 63,
    spawnable: true,
    transparent: true,
    style: 'sign',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 11];
    }
};

BLOCK.WOOD_DOOR = {
    id: 64,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 5];
    }
};


// ЛЕСТНИЦА
BLOCK.LADDER = {
    id: 65,
    inventory_icon_id: 3271,
    width: 1 / 16,
    align: ['back'],
    spawnable: true,
    transparent: true,
    style: 'ladder',
    passable: .25,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        // return [3, 3];
        if (dir == DIRECTION.FORWARD) {
            return [3, 5];
        }
        return TRANS_TEX;
    }
};

BLOCK.COBBLESTONE_STAIRS = {
    id: 67,
    spawnable: true,
    transparent: false,
    style: 'stairs',
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 1];
    }
};

BLOCK.IRON_DOOR = {
    id: 71,
    spawnable: true,
    transparent: true,
    style: 'pane',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 5];
    }
};

BLOCK.WOOD_PLATE = {
    id: 72,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [4, 0];
	}
};

BLOCK.REDSTONE_ORE = {
    id: 73,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [3, 3];
	}
};

BLOCK.GLOWING_REDSTONE_ORE = {
    id: 74,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [3, 3];
	}
}

BLOCK.REDSTONE_TORCH_ON = {
    id: 75,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'torch',
    lightPower: new Color(253, 200, 131, 150),
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 6];
	}
};

BLOCK.REDSTONE_TORCH_OFF = {
    id: 76,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'torch',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 7];
	}
};

BLOCK.ICE = {
    id: 79,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 4];
	}
};

BLOCK.SNOW_BLOCK = {
    id: 80,
    inventory_icon_id: 3314,
    spawnable: true,
    transparent: false,
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 4];
    }
};

BLOCK.CACTUS = {
    id: 81,
    inventory_icon_id: 3409,
    width: 0.875,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.cloth',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.DOWN) {
            return [7, 4];
        } else if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [5, 4];
        } else {
            return [6, 4];
        }
	}
};

BLOCK.CLAY = {
    id: 82,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 4];
    }
};

BLOCK.SUGAR_CANES = {
    id: 83,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return TRANS_TEX;
        } else {
            return [9, 4];
        }
    }
};

BLOCK.JUKEBOX = {
    id: 84,
    inventory_icon_id: 3608,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [11, 4];
        } else {
            return [10, 4];
        }
    }
};

BLOCK.OAK_FENCE = {
    id: 85,
    spawnable: true,
    transparent: true,
    style: 'fence',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.PUMPKIN = {
    id: 86,
    inventory_icon_id: 3436,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [6, 6];
        } else {
            return [6, 7];
        }
    }
};

BLOCK.NETHERRACK = {
    id: 87,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 6];
    }
};

BLOCK.SOUL_SAND = {
    id: 88,
    spawnable: true,
    gravity: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 6];
    }
};

BLOCK.LIT_PUMPKIN = {
    id: 91,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.FORWARD) {
            return [8, 7];
        } else if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [6, 6];
        } else {
            return [6, 7];
        }
    }
};

BLOCK.STAINED_GLASS = {
    id: 95,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 3];
    }
};

BLOCK.MONSTER_EGG = {
    id: 97,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 6];
    }
};

BLOCK.STONE_BRICK = {
    id: 98,
    inventory_icon_id: 3379,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [6, 3];
    }
};

BLOCK.BROWN_MUSHROOM_BLOCK = {
    id: 99,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [14, 7];
    }
};

BLOCK.RED_MUSHROOM_BLOCK = {
    id: 100,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 7];
    }
};

BLOCK.IRON_BARS = {
    id: 101,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 5];
    }
};

BLOCK.GLASS_PANE = {
    id: 102,
    inventory_icon_id: 3261,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 3]; }
};

BLOCK.MELON = {
    id: 103,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [9, 8];
        } else {
            return [8, 8];
        }
    }
};

BLOCK.PUMPKIN_STEM = {
    id: 104,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 6];
    }
};

BLOCK.MELON_STEM = {
    id: 105,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 6];
    }
};

BLOCK.VINES = {
    id: 106,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [11, 14];
    }
};

BLOCK.FENCE_GATE = {
    id: 107,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 13];
    }
};

BLOCK.BRICK_STAIRS = {
    id: 108,
    inventory_icon_id: 3241,
    spawnable: true,
    transparent: false,
    style: 'stairs',
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [7, 0]; }
};

BLOCK.STONE_STAIRS = {
    id: 109,
    inventory_icon_id: 3324,
    spawnable: true,
    transparent: false,
    style: 'stairs',
    sound: 'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 0];
    }
};

BLOCK.MYCELIUM = {
    id: 110,
    spawnable: true,
    transparent: false,
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [14, 4];
        } else if (dir == DIRECTION.DOWN || !lit) {
            return [2, 0];
        } else {
            return [13, 4];
        }
    }
};

BLOCK.NETHER_BRICK = {
    id: 112,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 6];
    }
};

BLOCK.NETHER_BRICK_FENCE = {
    id: 113,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.NETHER_STAIRS = {
    id: 114,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 6];
    }
};

BLOCK.NETHER_WART = {
    id: 115,
    spawnable: true,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 14];
    }
};

// Стол зачарования
BLOCK.ENCHANTING_TABLE = {
    id: 116,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [6, 10];
        } else if (dir == DIRECTION.DOWN) {
            return [7, 11];
        } else {
            return [6, 11];
        }
    }
};

BLOCK.BREWING_STAND = {
    id: 117,
    spawnable: true,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 9];
    }
};

BLOCK.CAULDRON = {
    id: 118,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [10, 8];
        } else if (dir == DIRECTION.DOWN) {
            return TRANS_TEX;
        } else {
            return [10, 9];
        }
    }
};

BLOCK.END_PORTAL_FRAME = {
    id: 120,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [14, 9];
        } else if (dir == DIRECTION.DOWN) {
            return [15, 10];
        } else {
            return [15, 9];
        }
    }
};

BLOCK.END_STONE = {
    id: 121,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 10];
    }
};

BLOCK.DOUBLE_SLAB2 = {
    id: 125,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 0];
    }
};

BLOCK.WOOD_SLAB = {
    id: 126,
    inventory_icon_id: 3317,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.wood',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 0];
    }
};

BLOCK.BRICK_SLAB = {
    id: 127,
    inventory_icon_id: 3240,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {return [7, 0];}
};

BLOCK.SANDSTONE_STAIRS = {
    id: 128,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.EMERALD_ORE = {
    id: 129,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 11];
    }
};

BLOCK.EMERALD = {
    id: 133,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 12];
    }
};

BLOCK.SPRUCE_STAIRS = {
    id: 134,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [4, 7];
	}
};

BLOCK.BIRCH_STAIRS = {
    id: 135,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [4, 7];
	}
};

BLOCK.JUNGLE_STAIRS = {
    id: 136,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [4, 7];
	}
};

BLOCK.COBBLESTONE_WALL = {
    id: 139,
    spawnable: true,
    transparent: false,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 1];
    }
};

BLOCK.CARROTS = {
    id: 141,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [11, 5];
    }
};

BLOCK.POTATOS = {
    id: 142,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [11, 5];
    }
};

BLOCK.TRAPPED_CHEST = {
    id: 146,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [9, 1];
        } else if (dir == DIRECTION.FORWARD) {
            return [11, 1];
        } else {
            return [10, 1];
        }
    }
};

BLOCK.REDSTONE = {
    id: 152,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 13];
    }
};

BLOCK.QUARTZ = {
    id: 155,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 13];
    }
};

BLOCK.QUARTZ_STAIRS = {
    id: 156,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 13];
    }
};

BLOCK.DROPPER = {
    id: 158,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.DOWN || dir == DIRECTION.UP) {
            return [14, 3];
        } else if (dir == DIRECTION.FORWARD) {
            return [14, 2];
        } else {
            return [13, 2];
        }
    }
};

BLOCK.HARDENED_CLAY = {
    id: 159,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 1];
    }
};

BLOCK.STAINED_GLASS_PANE = {
    id: 160,
    spawnable: true,
    transparent: true,
    style: 'pane',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 3]; }
};

BLOCK.LEAVES2 = {
    id: 161,
    spawnable: true,
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [5, 3]; }
};

BLOCK.ACACIA_STAIRS = {
    id: 163,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 7];
    }
};

BLOCK.DARK_OAK_STAIRS = {
    id: 164,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 7];
    }
};

BLOCK.PRISMARINE = {
    id: 168,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 14];
    }
};

BLOCK.SEA_LANTERN = {
    id: 169,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 4];
    }
};

BLOCK.HARDENED_CLAY2 = {
    id: 172,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 1];
    }
};

BLOCK.COAL = {
    id: 173,
    inventory_icon_id: 1118,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 2];
    }
};

BLOCK.ICE2 = {
    id: 174,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 4];
	}
};

/*
BLOCK.FLOWER = {
    id: 175,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [12, 0];
	}
};*/

BLOCK.RED_SANDSTONE = {
    id: 179,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.RED_SANDSTONE_STAIRS = {
    id: 180,
    spawnable: true,
    transparent: false,
    style: 'stairs',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.DOUBLE_RED_SANDSTONE_SLAB = {
    id: 181,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.RED_SANDSTONE_SLAB = {
    id: 182,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 12];
    }
};

BLOCK.FENCE_GATE2 = {
    id: 183,
    spawnable: true,
    transparent: true,
    style: 'fence',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 13];
    }
};

BLOCK.FENCE_GATE3 = {
    id: 184,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 13];
    }
};

BLOCK.FENCE_GATE4 = {
    id: 185,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 13];
    }
};

BLOCK.FENCE_GATE5 = {
    id: 186,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 13];
    }
};

BLOCK.FENCE_GATE6 = {
    id: 187,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 13];
    }
};

BLOCK.FENCE2 = {
    id: 188,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.FENCE3 = {
    id: 189,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.FENCE4 = {
    id: 190,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.FENCE5 = {
    id: 191,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.FENCE6 = {
    id: 192,
    spawnable: true,
    transparent: true,
    style: 'fence',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 13];
    }
};

BLOCK.SPRUCE_DOOR = {
    id: 193,
    spawnable: true,
    transparent: true,
    style: 'pane',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 5];
    }
};

BLOCK.BIRCH_DOOR = {
    id: 194,
    spawnable: true,
    transparent: true,
    style: 'pane',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 5];
    }
};

BLOCK.JUNGLE_DOOR = {
    id: 195,
    spawnable: true,
    transparent: true,
    style: 'pane',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 5];
    }
};

BLOCK.ACACIA_DOOR = {
    id: 203,
    spawnable: true,
    style: 'pane',
    transparent: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 5];
    }
};

BLOCK.DARK_OAK_DOOR = {
    id: 197,
    spawnable: true,
    transparent: true,
    style: 'pane',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 5];
    }
};

BLOCK.END_STONE_BRICK = {
    id: 206,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 10];
    }
};

BLOCK.ICE3 = {
    id: 212,
    spawnable: true,
    transparent: false,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 4];
	}
};

// Run getAll()
BLOCK.getAll();

BLOCK.BLOCK_BY_ID = {};
for(let key of Object.keys(BLOCK)) {
    let block = BLOCK[key];
    if(typeof(block) == 'object' && ('spawnable' in block)) {
        BLOCK.BLOCK_BY_ID[block.id] = block;
    }
}
