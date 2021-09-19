import {Color, DIRECTION, Vector} from './helpers.js';
import {BLOCK_FUNC} from './blocks_func.js';

export const CHUNK_SIZE_X      = 16;
export const CHUNK_SIZE_Y      = 32;
export const CHUNK_SIZE_Z      = 16;
export const CHUNK_SIZE_Y_MAX  = 4096;
export const MAX_CAVES_LEVEL   = 256;
export const TRANS_TEX         = [4, 12];

export class BLOCK extends BLOCK_FUNC {
    
    // Возвращает координаты чанка по глобальным абсолютным координатам
    static getChunkPos(x, y, z) {
        if(x instanceof Vector) {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        //
        let v = new Vector(
            Math.floor(x / CHUNK_SIZE_X),
            Math.floor(y / CHUNK_SIZE_Y),
            Math.floor(z / CHUNK_SIZE_Z)
        );
        // Fix negative zero
        if(v.x == 0) {v.x = 0;}
        if(v.y == 0) {v.y = 0;}
        if(v.z == 0) {v.z = 0;}
        return v;
    }

    //
    static getBlockIndex(x, y, z) {
        let f = (v, m) => {
            if(v < 0) v++;
            v = v % m;
            if(v == 0) v = 0;
            if(v < 0) v *= -1;
            return v;
        };
        let v = new Vector(
            f(x, CHUNK_SIZE_X),
            f(y, CHUNK_SIZE_Y),
            f(z, CHUNK_SIZE_Z),
        );
        if(x < 0) v.x = CHUNK_SIZE_X - 1 - v.x;
        if(y < 0) v.y = CHUNK_SIZE_Y - 1 - v.y;
        if(z < 0) v.z = CHUNK_SIZE_Z - 1 - v.z;
        return v;
    }

};

// BLOCK PROPERTIES:
// id (int)                 - Unique ID
// fluid (bool)             - Is fluid
// gravity (bool)           - May fall
// is_item (bool)           - 
// instrument_id (string)   - Unique code of instrument type
// inventory_icon_id (int)  - Position in inventory atlas
// max_in_stack (int)       - Max count in inventory or other stack
// name (string)            - Unique name
// passable (float)         - Passable value 0...1
// sound (string)           - Resource ID
// spawnable (bool)         - Cannot be /give for player
// style (string)           - used for drawing style (cube, fence, ladder, plant, pane, sign, slab, stairs)
// tags (string[])          - Array of string tags
// texture (function)       - 
// transparent (bool)       - Not cube

// A purple dummy block
BLOCK.DUMMY = {
    id: -1,
    inventory_icon_id: 3270,
	spawnable: false,
    passable: 0,
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
    sound: 'webcraft:block.stone',
    tags: ['stone'],
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 1, 1]; }
};

// Test
BLOCK.TEST = {
    id: 199,
    inventory_icon_id: 445, // 240,
    spawnable: true,
    passable: 0,
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
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.stone',
    tags: ['cobblestone'],
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
    max_in_stack: 1,
    is_item: true,
    instrument_id: 'pickaxe',
    tags: ['pickaxe'],
    texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 31]; }
};

// Каменная кирка
BLOCK.STONE_PICKAXE = {
    id: 500,
    inventory_icon_id: 3585,
    spawnable: true,
    transparent: true,
    selflit: false,
    gravity: false,
    fluid: false,
    max_in_stack: 1,
    is_item: true,
    instrument_id: 'pickaxe',
    tags: ['pickaxe'],
    texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 31]; }
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
    max_in_stack: 1,
    is_item: true,
    instrument_id: 'axe',
    tags: ['axe'],
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
    max_in_stack: 1,
    is_item: true,
    instrument_id: 'shovel',
    tags: ['shovel'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 28]; }
};

