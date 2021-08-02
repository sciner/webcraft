var BLOCK_BY_ID = {};
for(const [key, block] of Object.entries(BLOCK)) {
    if(typeof(block) == 'object' && ('spawnable' in block)) {
        BLOCK_BY_ID[block.id] = block;
    }
}

var MULTIPLY = {
    COLOR: {
        WHITE: new Color(816 / 1024, 1008 / 1024, 0, 0),
        GRASS: new Color(900 / 1024, 965 / 1024, 0, 0)
    }
};

var NORMALS = {};
NORMALS.FORWARD          = new Vector(0, 0, 1);
NORMALS.BACK             = new Vector(0, 0, -1);
NORMALS.LEFT             = new Vector(-1, 0, 0);
NORMALS.RIGHT            = new Vector(1, 0, 0);
NORMALS.UP               = new Vector(0, 1, 0);
NORMALS.DOWN             = new Vector(0, -1, 0);

var ROTATE = {};
ROTATE.S = 1; // BACK
ROTATE.W = 2; // LEFT
ROTATE.N = 3; // FRONT
ROTATE.E = 4; // RIGHT

// getCardinalDirection...
BLOCK.getCardinalDirection = function(vec3) {
    var result = new Vector(0, 0, ROTATE.E);
    if(vec3) {
        if(vec3.z >= 45 && vec3.z < 135) {
            // do nothing
        } else if(vec3.z >= 135 && vec3.z < 225) {
            result.z = ROTATE.S;
        } else if(vec3.z >= 225 && vec3.z < 315) {
            result.z = ROTATE.W;
        } else {
            result.z = ROTATE.N;
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
function push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome) {

    if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
        return;
    }

    const cardinal_direction    = BLOCK.getCardinalDirection(block.rotate).z;
    const ao_enabled            = true;
    const ao_transparent_blocks = [BLOCK.DUMMY.id, BLOCK.AIR.id];

    // Texture color multiplier
    var lm = MULTIPLY.COLOR.WHITE;
    if(block.id == BLOCK.DIRT.id) {
        lm = biome.dirt_color; // MULTIPLY.COLOR.GRASS;
    }

    var DIRECTION_UP            = DIRECTION.UP;
    var DIRECTION_DOWN          = DIRECTION.DOWN;
    var DIRECTION_BACK          = DIRECTION.BACK;
    var DIRECTION_RIGHT         = DIRECTION.RIGHT;
    var DIRECTION_FORWARD       = DIRECTION.FORWARD;
    var DIRECTION_LEFT          = DIRECTION.LEFT;

    if(!block.name) {
        console.log('block', JSON.stringify(block), block.id);
        debugger;
    }

    var c, n, ao, neighbourBlock;
    var width                   = block.width ? block.width : 1;
    var height                  = block.height ? block.height : 1;
    var drawAllSides            = width != 1 || height != 1;
    var texture                 = BLOCK[block.name].texture;
    var blockLit                = true;

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

    // Can change height
    var bH         = 1.0;
    if(block.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(block.id) >= 0) {
        bH = Math.min(block.power, .9)
        var blockOver  = world.chunkManager.getBlock(x, y + 1, z);
        if(blockOver) {
	        var blockOverIsFluid = (blockOver.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(blockOver.id) >= 0);
	        if(blockOverIsFluid) {
	            bH = 1.0;
	        }
	 	}
    }
    // bH = 1.0;

    if(block.id == BLOCK.DIRT.id || block.id == BLOCK.SNOW_DIRT.id) {
        if(neighbours.UP && !neighbours.UP.transparent) {
            DIRECTION_BACK      = DIRECTION.DOWN;
            DIRECTION_RIGHT     = DIRECTION.DOWN;
            DIRECTION_FORWARD   = DIRECTION.DOWN;
            DIRECTION_LEFT      = DIRECTION.DOWN;
        }
    }

    // Top
    neighbourBlock = neighbours.UP;
    // neighbourBlock = world.chunkManager.getBlock(x, y + 1, z);
    if(drawAllSides || !neighbourBlock || neighbourBlock.transparent || block.fluid) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
	        var nX = world.chunkManager.getBlock(x, y + 1, z - 1); // слева
	        var nY = world.chunkManager.getBlock(x - 1, y + 1, z); // сверху
	        var nXY = world.chunkManager.getBlock(x - 1, y + 1, z - 1); // левый верхний угол
	        var pX = world.chunkManager.getBlock(x, y + 1, z + 1);  // справа
	        var pY = world.chunkManager.getBlock(x + 1, y + 1, z); // снизу
	        var pXY = world.chunkManager.getBlock(x + 1, y + 1, z + 1); // правый нижний угол
	        var uXY = world.chunkManager.getBlock(x - 1, y + 1, z + 1); // правый верхний 
	        var dXY = world.chunkManager.getBlock(x + 1, y + 1, z - 1); // левый нижний
	        if(ao_transparent_blocks.indexOf(nX.id) < 0 && !nX.transparent) {ao[0] += .2; ao[1] += .2;}
	        if(ao_transparent_blocks.indexOf(nY.id) < 0 && !nY.transparent)  {ao[0] += .2; ao[3] += .2;}
	        if(ao_transparent_blocks.indexOf(nXY.id) < 0 && !nXY.transparent)  {ao[0] += .2; }
	        if(ao_transparent_blocks.indexOf(pX.id) < 0 && !pX.transparent)  {ao[2] += .2; ao[3] += .2; }
	        if(ao_transparent_blocks.indexOf(pY.id) < 0 && !pY.transparent)  {ao[1] += .2; ao[2] += .2; }
	        if(ao_transparent_blocks.indexOf(pXY.id) < 0 && !pXY.transparent)  {ao[2] += .2;}
	        if(ao_transparent_blocks.indexOf(uXY.id) < 0 && !uXY.transparent)  {ao[3] += .2;}
	        if(ao_transparent_blocks.indexOf(dXY.id) < 0 && !dXY.transparent)  {ao[1] += .2;}
    	}
        c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_UP));
        n = NORMALS.UP;
        pushQuad(
            vertices,
            [x,       z,       y + bH - 1 + height, c[0], c[1], lm.r, lm.g, lm.b, ao[0], n.x, n.y, n.z],
            [x + 1.0, z,       y + bH - 1 + height, c[2], c[1], lm.r, lm.g, lm.b, ao[1], n.x, n.y, n.z],
            [x + 1.0, z + 1.0, y + bH - 1 + height, c[2], c[3], lm.r, lm.g, lm.b, ao[2], n.x, n.y, n.z],
            [x,       z + 1.0, y + bH - 1 + height, c[0], c[3], lm.r, lm.g, lm.b, ao[3], n.x, n.y, n.z]
        );
    }

    // Waters
    if([200, 202].indexOf(block.id) >= 0) {
        return;
    }

    // Bottom
    neighbourBlock = neighbours.DOWN;
    // neighbourBlock = world.chunkManager.getBlock(x, y - 1, z);
    if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
        ao = [.5, .5, .5, .5];
        c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_DOWN));
        n = NORMALS.DOWN;
        pushQuad(
            vertices,                            
            [x,         z + 1.0,    y, c[0], c[3], lm.r, lm.g, lm.b, ao[0], n.x, n.y, n.z],
            [x + 1.0,   z + 1.0,    y, c[2], c[3], lm.r, lm.g, lm.b, ao[1], n.x, n.y, n.z],
            [x + 1.0,   z,          y, c[2], c[1], lm.r, lm.g, lm.b, ao[2], n.x, n.y, n.z],
            [x,         z,          y, c[0], c[1], lm.r, lm.g, lm.b, ao[3], n.x, n.y, n.z]
        );
    }

    // Front/Forward
    neighbourBlock = neighbours.FORWARD;
    // neighbourBlock = world.chunkManager.getBlock(x, y, z - 1);
    if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            var aa = world.chunkManager.getBlock(x - 1, y, z - 1); // слева
            var ab = world.chunkManager.getBlock(x + 1, y, z - 1); // справа
            var ac = world.chunkManager.getBlock(x, y - 1, z - 1); // снизу
            if(ao_transparent_blocks.indexOf(aa.id) < 0 && !aa.transparent) {ao[0] += .2; ao[3] += .2;}
            if(ao_transparent_blocks.indexOf(ab.id) < 0 && !ab.transparent) {ao[1] += .2; ao[2] += .2;}
            if(ao_transparent_blocks.indexOf(ac.id) < 0 && !ac.transparent) {ao[0] += .2; ao[1] += .2;}
        }
        c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
        n = NORMALS.FORWARD;
        pushQuad(
            vertices,
            [x,         z + .5 - width / 2, y,      c[0], c[3], lm.r, lm.g, lm.b, ao[0], n.x, n.y, n.z],
            [x + 1,     z + .5 - width / 2, y,      c[2], c[3], lm.r, lm.g, lm.b, ao[1], n.x, n.y, n.z],
            [x + 1,     z + .5 - width / 2, y + bH, c[2], c[1], lm.r, lm.g, lm.b, ao[2], n.x, n.y, n.z],
            [x,         z + .5 - width / 2, y + bH, c[0], c[1], lm.r, lm.g, lm.b, ao[3], n.x, n.y, n.z]
        );
    }

    // Back
    neighbourBlock = neighbours.BACK;
    // neighbourBlock = world.chunkManager.getBlock(x, y, z + 1);
    if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            // @todo
        }
        c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_BACK));
        n = NORMALS.BACK;
        pushQuad(
            vertices,
            [x,         z + 0.5 + width / 2, y + bH,    c[2], c[1], lm.r, lm.g, lm.b, ao[0], n.x, n.y, n.z],
            [x + 1.0,   z + 0.5 + width / 2, y + bH,    c[0], c[1], lm.r, lm.g, lm.b, ao[1], n.x, n.y, n.z],
            [x + 1.0,   z + 0.5 + width / 2, y,         c[0], c[3], lm.r, lm.g, lm.b, ao[2], n.x, n.y, n.z],
            [x,         z + 0.5 + width / 2, y,         c[2], c[3], lm.r, lm.g, lm.b, ao[3], n.x, n.y, n.z]
        );
    }

    // Left
    neighbourBlock = neighbours.LEFT;
    // neighbourBlock = world.chunkManager.getBlock(x - 1, y, z);
    if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            // @todo
        }
        c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_LEFT));
        n = NORMALS.LEFT;
        pushQuad(
            vertices,
            [x + .5 - width / 2,    z,          y + bH, c[2], c[1], lm.r, lm.g, lm.b, ao[0], n.x, n.y, n.z],
            [x +.5 - width / 2,     z + 1.0,    y + bH, c[0], c[1], lm.r, lm.g, lm.b, ao[1], n.x, n.y, n.z],
            [x + .5 - width / 2,    z + 1.0,    y, c[0], c[3], lm.r, lm.g, lm.b, ao[2], n.x, n.y, n.z],
            [x + .5 - width / 2,    z,          y, c[2], c[3], lm.r, lm.g, lm.b, ao[3], n.x, n.y, n.z]
        );
    }

    // Right
    neighbourBlock = neighbours.RIGHT;
    // neighbourBlock = world.chunkManager.getBlock(x + 1, y, z);
    if(drawAllSides || !neighbourBlock || neighbourBlock.transparent) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            var aa = world.chunkManager.getBlock(x + 1, y, z - 1); // правый верхний
            var ab = world.chunkManager.getBlock(x + 1, y, z + 1); // правый нижний
            var ac = world.chunkManager.getBlock(x + 1, y - 1, z);
            if(ao_transparent_blocks.indexOf(aa.id) < 0 && !aa.transparent) {ao[0] += .2; ao[3] += .2;}
            if(ao_transparent_blocks.indexOf(ab.id) < 0 && !ab.transparent) {ao[1] += .2; ao[2] += .2;}
            if(ao_transparent_blocks.indexOf(ac.id) < 0 && !ac.transparent) {ao[0] += .2; ao[1] += .2;}
        }
        c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_RIGHT));
        n = NORMALS.RIGHT;
        pushQuad(
            vertices,
            [x + .5 + width / 2, z,         y, c[0], c[3], lm.r, lm.g, lm.b, ao[0], n.x, n.y, n.z],
            [x + .5 + width / 2, z + 1.0,   y, c[2], c[3], lm.r, lm.g, lm.b, ao[1], n.x, n.y, n.z],
            [x + .5 + width / 2, z + 1.0,   y + bH, c[2], c[1], lm.r, lm.g, lm.b, ao[2], n.x, n.y, n.z],
            [x + .5 + width / 2, z,         y + bH, c[0], c[1], lm.r, lm.g, lm.b, ao[3], n.x, n.y, n.z]
        );
    }

}

