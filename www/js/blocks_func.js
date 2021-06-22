var BLOCK_BY_ID = {};
for(const [key, block] of Object.entries(BLOCK)) {
    if(typeof(block) == 'object' && block.hasOwnProperty('spawnable')) {
        BLOCK_BY_ID[block.id] = block;
    }
}

var ROTATE = {};
ROTATE.S = 1; // BACK
ROTATE.W = 2; // LEFT
ROTATE.N = 3; // FRONT
ROTATE.E = 4; // RIGHT

// getCardinalDirection...
BLOCK.getCardinalDirection = function(vec3) {
    var result = new Vector(0, ROTATE.E, 0);
    if(vec3) {
        if(vec3.y >= 45 && vec3.y < 135) {
            // do nothing
        } else if(vec3.y >= 135 && vec3.y < 225) {
            result.y = ROTATE.S;
        } else if(vec3.y >= 225 && vec3.y < 315) {
            result.y = ROTATE.W;
        } else {
            result.y = ROTATE.N;
        }
    }
    return result;
}
        
// Returns a block structure for the given id.
BLOCK.fromId = function(id) {
    if(BLOCK_BY_ID.hasOwnProperty(id)) {
        return BLOCK_BY_ID[id]
    }
    console.error('Warning: id missing in BLOCK ' + id);
    return BLOCK.DUMMY;
}
        
// Returns a block structure for the given id.
BLOCK.fromName = function(name) {
    if(name.indexOf(':') >= 0) {
        name = name.split(':')[1].toUpperCase();
    }
    if(BLOCK.hasOwnProperty(name)) {
        return BLOCK[name]
    }
    console.error('Warning: name missing in BLOCK ' + name);
	return BLOCK.DUMMY;
}

// Return plants for terrain generator
BLOCK.getPlants = function() {
    return [
        BLOCK.GRASS,
        BLOCK.DANDELION,
        // BLOCK.POPPY,
        BLOCK.TULIP,
        BLOCK.BROWN_MUSHROOM,
        BLOCK.RED_MUSHROOM
    ];
}

// Возвращает True если блок является растением
BLOCK.isPlants = function(id) {
    for(var p of this.getPlants()) {
        if(p.id == id) {
            return true;
        }
    }
    return false;
}

// Блок может быть уничтожен водой
BLOCK.destroyableByWater = function(block) {
    return block.planting || block.id == BLOCK.AIR.id;
}

// Стартовый игровой инвентарь
BLOCK.getStartInventory = function() {
    var blocks = [
        Object.assign({count: 5}, BLOCK.RED_MUSHROOM),
        Object.assign({count: 64}, BLOCK.SAND),
        Object.assign({count: 6}, BLOCK.BOOKCASE),
        Object.assign({count: 20}, BLOCK.GLOWSTONE),
        Object.assign({count: 4}, BLOCK.TEST)
    ];
    for(const [key, b] of Object.entries(blocks)) {
        delete(b.texture);
        blocks[key] = b;
    }
    return blocks;
}

// getAll
BLOCK.getAll = function() {
    if(this.list) {
        return this.list;
    }
    var list = this.list = [];
    var id_list = [];
    for(var mat in BLOCK) {
        var B = BLOCK[mat];
        B.power = 1;
        if(typeof(B) == 'object') {
            if(id_list.indexOf(B.id) >= 0)  {
                console.error('Duplicate block id ', B.id, B);
            }
            id_list.push(B.id);
            B.name = mat;
            if(!B.light) {
                B.light = null;
            }
            if(B.spawnable == true) {
                if(B.style && B.style == 'fence') {
                    continue;
                }
                if(B.style && B.style == 'planting') {
                    B.planting = true;
                }
                if(B.style && B.style == 'stairs') {
                    B.transparent = true;
                }
                if([18, 118, 152, 203, 159, 160, 74, 26, 133, 102, 168, 121, 169, 172, 193, 63, 64, 65, 71, 81, 83, 120, 146, 54, 194, 195, 196, 197, 115, 103, 116, 179, 180, 181, 182, 206].indexOf(B.id) >= 0) {
                    continue;
                }
                list.push(B);
            }
        }
    }
    return list;
}