// Верстак
BLOCK.CRAFTING_TABLE = {
    id: 58,
    inventory_icon_id: 3600,
	spawnable: true,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [11, 2];
        } else if(dir == DIRECTION.DOWN) {
            return [21, 19];
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
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.grass',
    tags: ['dirt'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP && lit )
            return [ 0, 16 ];
        else if(dir == DIRECTION.DOWN || !lit )
            return [ 2, 0 ];
        else
            return [ 2, 16 ];
    }
};

// Podzol
BLOCK.PODZOL = {
    id: 466,
    inventory_icon_id: 3371,
    spawnable: true,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.gravel',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP && lit )
            return [4, 0];
        else if(dir == DIRECTION.DOWN || !lit )
            return [ 2, 0 ];
        else
            return [4, 1];
    }
};

// Каменистая земля
BLOCK.COARSE_DIRT = {
    id: 467,
    inventory_icon_id: 462,
    spawnable: true,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.gravel',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 3];
    }
};

// Тропинка
BLOCK.DIRT_PATH = {
    id: 468,
    inventory_icon_id: 980,
    spawnable: true,
    transparent: true,
    selflit: false,
    gravity: false,
    fluid: false,
    height: 15 / 16,
    sound: 'webcraft:block.grass',
    tags: ['dirt'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP && lit )
            return [4, 5];
        else if(dir == DIRECTION.DOWN || !lit )
            return [ 2, 0 ];
        else
            return [4, 6];
    }
};

// SNOW_DIRT
BLOCK.SNOW_DIRT = {
	id: 145,
    inventory_icon_id: 2244,
	spawnable: true,
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

// Листья березы
BLOCK.BIRCH_LEAVES = {
	id: 198,
    inventory_icon_id: 3441,
	spawnable: true,
	transparent: true,
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {return [20, 18];}
};

// Листья дуба
BLOCK.OAK_LEAVES = {
    id: 233,
    inventory_icon_id: 3403,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {return [21, 18];}
};

// Листья акации
BLOCK.ACACIA_LEAVES = {
    id: 220,
    inventory_icon_id: 3403,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {return [22, 18];}
};

// Листья ели
BLOCK.SPRUCE_LEAVES = {
	id: 190,
    inventory_icon_id: 3441,
	spawnable: true,
	transparent: true,
    sound: 'webcraft:block.grass',
	texture: function(world, lightmap, lit, x, y, z, dir) {return [23, 18];}
};

// Ствол берёзы
BLOCK.BIRCH_TRUNK = {
    id: 162,
    inventory_icon_id: 2237,
    spawnable: true,
    sound: 'webcraft:block.wood',
    tags: ['wood'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
            return [20, 17];
        else
            return [20, 16];
    }
};

// Ствол дуба
BLOCK.OAK_TRUNK = {
    id: 3,
    inventory_icon_id: 3429,
    spawnable: true,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.wood',
    tags: ['wood'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
            return [21, 17];
        else
            return [21, 16];
    }
};

// Ствол акации
BLOCK.ACACIA_TRUNK = {
    id: 165,
    inventory_icon_id: 3398,
    spawnable: true,
    sound: 'webcraft:block.wood',
    tags: ['wood'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
            return [22, 17];
        else
            return [22, 16];
    }
};

// Ствол ели
BLOCK.SPRUCE_TRUNK = {
	id: 138,
    inventory_icon_id: 3442,
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
    tags: ['wood'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
		if(dir == DIRECTION.UP || dir == DIRECTION.DOWN )
			return [23, 17];
		else
			return [23, 16];
	}
};

// Березовые доски
BLOCK.BIRCH_PLANK = {
	id: 456,
    inventory_icon_id: 858,
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
    tags: ['plank'],
	texture: function(world, lightmap, lit, x, y, z, dir) {return [20, 19];}
};

// Дубовые доски
BLOCK.OAK_PLANK = {
	id: 7,
    inventory_icon_id: 902,
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
    tags: ['plank'],
	texture: function(world, lightmap, lit, x, y, z, dir) {return [21, 19];}
};

// Доски акации
BLOCK.ACACIA_PLANK = {
	id: 457,
    inventory_icon_id: 895, // 853, 928
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
    tags: ['plank'],
	texture: function(world, lightmap, lit, x, y, z, dir) {return [22, 19];}
};

// Доски еловые
BLOCK.SPRUCE_PLANK = {
	id: 460,
    inventory_icon_id: 928,
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
    tags: ['plank'],
	texture: function(world, lightmap, lit, x, y, z, dir) {return [23, 19];}
};

// Bookcase
BLOCK.BOOKCASE = {
	id: 5,
    inventory_icon_id: 3239,
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [ 21, 19 ];
        } else {
            return [ 3, 2 ];
        }
	}
};

