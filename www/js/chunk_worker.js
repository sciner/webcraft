importScripts(
    './helpers.js',
    './blocks.js',
    './blocks_func.js',
    // './terrain_generator/basic.js'
    './terrain_generator/biome.js'
    // './terrain_generator/simple.js'
    // '/js/terrain_generator/diamond_square.js'
);

const CHUNK_SIZE_X      = 16;
const CHUNK_SIZE_Y      = 16;
const CHUNK_SIZE_Z      = 256;
const DIRT_HEIGHT       = 32;

// 1. All blocks
var all_blocks = [];
for(var b of BLOCK.getAll()) {
    b = Object.assign({}, b), 
    delete(b.texture);
    all_blocks.push(b);
}
for(var k in all_blocks) {
    all_blocks[k] = Object.assign({}, all_blocks[k]);
    delete(all_blocks[k].texture);
}

// 2. Plants
var plant_blocks = []
for(var b of BLOCK.getPlants()) {
    b = Object.assign({}, b), 
    delete(b.texture);
    plant_blocks.push(b);
}

// 3. Banned blocks
var banned_blocks = [
    BLOCK.DUMMY.id,
    BLOCK.STILL_WATER.id,
    BLOCK.ICE.id,
    BLOCK.ICE2.id
];

// 4. Blocks used for generators
var blocks = {
    DIRT:           BLOCK.DIRT,
    SNOW_DIRT:      BLOCK.SNOW_DIRT,
    AIR:            BLOCK.AIR,
    DIAMOND_ORE:    BLOCK.DIAMOND_ORE,
    COAL_ORE:       BLOCK.COAL_ORE,
    CONCRETE:       BLOCK.CONCRETE,
    BEDROCK:        BLOCK.BEDROCK,
    GRAVEL:         BLOCK.GRAVEL,
    PLANK:          BLOCK.PLANK,
    GRASS:          BLOCK.GRASS,
    RED_MUSHROOM:   BLOCK.RED_MUSHROOM,
    BROWN_MUSHROOM: BLOCK.BROWN_MUSHROOM,
    WOOD:           BLOCK.WOOD,
    SPRUCE:         BLOCK.SPRUCE,
    SAND:           BLOCK.SAND,
    DEAD_BUSH:      BLOCK.DEAD_BUSH,
    WOOD_BIRCH:     BLOCK.WOOD_BIRCH,
    WOOD_LEAVES:    BLOCK.WOOD_LEAVES,
    SPRUCE_LEAVES:  BLOCK.SPRUCE_LEAVES,
    LEAVES2:        BLOCK.LEAVES2,
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
for(var [key, b] of Object.entries(blocks)) {
    b = Object.assign({}, b), 
    delete(b.texture);
    blocks[key] = b;
}

var chunks              = {};
var terrainGenerator    = new Terrain();
var world               = {
    chunkManager: new ChunkManager()
}

// On message callback function
onmessage = function(e) {
    const cmd = e.data[0];
    const args = e.data[1];
    switch(cmd) {
        case 'createChunk': {
            terrainGenerator.seed = args.seed;
            if(!this.chunks.hasOwnProperty(args.key)) {
                chunks[args.key] = Object.assign(new Chunk(), args);
                chunks[args.key].init();
            }
            break;
        }
        case 'destructChunk': {
            if(this.chunks.hasOwnProperty(args.key)) {
                delete(chunks[args.key]);
            }
            break;
        }
        /*case 'setModifiers': {
            if(this.chunks.hasOwnProperty(args.key)) {
                chunks[args.key].setModifiers(args.modify_list);
            }
            break;
        }*/
        case 'buildVertices': {
            if(this.chunks.hasOwnProperty(args.key)) {
                var chunk = chunks[args.key];
                chunk.dirty = true;
                chunk.shift = args.shift;
                chunk.timers.build_vertices = performance.now();
                chunk.buildVertices();
                chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
                // result
                postMessage(['vertices_generated', {
                    key:                    chunk.key,
                    vertices:               chunk.vertices,
                    gravity_blocks:         chunk.gravity_blocks,
                    fluid_blocks:           chunk.fluid_blocks,
                    shift:                  chunk.shift,
                    timers:                 chunk.timers,
                    tm:                     chunk.tm,
                    lightmap:               chunk.lightmap
                }]);
            }
            break;
        }
        case 'buildVerticesMany': {
            var result = [];
            for(var key of args.keys) {
                if(this.chunks.hasOwnProperty(key)) {
                    var chunk = this.chunks[key];
                    chunk.dirty = true;
                    chunk.shift = args.shift;
                    chunk.timers.build_vertices = performance.now();
                    chunk.buildVertices();
                    chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
                    result.push({
                        key:                    chunk.key,
                        vertices:               chunk.vertices,
                        gravity_blocks:         chunk.gravity_blocks,
                        fluid_blocks:           chunk.fluid_blocks,
                        shift:                  chunk.shift,
                        timers:                 chunk.timers,
                        tm:                     chunk.tm,
                        lightmap:               chunk.lightmap
                    });
                }
            }
            postMessage(['vertices_generated_many', result]);
            break;
        }
        case 'setBlock': {
            if(this.chunks.hasOwnProperty(args.key)) {
                // 1. Get chunk
                var chunk = chunks[args.key];
                // 2. Set new block
                if(args.type) {
                    chunk.setBlock(args.x, args.y, args.z, args.type, args.is_modify, args.power, args.rotate);
                }
                var pos = new Vector(args.x - chunk.coord.x, args.y - chunk.coord.y, args.z - chunk.coord.z);
                // 3. Clear vertices for new block and around near
                chunk.setDirtyBlocks(pos);
                // 4. Rebuild vertices list
                chunk.timers.build_vertices = performance.now();
                chunk.dirty = true;
                chunk.buildVertices();
                chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
                // 5. Send result to chunk manager
                postMessage(['vertices_generated', {
                    key:                    chunk.key,
                    vertices:               chunk.vertices,
                    gravity_blocks:         chunk.gravity_blocks,
                    fluid_blocks:           chunk.fluid_blocks,
                    shift:                  chunk.shift,
                    timers:                 chunk.timers,
                    tm:                     chunk.tm,
                    lightmap:               chunk.lightmap
                }]);
            }
            break;
        }
    }
}

// ChunkManager
function ChunkManager() {}

// Возвращает относительные координаты чанка по глобальным абсолютным координатам
ChunkManager.prototype.getChunkPos = function(x, y, z) {
    var v = new Vector(
        parseInt(x / CHUNK_SIZE_X),
        parseInt(y / CHUNK_SIZE_Y),
        0, // parseInt(z / CHUNK_SIZE_Z)
    );
    if(x < 0) {v.x--;}
    if(y < 0) {v.y--;}
    if(v.x == 0) {v.x = 0;}
    if(v.y == 0) {v.y = 0;}
    if(v.z == 0) {v.z = 0;}
    return v;
}

ChunkManager.prototype.getPosChunkKey = function(pos) {
    var k = 'c_' + pos.x + '_' + pos.y + '_' + pos.z;
    return k;
}

// Get
ChunkManager.prototype.getChunk = function(pos) {
    var k = this.getPosChunkKey(pos);
    if(chunks.hasOwnProperty(k)) {
        return chunks[k];
    }
    return null;
}

// Возвращает блок по абслютным координатам
ChunkManager.prototype.getBlock = function(x, y, z) {
    // определяем относительные координаты чанка
    var chunkPos = this.getChunkPos(x, y, z);
    // обращаемся к чанку
    var chunk = this.getChunk(chunkPos);
    // если чанк найден
    if(chunk) {
        // просим вернуть блок передав абсолютные координаты
        return chunk.getBlock(x, y, z);
    }
    return BLOCK.DUMMY;
}

// Chunk
function Chunk() {}

Chunk.prototype.init = function() {
    // Variables
    this.vertices_length    = 0;
    this.vertices           = {};
    this.dirty              = true;
    this.fluid_blocks       = [];
    this.gravity_blocks     = [];
    this.lights             = [];
    this.timers             = {
        init:               null,
        generate_terrain:   null,
        apply_modify:       null,
        build_vertices:     null
    };    
    // 1. Initialise world array
    this.timers.init = performance.now();
    this.blocks = new Array(this.size.x);
    for(var x = 0; x < this.size.x; x++) {
        this.blocks[x] = new Array(this.size.y);
        for(var y = 0; y < this.size.y; y++) {
            // this.blocks[x][y] = new Array(this.size.z);
            this.blocks[x][y] = new Array(this.size.z).fill(blocks.AIR);;
        }
    }
    this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;

    // 2. Generate terrain
    this.timers.generate_terrain = performance.now();
    terrainGenerator.generate(this);
    this.timers.generate_terrain = Math.round((performance.now() - this.timers.generate_terrain) * 1000) / 1000;

    // 3. Apply modify_list
    this.timers.apply_modify = performance.now();
    this.applyModifyList();
    this.timers.apply_modify = Math.round((performance.now() - this.timers.apply_modify) * 1000) / 1000;

    // result
    postMessage(['blocks_generated', {
        key:    this.key,
        blocks: this.blocks,
    }]);

}

Chunk.prototype.applyModifyList = function() {
    for(const [key, m] of Object.entries(this.modify_list)) {
        var pos = key.split(',');
        var type = BLOCK.fromId(m.id);
        var rotate = m.rotate ? m.rotate : null;
        var entity_id = m.entity_id ? m.entity_id : null;
        this.setBlock(parseInt(pos[0]), parseInt(pos[1]), parseInt(pos[2]), type, false, m.power, rotate, entity_id);
    }
}

// Get the type of the block at the specified position.
// Mostly for neatness, since accessing the array
// directly is easier and faster.
Chunk.prototype.getBlock = function(ox, oy, oz) {
    var x = ox - this.coord.x;
    var y = oy - this.coord.y;
    var z = oz - this.coord.z;
    if(x < 0 || y < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
        return BLOCK.DUMMY;
    };
    if(z < 0 || z >= this.size.z) {
        return BLOCK.DUMMY;
    }
    var block = this.blocks[x][y][z];
    if(block == null) {
        return blocks.AIR;
    }
    return block || BLOCK.DUMMY;
}

// setBlock
Chunk.prototype.setBlock = function(x, y, z, orig_type, is_modify, power, rotate, entity_id) {
    // fix rotate
    if(rotate && typeof rotate === 'object') {
        rotate = new Vector(
            Math.round(rotate.x * 10) / 10,
            Math.round(rotate.y * 10) / 10,
            Math.round(rotate.z * 10) / 10
        );
    } else {
        rotate = null;
    };
    // fix power
    if(typeof power === 'undefined' || power === null) {
        power = 1.0;
    }
    power = Math.round(power * 10000) / 10000;
    if(power <= 0) {
        return;
    }
    if(is_modify) {
        var modify_item = {
            id: orig_type.id,
            power: power,
            rotate: rotate
        };
        this.modify_list[[x, y, z]] = modify_item;
    }
    x -= this.coord.x;
    y -= this.coord.y;
    z -= this.coord.z;
    if(x < 0 || y < 0 || z < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
        return;
    };
    if(is_modify) {
        console.table(orig_type);
    }
    var type                        = Object.assign({}, BLOCK.fromId(orig_type.id));
    this.blocks[x][y][z]            = type;
    this.blocks[x][y][z].power      = power;
    this.blocks[x][y][z].rotate     = rotate;
    this.blocks[x][y][z].entity_id  = entity_id;
    this.blocks[x][y][z].texture    = null;
    // this.dirty                      = true;
}

// makeLights
Chunk.prototype.makeLights = function() {
    this.lights             = [];
    // Lights
    for(var x = 0; x < this.size.x; x++) {
        for(var y = 0; y < this.size.y; y++) {
            for(var z = 0; z < this.size.z; z++) {
                var block = this.blocks[x][y][z];
                if(block && block.lightPower) {
                    this.lights.push({
                        power: block.lightPower,
                        x: x,
                        y: y,
                        z: z
                    });
                }
            }
        }
    }
}

// buildVertices
Chunk.prototype.buildVertices = function() {

    if(!this.dirty || !this.blocks || !this.coord) {
        return false;
    }

    // Create map of lowest blocks that are still lit
    var lightmap            = {};
    var tm                  = performance.now();
    this.fluid_blocks       = [];
    this.gravity_blocks     = [];

    this.makeLights();

    // Add vertices for blocks
    this.vertices = {
        regular: {
            list: [],
            is_transparent: false
        },
        transparent: {
            list: [],
            is_transparent: true
        },
    }
    
    var cc = [
        {x: 0, y: 0, z: -1},
        {x: 0, y: 0, z: 1},
        {x: -1, y: 0, z: 0},
        {x: 1, y: 0, z: 0},
        {x: 0, y: -1, z: 0},
        {x: 0, y: 1, z: 0},
    ];

    function F() {}

    for(var x = 0; x < this.size.x; x++) {
        for(var y = 0; y < this.size.y; y++) {
            for(var z = 0; z < this.size.z; z++) {
                var block = this.blocks[x][y][z];
                if(block) {
                    if(block.id != BLOCK.AIR.id) {
                        // ignore invisible inside another blocks
                        if(x > 0 && y > 0 && z > 0 && x < this.size.x - 1 && y < this.size.y - 1 && z < this.size.z - 1) {
                            var pcnt = 0;
                            for(var p of cc) {
                                var b = this.blocks[x + p.x][y + p.y][z + p.z];
                                if(!b || (b.transparent || b.fluid)) {
                                    break;
                                }
                                pcnt++;
                            }
                            if(pcnt == 6) {
                                continue;
                            }
                        }
                        // lights
                        block.light = null;
                        for(var l of this.lights) {
                            var dist = (Math.sqrt(Math.pow(x - l.x, 2) + Math.pow(y - l.y, 2) + Math.pow(z - l.z, 2)));
                            var maxDist = Math.round((l.power.a / 255) * 8);
                            if(dist <= maxDist) {
                                var newLight = new Color(l.power.r, l.power.g, l.power.b, l.power.a);
                                newLight.a *= ((maxDist - dist) / maxDist);
                                if(block.light) {
                                    // @todo mix two light
                                    if(block.light.a < newLight.a) {
                                        block.light = newLight;
                                    }
                                } else {
                                    block.light = newLight;
                                }
                                this.blocks[x][y][z] = Object.assign({}, block);
                            }
                        }
                        // if block with gravity
                        if(block.gravity && z > 0) {
                            var block_under = this.blocks[x][y][z - 1];
                            if(!block_under || block_under.id == blocks.AIR.id) {
                                this.gravity_blocks.push(new Vector(x + this.coord.x, y + this.coord.y, z +  + this.coord.z));
                            }
                        }
                        // if block is fluid
                        if(block.fluid) {
                            this.fluid_blocks.push(new Vector(x + this.coord.x, y + this.coord.y, z +  + this.coord.z));
                        }
                        // make vertices array
                        if([200, 202].indexOf(block.id) >= 0) {
                            // если это блок воды
                            if(!block.hasOwnProperty('vertices')) {
                                block.vertices = [];
                                BLOCK.pushVertices(block.vertices, block, world, lightmap, x + this.coord.x, y + this.coord.y, z + this.coord.z);
                            }
                            if(block.vertices.length > 0) {
                                this.vertices.transparent.list.push(...block.vertices);
                            }
                        } else {
                            if(!block.hasOwnProperty('vertices')) {

                                // 3.8 sec
                                // block = this.blocks[x][y][z] = Object.assign({}, block);
                                // block.vertices = [];
                                
                                // 3.5 sec
                                // block = this.blocks[x][y][z] = JSON.parse(JSON.stringify(block));
                                // block.vertices = [];
        
                                // 2.7 sec
                                //var b = {vertices: []};
                                //for (var i in block) {
                                //    b[i] = block[i];
                                //}
                                //block = this.blocks[x][y][z] = b;

                                /*
                                // 2.2 sec
                                block = this.blocks[x][y][z] = {
                                    id:                 block.id,
                                    name:               block.name,
                                    power:              block.power,
                                    light:              block.light,
                                    passable:           block.passable,
                                    spawnable:          block.spawnable,
                                    inventory_icon_id:  block.inventory_icon_id,
                                    fluid:              block.fluid,
                                    gravity:            block.gravity,
                                    sound:              block.sound,
                                    width:              block.width,
                                    style:              block.style,
                                    planting:           block.planting,
                                    transparent:        block.transparent,
                                    vertices:           []
                                };
                                */

                                // 2.185
                                block = this.blocks[x][y][z] = Object.create(block);
                                block.vertices = [];

                                BLOCK.pushVertices(block.vertices, block, world, lightmap, x + this.coord.x, y + this.coord.y, z + this.coord.z);
                            }
                            if(block.vertices.length > 0) {
                                this.vertices.regular.list.push(...block.vertices);
                            }
                        }
                    }
                }
            }
        }
    }

    // ~0ms
    for(var [key, v] of Object.entries(this.vertices)) {
        for(var i = 0; i < v.list.length; i += 12) {
            v.list[i + 0] -= this.shift.x;
            v.list[i + 1] -= this.shift.y;
        }
        v.list = new Float32Array(v.list);
    }

    this.dirty = false;
    this.tm = performance.now() - tm;
    this.lightmap = lightmap;

    return true;
}

// setDirtyBlocks
Chunk.prototype.setDirtyBlocks = function(pos) {
    for(var cx = -1; cx <= 1; cx++) {
        for(var cy = -1; cy <= 1; cy++) {
            for(var cz = -1; cz <= 1; cz++) {
                var x = pos.x + cx;
                var y = pos.y + cy;
                var z = pos.z + cz;
                if(x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z) {
                    var block = this.blocks[x][y][z];
                    if(block != null) {
                        delete(block['vertices']);
                    }
                }
            }
        }
    }
}