// Run getAll()
BLOCK.getAll();

// Возвращает координаты текстуры
function calcTexture(c) {
    return [
        c[0] / TX_CNT,
        c[1] / TX_CNT,
        (c[0] + 1) / TX_CNT,
        (c[1] + 1) / TX_CNT,
    ];
}

// Pushes the vertices necessary for rendering a
// specific block into the array.
function push_cube(block, vertices, world, lightmap, x, y, z) {

    if(typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
        return;
    }
    
    var DIRECTION_UP        = DIRECTION.UP;
    var DIRECTION_DOWN      = DIRECTION.DOWN;
    var DIRECTION_BACK      = DIRECTION.BACK;
    var DIRECTION_RIGHT     = DIRECTION.RIGHT;
    var DIRECTION_FORWARD   = DIRECTION.FORWARD;
    var DIRECTION_LEFT      = DIRECTION.LEFT;

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).y;
    
    // F R B L
    switch(cardinal_direction) {
        case ROTATE.S: {
            break;
        }
        case ROTATE.W: {
            DIRECTION_BACK      = DIRECTION.LEFT;
            DIRECTION_RIGHT     = DIRECTION.BACK;
            DIRECTION_FORWARD   = DIRECTION.RIGHT;
            DIRECTION_LEFT      = DIRECTION.FORWARD;
            break;
        }
        case ROTATE.N: {
            DIRECTION_BACK      = DIRECTION.FORWARD;
            DIRECTION_RIGHT     = DIRECTION.LEFT;
            DIRECTION_FORWARD   = DIRECTION.BACK;
            DIRECTION_LEFT      = DIRECTION.RIGHT;
            break;
        }
        case ROTATE.E: {
            DIRECTION_BACK      = DIRECTION.RIGHT;
            DIRECTION_RIGHT     = DIRECTION.FORWARD;
            DIRECTION_FORWARD   = DIRECTION.LEFT;
            DIRECTION_LEFT      = DIRECTION.BACK;
            break;
        }
    }

    var texture    = BLOCK[block.name].texture;
    var blockLight = block.light ? block.light.toFloat() : null;
    var blockLit   = z >= lightmap[x][y];

    // Can change height
    var bH         = 1.0;
    if(block.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(block.id) >= 0) {
        bH = Math.min(block.power, .9)
        var blockOver  = world.chunkManager.getBlock(x, y, z + 1);
        var blockOverIsFluid = (blockOver.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(blockOver.id) >= 0);
        if(blockOverIsFluid) {
            bH = 1.0;
        }
    }

    var width = 1 - (1 - (block.width ? block.width : 1)) / 2;
    var height = 1 - (1 - (block.height ? block.height : 1)) / 2;
    
    var drawAllSides = width != 1 || height != 1;

    // Top
    if(drawAllSides || world.chunkManager.getBlock(x, y, z + 1).transparent || block.fluid) {
        var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_UP));
        var lm = new Color(0, 0, 0, 4);
        pushQuad(
            vertices,
            [x, y,              z + bH - 1 + height, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0, y,        z + bH - 1 + height, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0, y + 1.0,  z + bH - 1 + height, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x, y + 1.0,        z + bH - 1 + height, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

    // Waters
    if([200, 202].indexOf(block.id) >= 0) {
        return;
    }

    // Bottom
    if(drawAllSides || world.chunkManager.getBlock(x, y, z - 1).transparent) {
        var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_DOWN));
        var lm = new Color(0, 0, 0, 3);
        pushQuad(
            vertices,                            
            [x, y + 1.0, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0, y + 1.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0, y, z, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x, y, z, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

    // Front
    if(drawAllSides || world.chunkManager.getBlock(x, y - 1, z).transparent) {
        var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
        var lm = new Color(0, 0, 0, 1);
        pushQuad(
            vertices,
            [x, y + 1 - width, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1, y + 1 - width, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1, y + 1 - width, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x, y + 1 - width, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

    // Back
    if(drawAllSides || world.chunkManager.getBlock(x, y + 1, z).transparent) {
        var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_BACK));
        var lm = new Color(0, 0, 0, 2);
        pushQuad(
            vertices,
            [x, y + 1.0 - 1 + width, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0, y + 1.0 - 1 + width, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0, y + 1.0 - 1 + width, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x, y + 1.0 - 1 + width, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

    // Left
    if(drawAllSides || world.chunkManager.getBlock(x - 1, y, z).transparent) {
        var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_LEFT));
        var lm = new Color(0, 0, 0, 5);
        pushQuad(
            vertices,
            [x + 1 - width, y, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1 - width, y + 1.0, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1 - width, y + 1.0, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1 - width, y, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

    // Right
    if(drawAllSides || world.chunkManager.getBlock(x + 1, y, z).transparent) {
        var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_RIGHT));
        var lm = new Color(0, 0, 0, 6);
        pushQuad(
            vertices,
            [x + 1.0 - 1 + width, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0 - 1 + width, y + 1.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0 - 1 + width, y + 1.0, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [x + 1.0 - 1 + width, y, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

}

// Pushes the vertices necessary for rendering a
// specific block into the array.
function push_ladder(block, vertices, world, lightmap, x, y, z) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).y;

    var texture     = BLOCK[block.name].texture;
    var blockLit    = z >= lightmap[x][y];
    var bH          = 1.0;
    var width       = block.width ? block.width : 1;
    var lm          = new Color(0, 0, 0, 1);
    var c           = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.S: {
            // Front
            pushQuad(
                vertices,
                [x, y + 1 - width, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1, y + 1 - width, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1, y + 1 - width, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + 1 - width, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            );
            break;
        }
        case ROTATE.W: {
            // Left
            pushQuad(
                vertices,
                [x + 1 - width, y, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1 - width, y + 1.0, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1 - width, y + 1.0, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1 - width, y, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            );
            break;
        }
        case ROTATE.N: {
            // Back
            pushQuad(
                vertices,
                [x, y + width, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1.0, y + width, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1.0, y + width, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + width, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            );
            break;
        }
        case ROTATE.E: {
            // Right
            pushQuad(
                vertices,
                [x + 1.0 - 1 + width, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1.0 - 1 + width, y + 1.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1.0 - 1 + width, y + 1.0, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 1.0 - 1 + width, y, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            );
            break;
        }
    }

}

// check_xy_neighbor
function check_xy_neighbor(world, x, y, z) {
    var block = world.chunkManager.getBlock(x, y, z);
    var x_dir = 0;
    var y_dir = 0;
    // first decide x or y direction
    var b = world.chunkManager.getBlock(x - 1, y, z);
    if (x == 0
        || (b.id != 0 && !b.style)
        || b.style == block.style)
        x_dir ++;
    //
    b = world.chunkManager.getBlock(x + 1, y, z);
    //
    b = world.chunkManager.getBlock(x, y - 1, z);
    if (y == 0
        || (b.id != 0 && !b.style)
        || b.style == block.style)
        y_dir ++;
    b = world.chunkManager.getBlock(x, y + 1, z);
    /*
    if (y == world.sy - 1
        || (b.id != 0 && !b.style)
        || b.style == block.style)
        y_dir ++;
    */
    return [x_dir, y_dir];
}

/**
* Build up to <count> dirty chunks.
*/
function pushQuad(v, p1, p2, p3, p4) {
    v.push(p1[0], p1[1], p1[2], p1[3], p1[4], p1[5], p1[6], p1[7], p1[8], p1[9], p1[10], p1[11]);
    v.push(p2[0], p2[1], p2[2], p2[3], p2[4], p2[5], p2[6], p2[7], p2[8], p2[9], p2[10], p2[11]);
    v.push(p3[0], p3[1], p3[2], p3[3], p3[4], p3[5], p3[6], p3[7], p3[8], p3[9], p3[10], p3[11]);
    
    v.push(p3[0], p3[1], p3[2], p3[3], p3[4], p3[5], p3[6], p3[7], p3[8], p3[9], p3[10], p3[11]);
    v.push(p4[0], p4[1], p4[2], p4[3], p4[4], p4[5], p4[6], p4[7], p4[8], p4[9], p4[10], p4[11]);
    v.push(p1[0], p1[1], p1[2], p1[3], p1[4], p1[5], p1[6], p1[7], p1[8], p1[9], p1[10], p1[11]);
}

// push_plane
function push_plane(vertices, x, y, z, c, lm, x_dir, rot, xp, yp, zp) {

    xp          = xp ? xp : 1; // rot ? 1.41 : 1.0;
    yp          = yp ? yp : 1; // rot ? 1.41 : 1.0;
    zp          = zp ? zp : 1; // rot ? 1.41 : 1.0;
    var mn      = 0.15;
    var quads   = [];

    if (x_dir) {
        if(rot) {
            quads.push([
                [x, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
            quads.push([
                [x + xp, y, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + yp, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + yp, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
        } else {
            quads.push([
                [x, y + 0.5, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y + 0.5, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y + 0.5, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + 0.5, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
            quads.push([
                [x + xp, y + 0.5, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + 0.5, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x, y + 0.5, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y + 0.5, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
        }
    } else {
        if(rot) {
            quads.push([
                [x + xp, y + yp, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0, y + 0.0, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0, y + 0.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y + yp, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
            quads.push([
                [x + 0, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + xp, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
        } else {
            quads.push([
                [x + 0.5, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0.5, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0.5, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0.5, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
            quads.push([
                [x + 0.5, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0.5, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0.5, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
                [x + 0.5, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
            ]);
        }
    }
    
    for(var quad of quads) {
        pushQuad(vertices, quad[0], quad[1], quad[2], quad[3]);
    }
    
}

// Растения
function push_plant(block, vertices, world, lightmap, x, y, z) {
    // var block       = world.chunkManager.getBlock(x, y, z);
    var texture     = BLOCK.fromId(block.id).texture;
    var blockLit    = z >= lightmap[x][y];
    var blockLight = block.light ? block.light.toFloat() : null;
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    /*
    var lightMultiplier = z >= lightmap[x][y] ? 1.0 : 0.6;
    var lm = new Color(
        lightMultiplier,
        lightMultiplier,
        lightMultiplier,
        lightMultiplier
    );
    if(blockLight) {
        lm.a += blockLight.a;
    }
    */
    var lm = new Color(0, 0, 0, 0);
    if(block.id == BLOCK.GRASS.id) {
        z -= .15;
    }
    push_plane(vertices, x, y, z, c, lm, true, true);
    push_plane(vertices, x, y, z, c, lm, false, true);
}

/*
// Плоскость
function push_pane(block, vertices, world, lightmap, x, y, z) {
    // var block = world.chunkManager.getBlock(x, y, z);
    var texture = BLOCK.fromId(block.id).texture;
	var blockLit = z >= lightmap[x][y];
    var blockLight = block.light ? block.light.toFloat() : null;
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    var lightMultiplier = z >= lightmap[x][y] ? 1.0 : 0.6;
    var lm = new Color(
        lightMultiplier,
        lightMultiplier,
        lightMultiplier,
        lightMultiplier
    );
    if(blockLight) {
        lm.a += blockLight.a;
    }
    var dirs = check_xy_neighbor(world, x, y, z);
    push_plane(vertices, x, y, z, c, lm, dirs[0] >= dirs[1], false);
}
*/

// Ворота
function push_fence(block, vertices, world, lightmap, x, y, z) {
    // var block = world.chunkManager.getBlock(x, y, z);
    var texture = BLOCK.fromId(block.id).texture;
    var blockLit = z >= lightmap[x][y];
    var blockLight = block.light ? block.light.toFloat() : null;
    block.transparent = true;
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    /*
    var lightMultiplier = z >= lightmap[x][y] ? 1.0 : 0.6;
    var lm = new Color(
        lightMultiplier,
        lightMultiplier,
        lightMultiplier,
        lightMultiplier
    );
    if(blockLight) {
        lm.a += blockLight.a;
    }
    */
    var lm = new Color(0, 0, 0, 0);
    var dirs = check_xy_neighbor(world, x, y, z);
    if (dirs[0] * dirs[1] == 0 && dirs[0] + dirs[1] > 0) {
        push_plane(vertices, x, y, z, c, lm, dirs[0] > dirs[1], false);
    } else {
        push_plant(block, vertices, world, lightmap, x, y, z);
    }
}

// Ступеньки
function push_stairs(block, vertices, world, lightmap, x, y, z) {

    const half = 0.5 / TX_CNT;
    
    // var block = world.chunkManager.getBlock(x, y, z);
    var texture = BLOCK.fromId(block.id).texture;
    var blockLit = z >= lightmap[x][y];
    var blockLight = block.light ? block.light.toFloat() : null;
    block.transparent = true;
    // полная текстура
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    // четверть текстуры
    var c_half = [
        c[0],
        c[1],
        c[2] - half,
        c[3] - half,
    ];
    // верхняя половина текстуры
    var c_half_top = [
        c[0],
        c[1],
        c[2] - half,
        c[3],
    ];
    // нижняя половина текстуры
    var c_half_bottom= [
        c[0],
        c[1] + half,
        c[2],
        c[3],
    ];
    var lightMultiplier = z >= lightmap[x][y] ? 1.0 : 0.6;
    
    var dirs = check_xy_neighbor(world, x, y, z);
    /*
    var lm = new Color(
        lightMultiplier,
        lightMultiplier,
        lightMultiplier,
        lightMultiplier
    );
    if(blockLight) {
        lm.a += blockLight.a;
    }
    */

    // правая стенка (нижней ступени)
    var lm = new Color(0, 0, 0, 6);
    push_plane(vertices, x, y - 0.5, z, c_half_bottom, lm, true, false, null, null, .5);
    // левая стенка (нижней ступени)
    lm = new Color(0, 0, 0, 5);
    push_plane(vertices, x, y + 0.5, z, c_half_bottom, lm, true, false, null, null, .5);

    // задняя стенка
    lm = new Color(0, 0, 0, 2);
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, false, false, null, null, .5);
    // передняя стенка нижней ступени
    lm = new Color(0, 0, 0, 1);
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, false, false, null, null, .5);

    c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));    

    // дно
    lm = new Color(0, 0, 0, 3);
    pushQuad(
        vertices,                            
        [ x, y + 1.0, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y + 1.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y, z, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x, y, z, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
    );

    // поверхность нижней ступени
    bH = 0.5;
    lm = new Color(0, 0, 0, 4);
    pushQuad(
        vertices,
        [ x, y, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y + 1.0, z + bH, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x, y + 1.0, z + bH, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
    );

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).y;
    
    // F R B L
    switch(cardinal_direction) {
        case ROTATE.S: {
            var poses = [
                new Vector(0, .5, 0),
                new Vector(-.5, .5, 0),
            ];
            break;
        }
        case ROTATE.W: {
            var poses = [
                new Vector(0, 0, 0),
                new Vector(0, .5, 0),
            ];
            break;
        }
        case ROTATE.N: {
            var poses = [
                new Vector(0, 0, 0),
                new Vector(-.5, 0, 0),
            ];
            break;
        }
        case ROTATE.E: {
            var poses = [
                new Vector(-.5, 0, 0),
                new Vector(-.5, .5, 0),
            ];
            break;
        }
    }

    // Верхняя ступень
    for(var pose of poses) {
        // задняя стенка
        lm = new Color(0, 0, 0, 2);
        push_plane(vertices, x + 0.5 + pose.x, y + pose.y, z + .5, c_half, lm, false, false, null, .5, .5);
        // правая стенка
        lm = new Color(0, 0, 0, 6);
        push_plane(vertices, x + 0.5 + pose.x, y - 0.5 + pose.y, z + 0.5, c_half, lm, true, false, .5, null, .5);
        // левая стенка
        lm = new Color(0, 0, 0, 5);
        push_plane(vertices, x + 0.5 + pose.x, y + pose.y, z + 0.5, c_half, lm, true, false, .5, null, .5);
        // передняя стенка
        lm = new Color(0, 0, 0, 1);
        push_plane(vertices, x + pose.x, y + pose.y, z + .5, c_half, lm, false, false, null, .5, .5);
        // поверхность
        lm = new Color(0, 0, 0, 4);
        var bH = 1.0;
        pushQuad(
            vertices,
            [ x + 0.5 + pose.x,  y + pose.y,       z + bH, c_half[0], c_half[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [ x + 1 + pose.x,    y + pose.y,       z + bH, c_half[2], c_half[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [ x + 1 + pose.x,    y + 0.5 + pose.y, z + bH, c_half[2], c_half[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
            [ x + 0.5 + pose.x,  y + 0.5 + pose.y, z + bH, c_half[0], c_half[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
        );
    }

}
// Плита
function push_slab(block, vertices, world, lightmap, x, y, z) {

    const half = 0.5 / TX_CNT;
    
    // var block = world.chunkManager.getBlock(x, y, z);
    var texture = BLOCK.fromId(block.id).texture;
	var blockLit = z >= lightmap[x][y];
    var blockLight = block.light ? block.light.toFloat() : null;
    block.transparent = true;
    // полная текстура
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    // четверть текстуры
    var c_half = [
        c[0],
        c[1],
        c[2] - half,
        c[3] - half,
    ];
    // верхняя половина текстуры
    var c_half_top = [
        c[0],
        c[1],
        c[2] - half,
        c[3],
    ];
    // нижняя половина текстуры
    var c_half_bottom= [
        c[0],
        c[1] + half,
        c[2],
        c[3],
    ];
    var lightMultiplier = z >= lightmap[x][y] ? 1.0 : 0.6;
    
    var dirs = check_xy_neighbor(world, x, y, z);
    var lm = new Color(
        lightMultiplier,
        lightMultiplier,
        lightMultiplier,
        lightMultiplier
    );
    if(blockLight) {
        lm.a += blockLight.a;
    }

    // правая стенка (нижней ступени)
    push_plane(vertices, x, y - 0.5, z, c_half_bottom, lm, true, false, null, null, .5);
    // левая стенка (нижней ступени)
    push_plane(vertices, x, y + 0.5, z, c_half_bottom, lm, true, false, null, null, .5);

    // задняя стенка
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, false, false, null, null, .5);
    // передняя стенка нижней ступени
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, false, false, null, null, .5);

    c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));    

    // дно    
    pushQuad(
        vertices,                            
        [ x, y + 1.0, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y + 1.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y, z, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x, y, z, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
    );

    // поверхность нижней ступени
    bH = 0.5;
    pushQuad(
        vertices,
        [ x, y, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x + 1.0, y + 1.0, z + bH, c[2], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0],
        [ x, y + 1.0, z + bH, c[0], c[3], lm.r, lm.g, lm.b, lm.a, 0, 0, 0]
    );

}

// pushVertices
BLOCK.pushVertices = function(vertices, block, world, lightmap, x, y, z) {
    const style = 'style' in block ? block.style : '';
    if (['planting', 'torch', 'sign'].indexOf(style) >= 0) {
        push_plant(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'pane') {
        throw 'Unsupported style';
        // push_pane(vertices, world, lightmap, x, y, z);
    } else if (style == 'stairs') {
        push_stairs(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'slab') {
        push_slab(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'ladder') {
        push_ladder(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'fence') {
        push_fence(block, vertices, world, lightmap, x, y, z);
    } else {
        push_cube(block, vertices, world, lightmap, x, y, z);
    }
}

// Pushes vertices with the data needed for picking.
BLOCK.pushPickingVertices = function(vertices, x, y, z, pos) {

	var color = {r: pos.x / 255, g: pos.y / 255, b: pos.z / 255};

	// Top
	pushQuad(
		vertices,
		[ x, y, z + 1, 0, 0, color.r, color.g, color.b, 1/255, 0, 0, 0],
		[ x + 1, y, z + 1, 1, 0, color.r, color.g, color.b, 1/255, 0, 0, 0],
		[ x + 1, y + 1, z + 1, 1, 1, color.r, color.g, color.b, 1/255, 0, 0, 0],
		[ x, y + 1, z + 1, 0, 0, color.r, color.g, color.b, 1/255, 0, 0, 0]
	);
	
	// Bottom
	pushQuad(
		vertices,
		[ x, y + 1, z, 0, 0, color.r, color.g, color.b, 2/255, 0, 0, 0],
		[ x + 1, y + 1, z, 1, 0, color.r, color.g, color.b, 2/255, 0, 0, 0],
		[ x + 1, y, z, 1, 1, color.r, color.g, color.b, 2/255, 0, 0, 0],
		[ x, y, z, 0, 0, color.r, color.g, color.b, 2/255, 0, 0, 0]
	);
	
	// Front
	pushQuad(
		vertices,
		[ x, y, z, 0, 0, color.r, color.g, color.b, 3/255, 0, 0, 0],
		[ x + 1, y, z, 1, 0, color.r, color.g, color.b, 3/255, 0, 0, 0],
		[ x + 1, y, z + 1, 1, 1, color.r, color.g, color.b, 3/255, 0, 0, 0],
		[ x, y, z + 1, 0, 0, color.r, color.g, color.b, 3/255, 0, 0, 0]
	);
	
	// Back
	pushQuad(
		vertices,
		[ x, y + 1, z + 1, 0, 0, color.r, color.g, color.b, 4/255, 0, 0, 0],
		[ x + 1, y + 1, z + 1, 1, 0, color.r, color.g, color.b, 4/255, 0, 0, 0],
		[ x + 1, y + 1, z, 1, 1, color.r, color.g, color.b, 4/255, 0, 0, 0],
		[ x, y + 1, z, 0, 0, color.r, color.g, color.b, 4/255, 0, 0, 0]
	);
	
	// Left
	pushQuad(
		vertices,
		[ x, y, z + 1, 0, 0, color.r, color.g, color.b, 5/255, 0, 0, 0],
		[ x, y + 1, z + 1, 1, 0, color.r, color.g, color.b, 5/255, 0, 0, 0],
		[ x, y + 1, z, 1, 1, color.r, color.g, color.b, 5/255, 0, 0, 0],
		[ x, y, z, 0, 0, color.r, color.g, color.b, 5/255, 0, 0, 0]
	);
	
	// Right
	pushQuad(
		vertices,
		[ x + 1, y, z, 0, 0, color.r, color.g, color.b, 6/255, 0, 0, 0],
		[ x + 1, y + 1, z, 1, 0, color.r, color.g, color.b, 6/255, 0, 0, 0],
		[ x + 1, y + 1, z + 1, 1, 1, color.r, color.g, color.b, 6/255, 0, 0, 0],
		[ x + 1, y, z + 1, 0, 0, color.r, color.g, color.b, 6/255, 0, 0, 0]
	);

}

class Vector4 {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}

BLOCK.getInventoryIconPos = function(inventory_icon_id) {
    var w = 32;
    var h = 32;
    return new Vector4(
        (inventory_icon_id % w) * w,
        Math.floor(inventory_icon_id / h) * h,
        w,
        h
    );
}

// Export to node.js
if (typeof(exports) != 'undefined') {
	exports.BLOCK = BLOCK;
}