BLOCK.GLOWSTONE = {
    id:             89,
    inventory_icon_id: 3381, // 3381
    spawnable:      true,
    transparent:    true,
    light_power:    new Color(255, 235, 35, 255),
    sound: 			'webcraft:block.stone',
    tags:           ['stone'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 6];
    }
};

// Concrete
BLOCK.CONCRETE = {
    id: 9,
    inventory_icon_id: 232,
    spawnable: true,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.stone',
    tags: ['stone'],
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 1, 0 ]; }
};
BLOCK.CONCRETE_CYAN = {
    id: 504,
    inventory_icon_id: 1483,
    spawnable: true,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.stone',
    tags: ['stone'],
    texture: function(world, lightmap, lit, x, y, z, dir) {return [3, 17];}
};
BLOCK.CONCRETE_YELLOW = {
    id: 505,
    inventory_icon_id: 1519,
    spawnable: true,
    selflit: false,
    gravity: false,
    fluid: false,
    sound: 'webcraft:block.stone',
    tags: ['stone'],
    texture: function(world, lightmap, lit, x, y, z, dir) {return [7, 17];}
};

// Полированный камень
BLOCK.SMOOTH_STONE = {
	id: 70,
    inventory_icon_id: 906,
	spawnable: true,
	selflit: false,
	gravity: false,
	fluid: false,
    sound: 'webcraft:block.stone',
    tags: ['stone'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [6, 0]; }
};

// Brick
BLOCK.BRICK = {
	id: 10,
    inventory_icon_id: 869,
	spawnable: true,
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

// Iron
BLOCK.IRON = {
	id: 13,
	spawnable: true,
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
	selflit: false,
	gravity: false,
	fluid: false,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [ 7, 1 ]; }
};

BLOCK.GOLD_ORE = {
    id: 14,
    inventory_icon_id: 3393,
    spawnable: true,
    sound: 'webcraft:block.stone',
    texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 2]; }
};

// Diamond
BLOCK.DIAMOND = {
	id: 150,
    inventory_icon_id: 3391,
	spawnable: true,
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
    is_fluid: true,
    light_power: new Color(253, 200, 80, 255),
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
    passable: .4,
    selflit: true,
    is_fluid: true,
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 12];
    }
};

BLOCK.FLOWING_WATER = {
    id: 200,
    spawnable: true,
    passable: .4,
    transparent: true,
    selflit: true,
    is_fluid: true,
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
    is_fluid: true,
    fluid: {
        max_power: 1,
        still_block_id: BLOCK.STILL_LAVA.id
    },
    light_power: new Color(253, 200, 80, 255),
    texture: function(world, lightmap, lit, x, y, z, dir) { return [ 13, 14 ]; }
};

BLOCK.IRON_ORE = {
    id: 15,
    inventory_icon_id: 3394,
    spawnable: true,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 2]; }
};

BLOCK.COAL_ORE = {
    id: 16,
    // inventory_icon_id: 15,
    inventory_icon_id: 3390,
    spawnable: true,
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
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 10]; }
};

BLOCK.LAPIS_LAZULI = {
    id: 22,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 9]; }
};

