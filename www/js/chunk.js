import {Vector, VectorCollector} from "./helpers.js";
import GeometryTerrain from "./geometry_terrain.js";
import {TypedBlocks} from "./typed_blocks.js";
import {Sphere} from "./frustum.js";
import {BLOCK} from "./blocks.js";

export const CHUNK_SIZE_X                   = 16;
export const CHUNK_SIZE_Y                   = 40;
export const CHUNK_SIZE_Z                   = 16;
export const CHUNK_BLOCKS                   = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
export const CHUNK_SIZE_Y_MAX               = 4096;
export const MAX_CAVES_LEVEL                = 256;
export const ALLOW_NEGATIVE_Y               = true;

// Возвращает адрес чанка по глобальным абсолютным координатам
export function getChunkAddr(x, y, z, v = null) {
    if(x instanceof Vector || typeof x == 'object') {
        v = y;

        y = x.y;
        z = x.z;
        x = x.x;
    }
    //
    v = v || new Vector();
    v.x = Math.floor(x / CHUNK_SIZE_X);
    v.y = Math.floor(y / CHUNK_SIZE_Y);
    v.z = Math.floor(z / CHUNK_SIZE_Z);
    // Fix negative zero
    if(v.x == 0) {v.x = 0;}
    if(v.y == 0) {v.y = 0;}
    if(v.z == 0) {v.z = 0;}
    return v;
}

/**
 * Возвращает мировые координаты самого чанка
 */
export function getChunkWorldCoord(x, y, z, v = null) {
    const out = getChunkAddr(x, y, z, v);
    out.x *= CHUNK_SIZE_X;
    out.y *= CHUNK_SIZE_Y;
    out.z *= CHUNK_SIZE_Z;
    return out;
}

/**
 * Возвращает локальные координаты относительно чанка
 */
export function getLocalChunkCoord(x, y, z, target = null) {
    const out = getChunkWorldCoord(x, y, z, target);

    if(x instanceof Vector) {
        y = x.y;
        z = x.z;
        x = x.x;
    }

    out.x = x - out.x;
    out.y = y - out.y;
    out.z = z - out.z;

    return out;
}

// Creates a new chunk
export class Chunk {

    getChunkManager() {
        return this.chunkManager;
    }

    constructor(addr, modify_list, chunkManager) {

        this.addr       = new Vector(addr); // относительные координаты чанка
        this.key        = this.addr.toChunkKey();
        this.size       = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z); // размеры чанка
        this.coord      = this.addr.mul(this.size);
        this.seed       = chunkManager.world.info.seed;
        this.tblocks    = null;
        this.id         = this.addr.toHash();

        // Run webworker method
        this.modify_list = modify_list || [];
        chunkManager.postWorkerMessage(['createChunk', this]);
        this.modify_list = [];

        // Light
        this.lightTex = null;
        this.lightData = null;
        this.lightMats = {};

