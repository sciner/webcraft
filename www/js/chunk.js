import {Vector, VectorCollector} from "./helpers.js";
import GeometryTerrain from "./geometry_terrain.js";
import {TypedBlocks} from "./typed_blocks.js";
import { Sphere } from "./frustum.js";
import {BLOCK} from "./blocks.js";

export const CHUNK_SIZE_X                   = 16;
export const CHUNK_SIZE_Y                   = 32;
export const CHUNK_SIZE_Z                   = 16;
export const CHUNK_BLOCKS                   = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
export const CHUNK_SIZE_Y_MAX               = 4096;
export const MAX_CAVES_LEVEL                = 256;

// Возвращает адрес чанка по глобальным абсолютным координатам
export function getChunkAddr(x, y, z) {
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

// Creates a new chunk
export class Chunk {

    getChunkManager() {
        return Game.world.chunkManager;
    }

    constructor(pos, modify_list) {

        let chunkManager = this.getChunkManager();

        // info
        this.key = chunkManager.getPosChunkKey(pos);

        // размеры чанка
        this.size = new Vector(
            CHUNK_SIZE_X,
            CHUNK_SIZE_Y,
            CHUNK_SIZE_Z
        );

        this.lightTex = null;
        this.lightData = null;
        this.lightMats = {};

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
        this.tblocks = null;
        this.isLive = true;

        this.id = [
            this.addr.x,
            this.addr.y,
            this.addr.z,
            this.size.x,
            this.size.y,
            this.size.z
        ].join('_');

        // Run webworker method
        this.modify_list = modify_list || [];
        chunkManager.postWorkerMessage(['createChunk', this]);
        this.modify_list = [];

        // Objects & variables
        this.inited                     = false;
        this.dirty                      = true;
        this.buildVerticesInProgress    = false;
        this.vertices_length            = 0;
        this.vertices                   = new Map();
        this.fluid_blocks               = [];
        this.gravity_blocks             = [];
        // Frustum
        this.in_frustum                 = false; // в данный момент отрисован на экране

        chunkManager.addToDirty(this);

    }

    // onBlocksGenerated ... Webworker callback method
    onBlocksGenerated(args) {
        this.tblocks            = new TypedBlocks();
        this.tblocks.count      = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
        this.tblocks.buffer     = args.tblocks.buffer;
        this.tblocks.light_buffer     = args.tblocks.light_buffer;
        this.tblocks.id         = new Uint16Array(this.tblocks.buffer, 0, this.tblocks.count);
        this.tblocks.light_source = new Uint8Array(this.tblocks.light_buffer, 0, this.tblocks.count);
        this.tblocks.power      = new VectorCollector(args.tblocks.power.list);
        this.tblocks.rotate     = new VectorCollector(args.tblocks.rotate.list);
        this.tblocks.entity_id  = new VectorCollector(args.tblocks.entity_id.list);
        this.tblocks.texture    = new VectorCollector(args.tblocks.texture.list);
        this.tblocks.extra_data = new VectorCollector(args.tblocks.extra_data.list);
        this.tblocks.vertices   = new VectorCollector(args.tblocks.vertices.list);
        this.tblocks.shapes     = new VectorCollector(args.tblocks.shapes.list);
        this.tblocks.falling    = new VectorCollector(args.tblocks.falling.list);
        this.inited = true;

        this.getChunkManager().postLightWorkerMessage(['createChunk',
            {addr: this.addr, size: this.size, light_buffer: this.tblocks.light_buffer}]);
    }

    // onVerticesGenerated ... Webworker callback method
    onVerticesGenerated(args) {
        this.vertices_args = args;
        this.need_apply_vertices = true;
        if(!this.map) {
            this.map = args.map;
        }
        //args.lightmap
    }

    onLightGenerated(args) {
        this.lightData = args.lightmap_buffer ? new Uint8Array(args.lightmap_buffer) : null;
        if (this.lightTex !== null) {
            this.lightTex.update(this.lightData)
        }
    }

    drawBufferGroup(render, group, mat) {
        if(this.vertices.has(group)) {
            let vgroup = this.vertices.get(group);
            if(vgroup.buffer) {
                if (this.lightData) {
                    if (!this.lightTex) {
                        this.lightTex = render.createTexture3D({
                            width: this.size.x + 4,
                            height: this.size.z + 4,
                            depth: this.size.y + 4,
                            type: 'u8',
                            filter: 'linear',
                            data: this.lightData
                        })
                    }
                    if (!this.lightMats[group]) {
                        this.lightMats[group] = mat.getLightMat(this.lightTex)
                    }
                    render.drawMesh(vgroup.buffer, this.lightMats[group], this.coord);
                } else {
                    render.drawMesh(vgroup.buffer, mat, this.coord);
                }
                return true;
            }
        }
        return false;
    }

    // Apply vertices
    applyVertices() {
        let chunkManager = this.getChunkManager();
        const args = this.vertices_args;
        delete(this['vertices_args']);
        this.need_apply_vertices = false;
        chunkManager.deleteFromDirty(this.key);
        this.buildVerticesInProgress            = false;
        chunkManager.vertices_length_total -= this.vertices_length;
        this.vertices_length                    = 0;
        this.gravity_blocks                     = args.gravity_blocks;
        this.fluid_blocks                       = args.fluid_blocks;
        // Delete old WebGL buffers
        for(let [key, v] of this.vertices) {
            if(v.buffer) {
                v.buffer.destroy();
            }
            this.vertices.delete(key);
        }
        // Добавление чанка в отрисовщик
        for(let key of Object.keys(args.vertices)) {
            let v = args.vertices[key];
            if(v.list.length > 0) {
                this.vertices_length  += v.list.length / GeometryTerrain.strideFloats;
                v.buffer              = new GeometryTerrain(v.list);
                this.vertices.set(key, v);
                delete(v.list);
            }
        }
        if(this.vertices_length == 0) {
            // @todo
        }
        chunkManager.vertices_length_total += this.vertices_length;
        this.dirty                 = false;
        this.timers                = args.timers;
    }

    // destruct chunk
    destruct() {
        if(this.buffer) {
            this.buffer.destroy();
        }
        if (this.lightTex) {
            this.lightTex.destroy();
        }
        // Run webworker method
        this.getChunkManager().postWorkerMessage(['destructChunk', {key: this.key, addr: this.addr}]);
        this.getChunkManager().postLightWorkerMessage(['destructChunk', {key: this.key, addr: this.addr}]);
    }

    // buildVertices
    buildVertices() {
        if(this.buildVerticesInProgress) {
            return;
        }
        this.buildVerticesInProgress = true;
        // Run webworker method
        this.getChunkManager().postWorkerMessage(['buildVertices', {keys: [this.key], addrs: [this.addr]}]);
        return true;
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(x, y, z) {
        if(!this.inited) {
            return this.getChunkManager().DUMMY;
        }
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        if(x < 0 || y < 0 || z < 0 || x >= this.size.x || y >= this.size.y || z >= this.size.z) {
            return this.getChunkManager().DUMMY;
        }
        let block = this.tblocks.get(new Vector(x, y, z));
        /*if(!block) {
            return this.getChunkManager().AIR;
        }*/
        return block;
    }

    // setBlock
    setBlock(x, y, z, item, is_modify, power, rotate, entity_id, extra_data) {
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
        let chunkManager = this.getChunkManager();
        //
        if(!is_modify) {
            let material = BLOCK.BLOCK_BY_ID.get(item.id);
            let pos = new Vector(x, y, z);
            this.tblocks.delete(pos);
            let tblock           = this.tblocks.get(pos);
            tblock.id            = material.id;
            tblock.extra_data    = extra_data;
            tblock.entity_id     = entity_id;
            tblock.power         = power;
            tblock.rotate        = rotate;
            tblock.falling       = !!material.gravity;
            //
            update_vertices         = true;
        }
        // Run webworker method
        if(update_vertices) {
            let set_block_list = [];
            set_block_list.push({
                key:        this.key,
                addr:       this.addr,
                x:          x + this.coord.x,
                y:          y + this.coord.y,
                z:          z + this.coord.z,
                type:       item,
                is_modify:  is_modify,
                power:      power,
                rotate:     rotate,
                extra_data: extra_data
            });
            // Принудительная перерисовка соседних чанков
            let update_neighbours = [];
            if(x == 0) update_neighbours.push(new Vector(-1, 0, 0));
            if(x == this.size.x - 1) update_neighbours.push(new Vector(1, 0, 0));
            if(y == 0) update_neighbours.push(new Vector(0, -1, 0));
            if(y == this.size.y - 1) update_neighbours.push(new Vector(0, 1, 0));
            if(z == 0) update_neighbours.push(new Vector(0, 0, -1));
            if(z == this.size.z - 1) update_neighbours.push(new Vector(0, 0, 1));
            // diagonal
            if(x == 0 && z == 0) update_neighbours.push(new Vector(-1, 0, -1));
            if(x == this.size.x - 1 && z == 0) update_neighbours.push(new Vector(1, 0, -1));
            if(x == 0 && z == this.size.z - 1) update_neighbours.push(new Vector(-1, 0, 1));
            if(x == this.size.x - 1 && z == this.size.z - 1) update_neighbours.push(new Vector(1, 0, 1));
            // Добавляем выше и ниже
            let update_neighbours2 = [];
            for(var update_neighbor of update_neighbours) {
                update_neighbours2.push(update_neighbor.add(new Vector(0, -1, 0)));
                update_neighbours2.push(update_neighbor.add(new Vector(0, 1, 0)));
            }
            update_neighbours.push(...update_neighbours2);
            let updated_chunks = [this.key];
            for(var update_neighbor of update_neighbours) {
                let pos = new Vector(x, y, z).add(this.coord).add(update_neighbor);
                let chunk_addr = getChunkAddr(pos);
                let key = chunkManager.getPosChunkKey(chunk_addr);
                // чтобы не обновлять один и тот же чанк дважды
                if(updated_chunks.indexOf(key) < 0) {
                    updated_chunks.push(key);
                    set_block_list.push({
                        key:        key,
                        addr:       chunk_addr,
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
            chunkManager.postWorkerMessage(['setBlock', set_block_list]);
        }
    }

    //
    updateInFrustum(render) {
        if(!this.frustum_geometry) {
            this.frustum_geometry = Chunk.createFrustumGeometry(this.coord, this.size);
        }
        this.in_frustum = render.frustum.intersectsGeometryArray(this.frustum_geometry);
    }

    //
    static createFrustumGeometry(coord, size) {
        let frustum_geometry    = [];
        let box_radius          = size.x;
        let sphere_radius       = Math.sqrt(3) * box_radius / 2;
        frustum_geometry.push(new Sphere(coord.add(new Vector(size.x / 2, size.y / 4, size.z / 2)), sphere_radius));
        frustum_geometry.push(new Sphere(coord.add(new Vector(size.x / 2, size.y - size.y / 4, size.z / 2)), sphere_radius));
        return frustum_geometry;
    }

}
