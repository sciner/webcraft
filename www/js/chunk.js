import {Vector} from "./helpers.js";
import {BLOCK, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./blocks.js";
import GeometryTerrain from "./geometry_terrain.js";

// Creates a new chunk
export default class Chunk {

    constructor(chunkManager, pos, modify_list) {

        // info
        this.key = chunkManager.getPosChunkKey(pos);
        this.modify_list = modify_list;

        // размеры чанка
        this.size = new Vector(
            CHUNK_SIZE_X,
            CHUNK_SIZE_Y,
            CHUNK_SIZE_Z
        );

        // относительные координаты чанка
        this.addr = new Vector(
            pos.x,
            pos.y,
            pos.z
        );
        this.coord = new Vector(
            this.addr.x * CHUNK_SIZE_X,
            this.addr.y * CHUNK_SIZE_Y,
            this.addr.z * CHUNK_SIZE_Z
        );

        this.seed = chunkManager.world.seed;
        this.blocks = null;

        this.id = [
            this.addr.x,
            this.addr.y,
            this.addr.z,
            this.size.x,
            this.size.y,
            this.size.z
        ].join('_');

        // Run webworker method
        chunkManager.postWorkerMessage(['createChunk', this]);

        // Objects & variables
        this.chunkManager               = chunkManager;
        this.inited                     = false;
        this.dirty                      = true;
        this.buildVerticesInProgress    = false;
        this.vertices_length            = 0;
        this.vertices                   = {};
        this.fluid_blocks               = [];
        this.gravity_blocks             = [];

        this.chunkManager.addToDirty(this);

    }

    // onBlocksGenerated ... Webworker callback method
    onBlocksGenerated(args) {
        this.blocks = args.blocks;
        this.inited = true;
    }

    // onVerticesGenerated ... Webworker callback method
    onVerticesGenerated(args) {
        this.vertices_args = args;
        if(!this.map) {
            this.map = args.map;
        }
    }

    drawBufferGroup(render, group, mat) {
        if(this.vertices[group]) {
            if(this.vertices[group].buffer) {
                render.drawMesh(this.vertices[group].buffer, mat, this.coord);
                return true;
            }
        }
        return false;
    }

    // Apply vertices
    applyVertices() {
        const args = this.vertices_args;
        delete(this['vertices_args']);
        this.chunkManager.deleteFromDirty(this.key);
        this.buildVerticesInProgress            = false;
        this.chunkManager.vertices_length_total -= this.vertices_length;
        this.vertices_length                    = 0;
        this.gravity_blocks                     = args.gravity_blocks;
        this.fluid_blocks                       = args.fluid_blocks;
        // Delete old WebGL buffers
        for(let key of Object.keys(this.vertices)) {
            let v = this.vertices[key];
            if(v.buffer) {
                v.buffer.destroy();
            }
            delete(this.vertices[key]);
        }
        // Добавление чанка в отрисовщик
        for(let key of Object.keys(args.vertices)) {
            let v = args.vertices[key];
            if(v.list.length > 0) {
                this.vertices_length  += v.list.length / GeometryTerrain.strideFloats;
                v.buffer              = new GeometryTerrain(v.list);
                this.vertices[key]   = v;
                delete(v.list);
            }
        }
        this.chunkManager.vertices_length_total += this.vertices_length;
        this.dirty                 = false;
        this.timers                = args.timers;
    }

    // destruct chunk
    destruct() {
        if(this.buffer) {
            this.buffer.destroy();
        }
        // Run webworker method
        this.chunkManager.postWorkerMessage(['destructChunk', {key: this.key}]);
    }

    // buildVertices
    buildVertices() {
        if(this.buildVerticesInProgress) {
            return;
        }
        this.buildVerticesInProgress = true;
        // Run webworker method
        this.chunkManager.postWorkerMessage(['buildVertices', {keys: [this.key]}]);
        return true;
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(x, y, z) {
        if(!this.inited) {
            return BLOCK.DUMMY;
        }
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        if(x < 0 || y < 0 || z < 0 || x >= this.size.x || y >= this.size.y || z >= this.size.z) {
            return BLOCK.DUMMY;
        }
        let block = this.blocks[x][z][y];
        if(!block) {
            return BLOCK.AIR;
        }
        if(typeof block == 'number') {
           block = BLOCK.BLOCK_BY_ID[block];
        }
        return block;
    }

    // setBlock
    setBlock(x, y, z, type, is_modify, power, rotate, entity_id, extra_data) {
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        if(x < 0 || y < 0 || z < 0 || x >= this.size.x || y >= this.size.y || z >= this.size.z) {
            return;
        };
        // fix rotate
        if(rotate && typeof rotate === 'object') {
            rotate = new Vector(
                Math.round(rotate.x * 10) / 10,
                Math.round(rotate.y * 10) / 10,
                Math.round(rotate.z * 10) / 10
            );
        } else {
            rotate = new Vector(0, 0, 0);
        }
        // fix power
        if(typeof power === 'undefined' || power === null) {
            power = 1.0;
        }
        power = Math.round(power * 10000) / 10000;
        if(power <= 0) {
            return;
        }
        let update_vertices = true;
        //
        if(!is_modify) {
            type = {...BLOCK[type.name]};
            type.power      = power;
            type.rotate     = rotate;
            type.texture    = null;
            if(extra_data) {
                type.extra_data = extra_data;
            }
            if(entity_id) {
                type.entity_id = entity_id;
            }
            if(type.gravity) {
                type.falling = true;
            }
            update_vertices = !!extra_data || JSON.stringify(this.blocks[x][z][y]) != JSON.stringify(type);
            this.blocks[x][z][y] = type;
        }
        // Run webworker method
        if(update_vertices) {
            let set_block_list = [];
            set_block_list.push({
                key:        this.key,
                x:          x + this.coord.x,
                y:          y + this.coord.y,
                z:          z + this.coord.z,
                type:       type,
                is_modify:  is_modify,
                power:      power,
                rotate:     rotate,
                extra_data: extra_data
            });
            // Принудительная перерисовка соседних чанков
            let update_neighbors = [];
            if(x == 0) update_neighbors.push(new Vector(-1, 0, 0));
            if(x == this.size.x - 1) update_neighbors.push(new Vector(1, 0, 0));
            if(y == 0) update_neighbors.push(new Vector(0, -1, 0));
            if(y == this.size.y - 1) update_neighbors.push(new Vector(0, 1, 0));
            if(z == 0) update_neighbors.push(new Vector(0, 0, -1));
            if(z == this.size.z - 1) update_neighbors.push(new Vector(0, 0, 1));
            // diagonal
            if(x == 0 && z == 0) update_neighbors.push(new Vector(-1, 0, -1));
            if(x == this.size.x - 1 && z == 0) update_neighbors.push(new Vector(1, 0, -1));
            if(x == 0 && z == this.size.z - 1) update_neighbors.push(new Vector(-1, 0, 1));
            if(x == this.size.x - 1 && z == this.size.z - 1) update_neighbors.push(new Vector(1, 0, 1));
            // Добавляем выше и ниже
            let update_neighbors2 = [];
            for(var update_neighbor of update_neighbors) {
                update_neighbors2.push(update_neighbor.add(new Vector(0, -1, 0)));
                update_neighbors2.push(update_neighbor.add(new Vector(0, 1, 0)));
            }
            update_neighbors.push(...update_neighbors2);
            let updated_chunks = [this.key];
            for(var update_neighbor of update_neighbors) {
                let pos = new Vector(x, y, z).add(this.coord).add(update_neighbor);
                let key = this.chunkManager.getPosChunkKey(this.chunkManager.getChunkPos(pos));
                // чтобы не обновлять один и тот же чанк дважды
                if(updated_chunks.indexOf(key) < 0) {
                    updated_chunks.push(key);
                    set_block_list.push({
                        key:        key,
                        x:          pos.x,
                        y:          pos.y,
                        z:          pos.z,
                        type:       null,
                        is_modify:  is_modify,
                        power:      power,
                        rotate:     rotate
                    });
                }
            }
            this.chunkManager.postWorkerMessage(['setBlock', set_block_list]);
        }
    }

}