BLOCK.DISPENSER = {
    id: 23,
    spawnable: true,
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
    sound: 'webcraft:block.gravel',
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.NOTE_BLOCK = {
    id: 25,
    inventory_icon_id: 3610,
    spawnable: true,
    texture: function(world, lightmap, lit, x, y, z, dir) { return [10, 4]; }
};

BLOCK.STICK = {
    id: 130,
    inventory_icon_id: 1139,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 18];
    }
};
BLOCK.WOOL_BLUE = {
    id: 351,
    inventory_icon_id: 714,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 18];
    }
};
BLOCK.WOOL_BROWN = {
    id: 352,
    inventory_icon_id: 729,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 18];
    }
};
BLOCK.WOOL_CYAN = {
    id: 353,
    inventory_icon_id: 726,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 18];
    }
};
BLOCK.WOOL_GRAY = {
    id: 354,
    inventory_icon_id: 229,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 18];
    }
};
BLOCK.WOOL_GREEN = {
    id: 355,
    inventory_icon_id: 738,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 18];
    }
};
BLOCK.WOOL_RED = {
    id: 502,
    inventory_icon_id: 1535,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [6, 18];
    }
};
BLOCK.WOOL_YELLOW = {
    id: 506,
    inventory_icon_id: 1537,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 18];
    }
};

// Терракота
BLOCK.TERRACOTTA_BLACK = {
    id: 450,
    inventory_icon_id: 729,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 19];
    }
};
BLOCK.TERRACOTTA_BLUE = {
    id: 451,
    inventory_icon_id: 711,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 19];
    }
};
BLOCK.TERRACOTTA_BROWN = {
    id: 452,
    inventory_icon_id: 717,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 19];
    }
};
BLOCK.TERRACOTTA_CYAN = {
    id: 453,
    inventory_icon_id: 723,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 19];
    }
};
BLOCK.TERRACOTTA_GRAY = {
    id: 454,
    inventory_icon_id: 729,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {return [4, 19];}
};
BLOCK.TERRACOTTA_GREEN = {
    id: 455,
    inventory_icon_id: 735,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {return [5, 19];}
};
BLOCK.TERRACOTTA_RED = {
    id: 503,
    inventory_icon_id: 1513,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {return [6, 19];}
};
BLOCK.TERRACOTTA_YELLOW = {
    id: 507,
    inventory_icon_id: 795,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {return [7, 19];}
};

// Цветы
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
BLOCK.FLOWER_ALLIUM = {
    id: 509,
    inventory_icon_id: 3400,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 22];
    }
};
BLOCK.FLOWER_BLUE_ORCHID = {
    id: 510,
    inventory_icon_id: 3406,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 22];
    }
};
BLOCK.FLOWER_OXEYE_DAISY = {
    id: 511,
    inventory_icon_id: 3432,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [2, 22];
    }
};
BLOCK.FLOWER_LILY_OF_THE_VALLEY = {
    id: 512,
    inventory_icon_id: 3401,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 22];
    }
};
BLOCK.FLOWER_CORNFLOWER = {
    id: 513,
    inventory_icon_id: 2388,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 22];
    }
};
BLOCK.FLOWER_PEONY_BOTTOM = {
    id: 514,
    inventory_icon_id: 3435,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 22];
    }
};
BLOCK.FLOWER_PEONY_TOP = {
    id: 515,
    inventory_icon_id: 3435,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [6, 22];
    }
};
BLOCK.FLOWER_LILAC_BOTTOM = {
    id: 516,
    inventory_icon_id: 3435,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 22];
    }
};
BLOCK.FLOWER_LILAC_TOP = {
    id: 517,
    inventory_icon_id: 3435,
    spawnable: true,
    passable: 1,
    transparent: true,
    style: 'planting',
    sound: 'webcraft:block.grass',
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 22];
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
    tags: ['slab'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [6, 0];
    }
};

BLOCK.MOSS_STONE = {
    id: 48,
    spawnable: true,
    sound: 'webcraft:block.stone',
    tags: ['stone'],
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
    light_power:     new Color(253, 241, 131, 180),
    style: 'torch',
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
	texture: function(world, lightmap, lit, x, y, z, dir) { return [7, 5]; }
};

