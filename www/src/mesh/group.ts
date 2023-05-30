import {IndexedColor, Vector, VectorCollector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK, FakeTBlock} from "../blocks.js";
import { AABB } from '../core/AABB.js';
import type { BaseResourcePack } from '../base_resource_pack.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { Renderer } from '../render.js';
import type { WebGLMaterial } from '../renders/webgl/WebGLMaterial.js';
import { DEFAULT_GRASS_PALETTE } from '../constant.js';

// Chunk
export const FakeChunk = {
    size: new Vector(16, 40, 16),
    chunkManager: {
        getBlock: function(x : int, y : int, z: int) {
            return new FakeTBlock(BLOCK.AIR.id);
        }
    }
}

let neighbours_map = [
    {side: 'UP', offset: new Vector(0, 1, 0)},
    {side: 'DOWN', offset: new Vector(0, -1, 0)},
    {side: 'NORTH', offset: new Vector(0, 0, 1)},
    {side: 'SOUTH', offset: new Vector(0, 0, -1)},
    {side: 'EAST', offset: new Vector(1, 0, 0)},
    {side: 'WEST', offset: new Vector(-1, 0, 0)}
];

// Mesh group
export class MeshGroup {
    [key: string]: any;
    meshes : Map<string, {
        buffer?:        GeometryTerrain;
        resource_pack:  BaseResourcePack,
        vertices:       any[],
        material:       WebGLMaterial
    }>

    constructor() {
        this.vc         = new VectorCollector();
        this.meshes     = new Map();
        this.aabb       = new AABB();
        this.multipart  = false;
        this.air_block  = new FakeTBlock(BLOCK.AIR.id);
        this.find_beighbours_pos = new Vector(0, 0, 0);
    }

    // Add block
    addBlock(pos : Vector, block) {
        this.vc.set(pos, {
            block: block,
            neighbours: null
        });
    }

    // Run after added all blocks or if need recalculate
    finalize() {
        this.findNeighbours();
        this.calcAABB();
    }

    // Find neighbours for all blocks
    findNeighbours() {
        for(let pos of this.vc.keys()) {
            const item = this.vc.get(pos);
            item.neighbours = {
                UP:     this.air_block,
                DOWN:   this.air_block,
                NORTH:  this.air_block,
                SOUTH:  this.air_block,
                WEST:   this.air_block,
                EAST:   this.air_block
            };
            for(let n of neighbours_map) {
                this.find_beighbours_pos.copyFrom(pos).addSelf(n.offset);
                const nb = this.vc.get(this.find_beighbours_pos);
                if(nb) {
                    item.neighbours[n.side] = nb.block;
                }
            }
        }
    }

    // Calculate aabb
    calcAABB() {
        let points = 0;
        for(let k of this.vc.keys()) {
            if(points++ == 0) {
                this.aabb.set(
                    k.x + .5, k.y + .5, k.z + .5,
                    k.x + .5, k.y + .5, k.z + .5
                );
            } else {
                this.aabb.addPoint(k.x + .5, k.y + .5, k.z + .5);
            }
        }
    }

    /**
     * Build vertices
     */
    buildVertices(tx : number, ty : number, tz : number, force_inventory_style : boolean = false, matrix? : imat4, pivot? : IVector, chunk_size? : Vector) {
        const dirt_color = IndexedColor.GRASS
        const biome = {
            code:           'GRASSLAND',
            color:          '#98a136',
            grass_palette:  DEFAULT_GRASS_PALETTE,
        };
        const pos = new Vector(0, 0, 0);
        for(let k of this.vc.keys()) {
            const item = this.vc.get(k);
            const rp = item.block.material.resource_pack as BaseResourcePack;
            let force_tex = null;
            // Draw style
            let ds = item.block.material.style;
            if(force_inventory_style) {
                if('inventory' in item.block.material) {
                    ds = item.block.material.inventory.style;
                    if('texture' in item.block.material.inventory) {
                        force_tex = item.block.material.inventory.texture;
                    }
                } else if('inventory_style' in item.block.material) {
                    ds = item.block.material.inventory_style;
                }
            }
            let mat_key = item.block.material.material_key;
            if(force_tex && (typeof force_tex == 'object') && ('id' in force_tex)) {
                mat_key = mat_key.split('/');
                mat_key[2] = force_tex.id;
                mat_key = mat_key.join('/');
            }
            //
            let mesh = this.meshes.get(mat_key);
            if(!mesh) {
                mesh = {
                    resource_pack: rp,
                    vertices: [],
                    material: rp.getMaterial(mat_key)
                };
                this.meshes.set(mat_key, mesh);
            }
            //
            pos.set(tx + k.x, ty + k.y, tz + k.z);
            if(chunk_size) {
                FakeChunk.size.copyFrom(chunk_size)
            }
            rp.pushVertices(
                item.block,
                mesh.vertices,
                (FakeChunk as any) as ChunkWorkerChunk,
                pos,
                item.neighbours,
                biome,
                dirt_color,
                undefined,
                matrix,
                pivot,
                force_tex,
                ds
            );
        }

        // Create draw buffers
        this.meshes.forEach((mesh, _, map) => {
            mesh.buffer = new GeometryTerrain(mesh.vertices);
            // mesh.buffer.changeFlags(QUAD_FLAGS.FLAG_NO_CAN_TAKE_AO, 'or');
        });

    }

    // Draw meshes
    draw(render : Renderer, pos : Vector, matrix : imat4) {
        this.meshes.forEach((mesh, _, map) => {
            render.renderBackend.drawMesh(
                mesh.buffer,
                mesh.material,
                pos,
                matrix
            );
        });
    }

    // Destroy buffers
    destroy() {
        this.meshes.forEach((mesh, _, map) => {
            mesh.buffer.destroy();
        });
    }

}