        // Objects & variables
        this.inited                     = false;
        this.dirty                      = true;
        this.buildVerticesInProgress    = false;
        this.vertices_length            = 0;
        this.vertices                   = new Map();
        this.fluid_blocks               = [];
        this.gravity_blocks             = [];
        this.in_frustum                 = false; // в данный момент отрисован на экране
        this.rendered                   = 0;
        // save ref on chunk manager
        // strictly after post message, for avoid crash
        this.chunkManager               = chunkManager;

    }

    // onBlocksGenerated ... Webworker callback method
    onBlocksGenerated(args) {
        this.tblocks            = new TypedBlocks(this.coord);
        this.tblocks.count      = CHUNK_BLOCKS;
        this.tblocks.buffer     = args.tblocks.buffer;
        this.tblocks.id         = new Uint16Array(this.tblocks.buffer, 0, this.tblocks.count);
        this.tblocks.power      = new VectorCollector(args.tblocks.power.list);
        this.tblocks.rotate     = new VectorCollector(args.tblocks.rotate.list);
        this.tblocks.entity_id  = new VectorCollector(args.tblocks.entity_id.list);
        this.tblocks.texture    = new VectorCollector(args.tblocks.texture.list);
        this.tblocks.extra_data = new VectorCollector(args.tblocks.extra_data.list);
        this.tblocks.vertices   = new VectorCollector(args.tblocks.vertices.list);
        this.tblocks.shapes     = new VectorCollector(args.tblocks.shapes.list);
        this.tblocks.falling    = new VectorCollector(args.tblocks.falling.list);
        this.inited = true;
        this.initLights();
    }

    // onVerticesGenerated ... Webworker callback method
    onVerticesGenerated(args) {
        this.vertices_args = args;
        this.need_apply_vertices = true;
        if(!this.dirt_colors) {
            this.dirt_colors = args.dirt_colors;
        }
        if(!this.map) {
            this.map = args.map;
        }
    }

    onLightGenerated(args) {
        this.lightData = args.lightmap_buffer ? new Uint8Array(args.lightmap_buffer) : null;
        if (this.lightTex !== null) {
            this.lightTex.update(this.lightData)
        }
    }

    initLights() {
        const { size } = this;
        const sz = size.x * size.y * size.z;
        const light_buffer = this.light_buffer = new ArrayBuffer(sz);
        const light_source = this.light_source = new Uint8Array(light_buffer);
        const ids = this.tblocks.id;

        let ind = 0;
        let prev_block_id = Infinity;
        let light_power_number = 0;
        let blocks_count = size.x * size.y * size.z;
        let block_material = null;
        for(let i = 0; i < blocks_count; i++) {
            const block_id = ids[ind];
            if(block_id != prev_block_id) {
                block_material = BLOCK.BLOCK_BY_ID.get(block_id)
                if(block_material) {
                    light_power_number = block_material.light_power_number;
                } else {
                    console.error('Block not found', block_id);
                }
                prev_block_id = block_id;
            }
            light_source[ind] = light_power_number;
            ind++;
        }
        this.getChunkManager().postLightWorkerMessage(['createChunk',
            {addr: this.addr, size: this.size, light_buffer}]);
    }

    getLightTexture(render) {
        if (!this.lightData) {
            return null;
        }

        if (!this.lightTex) {
            const lightTex = this.lightTex = render.createTexture3D({
                width: this.size.x + 2,
                height: this.size.z + 2,
                depth: (this.size.y + 2) * 2,
                type: 'rgba8unorm',
                filter: 'linear',
                data: this.lightData
            })
            this.getChunkManager().lightmap_bytes += lightTex.depth * lightTex.width * lightTex.height * 4;
            this.getChunkManager().lightmap_count ++;
        }

        return this.lightTex;
    }

    drawBufferVertices(render, resource_pack, group, mat, vertices) {
        const v = vertices, key = v.key;
        let texMat = resource_pack.materials.get(key);
        if (!texMat) {
            texMat = mat.getSubMat(resource_pack.getTexture(v.texture_id).texture);
            resource_pack.materials.set(key, texMat);
        }
        if (this.lightData) {
            this.getLightTexture(render);

            if (!this.lightMats[key]) {
                this.lightMats[key] = texMat.getLightMat(this.lightTex)
            }

            render.drawMesh(v.buffer, this.lightMats[key], this.coord);
        } else {
            render.drawMesh(v.buffer, texMat, this.coord);
        }
        return true;
    }

    drawBufferGroup(render, resource_pack, group, mat) {
        let drawed = false;
        for(let [key, v] of this.vertices) {
            if(v.resource_pack_id == resource_pack.id && v.material_group == group) {
                if(!v.buffer) {
                    continue;
                }
                const flag = this.drawBufferVertices(render, resource_pack, group, mat, v);
                drawed = drawed || flag;
            }
        }
        return drawed;
    }

    // Apply vertices
    applyVertices() {
        let chunkManager = this.getChunkManager();
        const args = this.vertices_args;
        delete(this['vertices_args']);
        this.need_apply_vertices = false;
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
        for(let [key, v] of Object.entries(args.vertices)) {
            if(v.list.length > 0) {
                let temp = key.split('/');
                this.vertices_length  += v.list.length / GeometryTerrain.strideFloats;
                v.buffer              = new GeometryTerrain(v.list);
                v.resource_pack_id    = temp[0];
                v.material_group      = temp[1];
                v.texture_id          = temp[2];
                v.key = key;
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
        const { lightTex } = this;
        if (lightTex) {
            this.getChunkManager().lightmap_bytes -= lightTex.depth * lightTex.width * lightTex.height * 4;
            this.getChunkManager().lightmap_count --;
            lightTex.destroy();
        }
        this.buffer = null;
        this.lightTex = null;
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
            const oldLight = this.light_source[tblock.index];
            const light = this.light_source[tblock.index] = BLOCK.getLightPower(material);
            update_vertices         = true;
            if (oldLight !== light) {
                // updating light here
                // const sy = (this.size.x + 2) * (this.size.z + 2), sx = 1, sz = this.size.x + 2;
                // const iy = this.size.x * this.size.z, ix = 1, iz = this.size.x;
                // const innerCoord = pos.x * ix + pos.y * iy + pos.z * iz;
                // const outerCoord = (pos.x + 1) * sx + (pos.y + 1) * sy + (pos.z + 1) * sz;
                chunkManager.postLightWorkerMessage(['setBlock', { addr: this.addr,
                    x:          x + this.coord.x,
                    y:          y + this.coord.y,
                    z:          z + this.coord.z,
                    light_source: light}]);
            }
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
            for(var update_neighbour of update_neighbours) {
                update_neighbours2.push(update_neighbour.add(new Vector(0, -1, 0)));
                update_neighbours2.push(update_neighbour.add(new Vector(0, 1, 0)));
            }
            update_neighbours.push(...update_neighbours2);
            let updated_chunks = [this.key];
            for(var update_neighbour of update_neighbours) {
                let pos = new Vector(x, y, z).add(this.coord).add(update_neighbour);
                let chunk_addr = getChunkAddr(pos);
                let key = chunk_addr.toChunkKey();
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