BLOCK.FURNACE = {
    id: 61,
    inventory_icon_id: 3606,
    spawnable: true,
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

BLOCK.OAK_DOOR = {
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
    style: 'stairs',
    sound: 'webcraft:block.stone',
    tags: ['stairs'],
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

BLOCK.OAK_PLATE = {
    id: 72,
    spawnable: true,
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [21, 19];
	}
};

BLOCK.REDSTONE_ORE = {
    id: 73,
    spawnable: true,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [3, 3];
	}
};

BLOCK.GLOWING_REDSTONE_ORE = {
    id: 74,
    spawnable: true,
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
    light_power: new Color(253, 200, 131, 150),
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 4];
	}
};

BLOCK.SNOW = {
    id: 469,
    height: 1/16,
    inventory_icon_id: 3314,
    spawnable: true,
    transparent: true,
    passable: 1,
    texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [2, 4];
        } else {
            return [4, 7];
        }
    }
};

BLOCK.SNOW_BLOCK = {
    id: 80,
    inventory_icon_id: 3314,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP) {
            return [11, 4];
        } else {
            return [10, 4];
        }
    }
};

// Березовый забор
BLOCK.BIRCH_FENCE = {
    id: 189,
    inventory_icon_id: 3229,
    spawnable: true,
    transparent: true,
    style: 'fence',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [20, 19];
    }
};

// Дубовый забор
BLOCK.OAK_FENCE = {
    id: 85,
    inventory_icon_id: 3283,
    spawnable: true,
    transparent: true,
    style: 'fence',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [21, 19];
    }
};

// Акациевый забор
BLOCK.ACACIA_FENCE = {
    id: 188,
    inventory_icon_id: 3221,
    spawnable: true,
    transparent: true,
    style: 'fence',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [22, 19];
    }
};

// Еловый забор
BLOCK.SPRUCE_FENCE = {
    id: 191,
    inventory_icon_id: 3316,
    spawnable: true,
    transparent: true,
    style: 'fence',
    sound: 'webcraft:block.wood',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [23, 19];
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

// Березовый люк
BLOCK.BIRCH_TRAPDOOR = {
    id: 462,
    inventory_icon_id: 1647,
    spawnable: true,
    transparent: true,
    style: 'trapdoor',
    sound: 'webcraft:block.wooden_trapdoor',
    tags: ['trapdoor'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [20, 20];
        }  else if(dir == DIRECTION.LEFT || dir == DIRECTION.RIGHT) {
            return [20, 21];
        } else {
            return [20, 22];
        }
    }
};

// Дубовый люк
BLOCK.OAK_TRAPDOOR = {
    id: 463,
    inventory_icon_id: 957,
    spawnable: true,
    transparent: true,
    style: 'trapdoor',
    sound: 'webcraft:block.wooden_trapdoor',
    tags: ['trapdoor'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [21, 20];
        } else if(dir == DIRECTION.LEFT || dir == DIRECTION.RIGHT) {
            return [21, 21];
        } else {
            return [21, 22];
        }
    }
};

// Акациевый люк
BLOCK.ACACIA_TRAPDOOR = {
    id: 464,
    inventory_icon_id: 1649,
    spawnable: true,
    transparent: true,
    style: 'trapdoor',
    sound: 'webcraft:block.wooden_trapdoor',
    tags: ['trapdoor'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [22, 20];
        } else if(dir == DIRECTION.LEFT || dir == DIRECTION.RIGHT) {
            return [22, 21];
        } else {
            return [22, 22];
        }
    }
};

// Еловый люк
BLOCK.SPRUCE_TRAPDOOR = {
    id: 465,
    inventory_icon_id: 1646,
    spawnable: true,
    transparent: true,
    style: 'trapdoor',
    sound: 'webcraft:block.wooden_trapdoor',
    tags: ['trapdoor'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        if (dir == DIRECTION.UP || dir == DIRECTION.DOWN) {
            return [23, 20];
        }  else if(dir == DIRECTION.LEFT || dir == DIRECTION.RIGHT) {
            return [23, 21];
        } else {
            return [23, 22];
        }
    }
};

