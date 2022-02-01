import {Color, QUAD_FLAGS, Vector, VectorCollector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import { AABB } from '../core/AABB.js';

// World
export const FakeWorld = {
    blocks_pushed: 0,
    chunkManager: {
        getBlock: function(x, y, z) {
            return new FakeTBlock(BLOCK.AIR.id);
        }
    }
}

export class FakeTBlock {

    constructor(id) {
        this.id = id;
    }

    get material() {
        return BLOCK.BLOCK_BY_ID.get(this.id);
    }

    get properties() {
        return this.material;
    }

    get extra_data() {
        return this.material.extra_data;
    }

    hasTag(tag) {
        let mat = this.material;
        return mat.tags && mat.tags.indexOf(tag) >= 0;
    }

    getCardinalDirection() {
        return 0;
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

    constructor() {
        this.vc         = new VectorCollector();
        this.meshes     = new Map();
        this.aabb       = new AABB();
        this.multipart  = false;
        this.air_block  = new FakeTBlock(BLOCK.AIR.id);
        this.find_beighbours_pos = new Vector(0, 0, 0);
    }

    // Add block
    addBlock(pos, block) {
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
     * @param {*} tx 
     * @param {*} ty 
     * @param {*} tz 
     * @param {bool} force_inventory_style 
     */
    buildVertices(tx, ty, tz, force_inventory_style) {
        const biome = {
            code:       'GRASSLAND',
            color:      '#98a136',
            dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0),
        };
        for(let k of this.vc.keys()) {
            const item = this.vc.get(k);
            const rp = item.block.material.resource_pack;
            let ds = item.block.material.style;
            if(force_inventory_style && item.block.material.inventory_style) {
                ds = item.block.material.inventory_style;
            }
            const mat_key = item.block.material.material_key;
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
            rp.pushVertices(
                mesh.vertices,
                item.block,
                FakeWorld,
                tx + k.x,
                ty + k.y,
                tz + k.z,
                item.neighbours,
                biome,
                ds
            );
        }

        // Create draw buffers
        this.meshes.forEach((mesh, _, map) => {
            mesh.buffer = new GeometryTerrain(new Float32Array(mesh.vertices));
            mesh.buffer.changeFlags(QUAD_FLAGS.NO_AO, 'or');
        });

    }

    // Draw meshes
    draw(render, pos, matrix, light_texture) {
        this.meshes.forEach((mesh, _, map) => {
            if(light_texture) {
                mesh.material.changeLighTex(light_texture);
            }
            render.renderBackend.drawMesh(
                mesh.buffer,
                mesh.material,
                pos,
                matrix
            );
            if(light_texture) {
                mesh.material.lightTex = null;
                mesh.material.shader.unbind();
            }
        });
    }

    // Destroy buffers
    destroy() {
        this.meshes.forEach((mesh, _, map) => {
            mesh.buffer.destroy();
        });
    }

}