// Pushes the vertices necessary for rendering a
// specific block into the array.
function push_ladder(block, vertices, world, lightmap, x, y, z) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    var texture     = BLOCK[block.name].texture;
    var blockLit    = true; // z >= lightmap[x][y];
    var bH          = 1.0;
    var width       = block.width ? block.width : 1;
    var lm          = MULTIPLY.COLOR.WHITE;
    var c           = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.S: {
            // Front
            var n = NORMALS.FORWARD;
            pushQuad(
                vertices,
                [x,     z + 1 - width, y, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1, z + 1 - width, y, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1, z + 1 - width, y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x,     z + 1 - width, y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            break;
        }
        case ROTATE.W: {
            // Left
            var n = NORMALS.LEFT;
            pushQuad(
                vertices,
                [x + 1 - width, z,          y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1 - width, z + 1.0,    y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1 - width, z + 1.0,    y, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1 - width, z,          y, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            break;
        }
        case ROTATE.N: {
            // Back
            var n = NORMALS.BACK;
            pushQuad(
                vertices,
                [x,         z + width, y + bH,  c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0,   z + width, y + bH,  c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0,   z + width, y,       c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x,         z + width, y,       c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            break;
        }
        case ROTATE.E: {
            // Right
            var n = NORMALS.RIGHT;
            pushQuad(
                vertices,
                [x + 1.0 - 1 + width, z,        y,      c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0 - 1 + width, z + 1.0,  y,      c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0 - 1 + width, z + 1.0,  y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0 - 1 + width, z,        y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
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
    v.push(...p1);
    v.push(...p2);
    v.push(...p3);
    v.push(...p3);
    v.push(...p4);
    v.push(...p1);
	/*
    v.push(p1[0], p1[1], p1[2], p1[3], p1[4], p1[5], p1[6], p1[7], p1[8], p1[9], p1[10], p1[11]);
    v.push(p2[0], p2[1], p2[2], p2[3], p2[4], p2[5], p2[6], p2[7], p2[8], p2[9], p2[10], p2[11]);
    v.push(p3[0], p3[1], p3[2], p3[3], p3[4], p3[5], p3[6], p3[7], p3[8], p3[9], p3[10], p3[11]);
    
    v.push(p3[0], p3[1], p3[2], p3[3], p3[4], p3[5], p3[6], p3[7], p3[8], p3[9], p3[10], p3[11]);
    v.push(p4[0], p4[1], p4[2], p4[3], p4[4], p4[5], p4[6], p4[7], p4[8], p4[9], p4[10], p4[11]);
    v.push(p1[0], p1[1], p1[2], p1[3], p1[4], p1[5], p1[6], p1[7], p1[8], p1[9], p1[10], p1[11]);
	*/
}

// push_plane
function push_plane(vertices, x, y, z, c, lm, n, x_dir, rot, xp, yp, zp) {

    z = [y, y = z][0];
    zp = [yp, yp = zp][0];

    xp          = xp ? xp : 1; // rot ? 1.41 : 1.0;
    yp          = yp ? yp : 1; // rot ? 1.41 : 1.0;
    zp          = zp ? zp : 1; // rot ? 1.41 : 1.0;
    var mn      = 0.15;
    var quads   = [];

    if (x_dir) {
        if(rot) {
            quads.push([
                [x, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
            quads.push([
                [x + xp, y, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x, y + yp, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x, y + yp, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
        } else {
            quads.push([
                [x, y + 0.5, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y + 0.5, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y + 0.5, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x, y + 0.5, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
            quads.push([
                [x + xp, y + 0.5, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x, y + 0.5, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x, y + 0.5, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y + 0.5, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
        }
    } else {
        if(rot) {
            quads.push([
                [x + xp, y + yp, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0, y + 0.0, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0, y + 0.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y + yp, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
            quads.push([
                [x + 0, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + xp, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
        } else {
            quads.push([
                [x + 0.5, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0.5, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0.5, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0.5, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
            quads.push([
                [x + 0.5, y + yp, z + zp, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0.5, y, z + zp, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0.5, y, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 0.5, y + yp, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            ]);
        }
    }
    
    for(var quad of quads) {
        pushQuad(vertices, quad[0], quad[1], quad[2], quad[3]);
    }
    
}

// Растения
function push_plant(block, vertices, world, lightmap, x, y, z, biome) {
    // var block       = world.chunkManager.getBlock(x, y, z);
    var texture     = BLOCK.fromId(block.id).texture;
    var blockLit    = true; // z >= lightmap[x][y];
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    var lm = MULTIPLY.COLOR.WHITE;
    // Texture color multiplier
    if(block.id == BLOCK.GRASS.id) {
        lm = biome.dirt_color;
    }
    var n = NORMALS.UP;
    if(block.id == BLOCK.GRASS.id) {
        y -= .15;
    }
    push_plane(vertices, x, y, z, c, lm, n, true, true);
    push_plane(vertices, x, y, z, c, lm, n, false, true);
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
    var blockLit = true; // z >= lightmap[x][y];
    var blockLight = block.light ? block.light.toFloat() : null;
    block.transparent = true;
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    var lm = MULTIPLY.COLOR.WHITE;
    var n = NORMALS.UP;
    var dirs = check_xy_neighbor(world, x, y, z);
    if (dirs[0] * dirs[1] == 0 && dirs[0] + dirs[1] > 0) {
        push_plane(vertices, x, y, z, c, lm, n, dirs[0] > dirs[1], false);
    } else {
        push_plant(block, vertices, world, lightmap, x, y, z);
    }
}

// Ступеньки
function push_stairs(block, vertices, world, lightmap, x, y, z) {

    const half          = 0.5 / TX_CNT;
    var poses           = [];
    var texture         = BLOCK.fromId(block.id).texture;
    var lm              = MULTIPLY.COLOR.WHITE;
    var blockLit        = true;

    block.transparent   = true;

    // полная текстура
    var c = calcTexture(texture(world, lightmap, blockLit, x, y, z, null));

    // четверть текстуры
    var c_half = [
        c[0],
        c[1],
        c[2] - half,
        c[3] - half,
    ];
	/*
    // верхняя половина текстуры
    var c_half_top = [
        c[0],
        c[1],
        c[2] - half,
        c[3],
    ];*/
    // нижняя половина текстуры
    var c_half_bottom= [
        c[0],
        c[1] + half,
        c[2],
        c[3],
    ];

    // стенка 1
    var n = NORMALS.FORWARD;
    push_plane(vertices, x, y, z - 0.5, c_half_bottom, lm, n, true, false, null, .5, null);

    // стенка 2
    n = NORMALS.BACK;
    push_plane(vertices, x, y, z + 0.5, c_half_bottom, lm, n, true, false, null, .5, null);

    // стенка 3
    n = NORMALS.RIGHT;
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // стенка 4
    n = NORMALS.LEFT;
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));    

    // дно
    n = NORMALS.DOWN;
    pushQuad(
        vertices,                            
        [ x,        z + 1.0,    y, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0,  z + 1.0,    y, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0,  z,          y, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x,        z,          y, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
    );

    // поверхность нижней ступени
    bH = 0.5;
    n = NORMALS.UP;
    pushQuad(
        vertices,
        [ x,        z,          y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0,  z,          y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0,  z + 1.0,    y + bH, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x,        z + 1.0,    y + bH, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
    );

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;
    
    // F R B L
    switch(cardinal_direction) {
        case ROTATE.S: {
            poses = [
                new Vector(0, 0, .5),
                new Vector(-.5, 0, .5),
            ];
            break;
        }
        case ROTATE.W: {
            poses = [
                new Vector(0, 0, 0),
                new Vector(0, 0, .5),
            ];
            break;
        }
        case ROTATE.N: {
            poses = [
                new Vector(0, 0, 0),
                new Vector(-.5, 0, 0),
            ];
            break;
        }
        case ROTATE.E: {
            poses = [
                new Vector(-.5, 0, 0),
                new Vector(-.5, 0, .5),
            ];
            break;
        }
    }

    // Верхняя ступень
    for(var pose of poses) {

        // левая стенка
        n = NORMALS.RIGHT;
        push_plane(vertices, x + 0.5 + pose.x, y + .5, z + pose.z, c_half, lm, n, false, false, null, .5, .5);

        // передняя стенка
        n = NORMALS.FORWARD;
        push_plane(vertices, x + 0.5 + pose.x, y + 0.5, z - 0.5 + pose.z, c_half, lm, n, true, false, .5, .5, null);

        // задняя стенка
        n = NORMALS.BACK;
        push_plane(vertices, x + 0.5 + pose.x, y + 0.5, z + pose.z, c_half, lm, n, true, false, .5, .5, null);

        // правая стенка
        n = NORMALS.LEFT;
        push_plane(vertices, x + pose.x, y + 0.5, z + pose.z, c_half, lm, n, false, false, null, .5, .5);

        // поверхность
        n = NORMALS.UP;
        var bH = 1.0;
        pushQuad(
            vertices,
            [ x + 0.5 + pose.x,  z + pose.z,       y + bH, c_half[0], c_half[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
            [ x + 1 + pose.x,    z + pose.z,       y + bH, c_half[2], c_half[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
            [ x + 1 + pose.x,    z + 0.5 + pose.z, y + bH, c_half[2], c_half[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
            [ x + 0.5 + pose.x,  z + 0.5 + pose.z, y + bH, c_half[0], c_half[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
        );
    }

}

// Панель
function push_pane(block, vertices, world, lightmap, x, y, z, neighbours) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    var texture     = BLOCK[block.name].texture;
    var blockLit    = true;
    var bH          = 1.0;
    var width       = block.width ? block.width : 1;
    var lm          = MULTIPLY.COLOR.WHITE;
    var c           = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.N:
        case ROTATE.S: {
            // Front
            var n = NORMALS.FORWARD;
            pushQuad(
                vertices,
                [x,     z + .5, y, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1, z + .5, y, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1, z + .5, y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x,     z + .5, y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            n = NORMALS.BACK;
            pushQuad(
                vertices,
                [x,         z + .5, y + bH,  c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0,   z + .5, y + bH,  c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + 1.0,   z + .5, y,       c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x,         z + .5, y,       c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            break;
        }
        case ROTATE.E:
        case ROTATE.W: {
            // Left
            var n = NORMALS.LEFT;
            pushQuad(
                vertices,
                [x + .5, z,          y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + .5, z + 1.0,    y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + .5, z + 1.0,    y, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + .5, z,          y, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            // Right
            n = NORMALS.RIGHT;
            pushQuad(
                vertices,
                [x + .5, z,        y,      c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + .5, z + 1.0,  y,      c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + .5, z + 1.0,  y + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
                [x + .5, z,        y + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
            );
            break;
        }
    }

}

// Плита
function push_slab(block, vertices, world, lightmap, x, y, z) {

    const half = 0.5 / TX_CNT;
    
    // var block = world.chunkManager.getBlock(x, y, z);
    var texture = BLOCK.fromId(block.id).texture;
	var blockLit = true; // z >= lightmap[x][y];
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
    var lightMultiplier = true; // z >= lightmap[x][y] ? 1.0 : 0.6;
    
    var dirs = check_xy_neighbor(world, x, y, z);

    /*
    if(blockLight) {
        lm.a += blockLight.a;
    }
    */

    // задняя стенка
    var lm = MULTIPLY.COLOR.WHITE;
    var n = NORMALS.BACK;
    push_plane(vertices, x, y - 0.5, z, c_half_bottom, lm, n, true, false, null, null, .5);
    // передняя стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.FORWARD;
    push_plane(vertices, x, y + 0.5, z, c_half_bottom, lm, n, true, false, null, null, .5);

    // правая стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.RIGHT;
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, n, false, false, null, null, .5);
    // левая стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.LEFT;
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, n, false, false, null, null, .5);

    c = calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));    

    // дно
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.DOWN;
    pushQuad(
        vertices,                            
        [ x, y + 1.0, z, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0, y + 1.0, z, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0, y, z, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x, y, z, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
    );

    // поверхность нижней ступени
    bH = 0.5;
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.UP;
    pushQuad(
        vertices,
        [ x, y, z + bH, c[0], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0, y, z + bH, c[2], c[1], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x + 1.0, y + 1.0, z + bH, c[2], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],
        [ x, y + 1.0, z + bH, c[0], c[3], lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z]
    );

}

// pushVertices
BLOCK.pushVertices = function(vertices, block, world, lightmap, x, y, z, neighbours, biome) {
    const style = 'style' in block ? block.style : '';
    if (['planting', 'torch', 'sign'].indexOf(style) >= 0) {
        push_plant(block, vertices, world, lightmap, x, y, z, biome);
    } else if (style == 'pane') {
        // throw 'Unsupported style';
        // push_plant(block, vertices, world, lightmap, x, y, z);
        push_pane(block, vertices, world, lightmap, x, y, z, neighbours);
    } else if (style == 'stairs') {
        push_stairs(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'slab') {
        push_slab(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'ladder') {
        push_ladder(block, vertices, world, lightmap, x, y, z);
    } else if (style == 'fence') {
        push_fence(block, vertices, world, lightmap, x, y, z);
    } else {
        push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome);
    }
}

// Pushes vertices with the data needed for picking.
BLOCK.pushPickingVertices = function(vertices, x, y, z, pos) {

	var color = {
        r: pos.x / 255,
        g: pos.y / 255,
        b: pos.z / 255
    };

	// Top
	pushQuad(
		vertices,
		[ x,        z,      y + 1, 0, 0, color.r, color.g, color.b, 1/255, 0, 0, 0],
		[ x + 1,    z,      y + 1, 1, 0, color.r, color.g, color.b, 1/255, 0, 0, 0],
		[ x + 1,    z + 1,  y + 1, 1, 1, color.r, color.g, color.b, 1/255, 0, 0, 0],
		[ x,        z + 1,  y + 1, 0, 0, color.r, color.g, color.b, 1/255, 0, 0, 0]
	);
	
	// Bottom
	pushQuad(
		vertices,
		[ x,        z + 1,  y, 0, 0, color.r, color.g, color.b, 2/255, 0, 0, 0],
		[ x + 1,    z + 1,  y, 1, 0, color.r, color.g, color.b, 2/255, 0, 0, 0],
		[ x + 1,    z,      y, 1, 1, color.r, color.g, color.b, 2/255, 0, 0, 0],
		[ x,        z,      y, 0, 0, color.r, color.g, color.b, 2/255, 0, 0, 0]
	);
	
	// Front
	pushQuad(
		vertices,
		[ x,        z, y, 0, 0, color.r, color.g, color.b, 3/255, 0, 0, 0],
		[ x + 1,    z, y, 1, 0, color.r, color.g, color.b, 3/255, 0, 0, 0],
		[ x + 1,    z, y + 1, 1, 1, color.r, color.g, color.b, 3/255, 0, 0, 0],
		[ x,        z, y + 1, 0, 0, color.r, color.g, color.b, 3/255, 0, 0, 0]
	);
	
	// Back
	pushQuad(
		vertices,
		[ x,        z + 1, y + 1, 0, 0, color.r, color.g, color.b, 4/255, 0, 0, 0],
		[ x + 1,    z + 1, y + 1, 1, 0, color.r, color.g, color.b, 4/255, 0, 0, 0],
		[ x + 1,    z + 1, y, 1, 1, color.r, color.g, color.b, 4/255, 0, 0, 0],
		[ x,        z + 1, y, 0, 0, color.r, color.g, color.b, 4/255, 0, 0, 0]
	);
	
	// Left
	pushQuad(
		vertices,
		[ x, z,     y + 1, 0, 0, color.r, color.g, color.b, 5/255, 0, 0, 0],
		[ x, z + 1, y + 1, 1, 0, color.r, color.g, color.b, 5/255, 0, 0, 0],
		[ x, z + 1, y, 1, 1, color.r, color.g, color.b, 5/255, 0, 0, 0],
		[ x, z,     y, 0, 0, color.r, color.g, color.b, 5/255, 0, 0, 0]
	);
	
	// Right
	pushQuad(
		vertices,
		[ x + 1, z,     y, 0, 0, color.r, color.g, color.b, 6/255, 0, 0, 0],
		[ x + 1, z + 1, y, 1, 0, color.r, color.g, color.b, 6/255, 0, 0, 0],
		[ x + 1, z + 1, y + 1, 1, 1, color.r, color.g, color.b, 6/255, 0, 0, 0],
		[ x + 1, z,     y + 1, 0, 0, color.r, color.g, color.b, 6/255, 0, 0, 0]
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