// 190...192

BLOCK.PUMPKIN = {
    id: 86,
    inventory_icon_id: 3436,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 6];
    }
};

BLOCK.SOUL_SAND = {
    id: 88,
    spawnable: true,
    gravity: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [8, 6];
    }
};

BLOCK.LIT_PUMPKIN = {
    id: 91,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 6];
    }
};

BLOCK.STONE_BRICK = {
    id: 98,
    inventory_icon_id: 3379,
    spawnable: true,
    sound: 'webcraft:block.stone',
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [6, 3];
    }
};

BLOCK.BROWN_MUSHROOM_BLOCK = {
    id: 99,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [14, 7];
    }
};

BLOCK.RED_MUSHROOM_BLOCK = {
    id: 100,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [13, 7];
    }
};

BLOCK.GLASS_PANE = {
    id: 102,
    inventory_icon_id: 3261,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 3]; }
};

// Облако
BLOCK.CLOUD = {
    id: 508,
    inventory_icon_id: 866,
    spawnable: true,
    transparent: true,
    passable: 1,
    selflit: true,
    sound: 'webcraft:block.wood',
    tags: ['alpha'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [22, 31];
    }
};

// STAINED_GLASS
BLOCK.BLUE_STAINED_GLASS = {
    id: 470,
    inventory_icon_id: 713,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [1, 20]; }
};
BLOCK.BLACK_STAINED_GLASS = {
    id: 471,
    inventory_icon_id: 731,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 20]; }
};
BLOCK.PINK_STAINED_GLASS = {
    id: 472,
    inventory_icon_id: 773,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [2, 20]; }
};
BLOCK.RED_STAINED_GLASS = {
    id: 473,
    inventory_icon_id: 785,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [3, 20]; }
};
BLOCK.WHITE_STAINED_GLASS = {
    id: 474,
    inventory_icon_id: 791,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [4, 20]; }
};
BLOCK.YELLOW_STAINED_GLASS = {
    id: 475,
    inventory_icon_id: 797,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [5, 20]; }
};
BLOCK.GREEN_STAINED_GLASS = {
    id: 476,
    inventory_icon_id: 737,
    spawnable: true,
    transparent: true,
    style: 'pane',
    sound: 'webcraft:block.glass',
    tags: ['glass'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [6, 20]; }
};

//
BLOCK.MELON = {
    id: 103,
    spawnable: true,
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

BLOCK.BRICK_STAIRS = {
    id: 108,
    inventory_icon_id: 3241,
    spawnable: true,
    style: 'stairs',
    sound: 'webcraft:block.stone',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [7, 0]; }
};

BLOCK.STONE_STAIRS = {
    id: 109,
    inventory_icon_id: 3324,
    spawnable: true,
    style: 'stairs',
    sound: 'webcraft:block.stone',
    tags: ['stairs'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [1, 0];
    }
};

BLOCK.MYCELIUM = {
    id: 110,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 6];
    }
};

BLOCK.NETHER_STAIRS = {
    id: 114,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 10];
    }
};

BLOCK.DOUBLE_SLAB2 = {
    id: 125,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 0];
    }
};

BLOCK.BRICK_SLAB = {
    id: 501,
    inventory_icon_id: 3240,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.stone',
    tags: ['slab'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 0];
    }
};

BLOCK.OAK_SLAB = {
    id: 126,
    inventory_icon_id: 3284,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.wood',
    tags: ['slab'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [21, 19];
    }
};

BLOCK.BIRCH_SLAB = {
    id: 458,
    inventory_icon_id: 3230,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.wood',
    tags: ['slab'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [20, 19];
    }
};

BLOCK.ACACIA_SLAB = {
    id: 459,
    inventory_icon_id: 3268,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.wood',
    tags: ['slab'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [22, 19];
    }
};

BLOCK.SPRUCE_SLAB = {
    id: 461,
    inventory_icon_id: 3317,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.wood',
    tags: ['slab'],
    texture: function(world, lightmap, lit, x, y, z, dir) {
        return [23, 19];
    }
};

BLOCK.g = {
    id: 127,
    inventory_icon_id: 3240,
    spawnable: true,
    transparent: true,
    style: 'slab',
    sound: 'webcraft:block.stone',
    tags: ['slab'],
	texture: function(world, lightmap, lit, x, y, z, dir) {return [7, 0];}
};

BLOCK.SANDSTONE_STAIRS = {
    id: 128,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.EMERALD_ORE = {
    id: 129,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 11];
    }
};

BLOCK.EMERALD = {
    id: 133,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 12];
    }
};

BLOCK.BIRCH_STAIRS = {
    id: 135,
    inventory_icon_id: 3231,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [20, 19];
	}
};

BLOCK.OAK_STAIRS = {
    id: 53,
    inventory_icon_id: 3285,
    spawnable: true,
    style: 'stairs',
    sound: 'webcraft:block.wood',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [21, 19];
	}
};

BLOCK.ACACIA_STAIRS = {
    id: 163,
    inventory_icon_id: 3223,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [22, 19];
    }
};

BLOCK.SPRUCE_STAIRS = {
    id: 134,
    inventory_icon_id: 3318,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [23, 19];
	}
};

BLOCK.JUNGLE_STAIRS = {
    id: 136,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
		return [23, 19];
	}
};

BLOCK.COBBLESTONE_WALL = {
    id: 139,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [9, 13];
    }
};

BLOCK.QUARTZ = {
    id: 155,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 13];
    }
};

BLOCK.QUARTZ_STAIRS = {
    id: 156,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 13];
    }
};

BLOCK.DROPPER = {
    id: 158,
    spawnable: true,
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


BLOCK.DARK_OAK_STAIRS = {
    id: 164,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [4, 7];
    }
};

BLOCK.PRISMARINE = {
    id: 168,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 14];
    }
};

BLOCK.SEA_LANTERN = {
    id: 169,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 4];
    }
};

BLOCK.HARDENED_CLAY2 = {
    id: 172,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 1];
    }
};

BLOCK.COAL = {
    id: 173,
    inventory_icon_id: 1118,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [5, 2];
    }
};

BLOCK.ICE2 = {
    id: 174,
    spawnable: true,
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
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.RED_SANDSTONE_STAIRS = {
    id: 180,
    spawnable: true,
    style: 'stairs',
    tags: ['stairs'],
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.DOUBLE_RED_SANDSTONE_SLAB = {
    id: 181,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) { return [0, 12]; }
};

BLOCK.RED_SANDSTONE_SLAB = {
    id: 182,
    spawnable: true,
    transparent: true,
    sound: 'webcraft:block.stone',
    tags: ['slab'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [0, 12];
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
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [15, 10];
    }
};

BLOCK.ICE3 = {
    id: 212,
    spawnable: true,
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [3, 4];
	}
};

BLOCK.BRICK_TRIANGLE = {
    id: 518,
    spawnable: true,
    style: 'triangle',
    sound: 'webcraft:block.stone',
    tags: ['triangle'],
	texture: function(world, lightmap, lit, x, y, z, dir) {
        return [7, 0];
    }
};

// Run getAll()
BLOCK.getAll();

BLOCK.BLOCK_BY_ID = {};
BLOCK.BLOCK_BY_TAGS = {};
for(let key of Object.keys(BLOCK)) {
    let block = BLOCK[key];
    if(typeof(block) == 'object' && ('spawnable' in block)) {
        BLOCK.BLOCK_BY_ID[block.id] = block;
        if(block.hasOwnProperty('tags')) {
            for(let tag of block.tags) {
                if(!BLOCK.BLOCK_BY_TAGS.hasOwnProperty(tag)) {
                    BLOCK.BLOCK_BY_TAGS[tag] = [];
                }
                BLOCK.BLOCK_BY_TAGS[tag].push(block);
            }
        }
    }
}