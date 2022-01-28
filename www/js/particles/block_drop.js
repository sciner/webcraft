import {Color, QUAD_FLAGS, Vector, VectorCollector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import { NetworkPhysicObject } from '../network_physic_object.js';
import { AABB } from '../core/AABB.js';

const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

let air_block = null;

let neighbours_map = [
    {side: 'UP', offset: new Vector(0, 1, 0)},
    {side: 'DOWN', offset: new Vector(0, -1, 0)},
    {side: 'NORTH', offset: new Vector(0, 0, 1)},
    {side: 'SOUTH', offset: new Vector(0, 0, -1)},
    {side: 'EAST', offset: new Vector(1, 0, 0)},
    {side: 'WEST', offset: new Vector(-1, 0, 0)}
];

class FakeTBlock {

    constructor(id, next_stop) {
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

// World
const FakeWorld = {
    blocks_pushed: 0,
    chunkManager: {
        getBlock: function(x, y, z) {
            return new FakeTBlock(BLOCK.AIR.id);
        }
    }
}

export default class Particles_Block_Drop extends NetworkPhysicObject {

    static neighbours = null;

    static buffer_cache = new Map();

    // Constructor
    constructor(gl, entity_id, items, pos) {

        super(
            new Vector(pos.x, pos.y, pos.z),
            new Vector(0, 0, 0)
        );

        this.entity_id = entity_id;
        const block = items[0];

        // BIOMES.GRASSLAND
        const biome = {
            code:       'GRASSLAND',
            color:      '#98a136',
            dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0),
        };

        if(!air_block) {
            air_block = new FakeTBlock(BLOCK.AIR.id);
        }

        this.scale          = new Vector(.2, .2, .2);
        this.pn             = performance.now() + Math.random() * 2000; // рандом, чтобы одновременно сгенерированные дропы крутились не одинаково
        this.life           = 1.0;
        this.posFact        = this.pos.clone();
        this.addY           = 0;
        this.vertices       = [];
        this.block          = new FakeTBlock(block.id);
        this.block_material = this.block.material;
        this.multipart      = false;

        const resource_pack = this.block.material.resource_pack
        const draw_style    = this.block.material.inventory_style
            ? this.block.material.inventory_style 
            : this.block.material.style;

        this.material = resource_pack.getMaterial(this.block.material.material_key);
        this.buffer = Particles_Block_Drop.buffer_cache.get(block.id);

        if(this.buffer) {
            this.multipart = this.buffer.multipart;
        } else {

            let x = 0;
            let y = 0;
            let z = 0;

            if (draw_style ==='extruder') {
                x = y = z = 0.5;
            }

            // Blocks collection (like a size free chunk)
            let vc = new VectorCollector();

            // 1. First main block
            vc.set(new Vector(0, 0, 0), {
                block: this.block,
                neighbours: null
            });

            // 2. Add couples block 
            if(this.block.material.style == 'fence' || this.block.material.style == 'wall') {
                vc.set(new Vector(1, 0, 0), {
                    block: new FakeTBlock(block.id),
                    neighbours: null
                });
            }

            // 3. Add all block parts
            let pos = new Vector(0, 0, 0);
            let next_part = this.block.material.next_part
            while(next_part) {
                const next = new FakeTBlock(next_part.id);
                pos = pos.add(next_part.offset_pos);
                vc.set(pos, {
                    block: next,
                    neighbours: null
                });
                next_part = next.material.next_part;
                this.multipart = true;
            }

            // 4. Find all blocks neighbours
            for(let pos of vc.keys()) {
                const item = vc.get(pos);
                item.neighbours = {
                    UP:     air_block,
                    DOWN:   air_block,
                    NORTH:  air_block,
                    SOUTH:  air_block,
                    WEST:   air_block,
                    EAST:   air_block
                };
                for(let n of neighbours_map) {
                    const nb = vc.get(pos.add(n.offset));
                    if(nb) {
                        item.neighbours[n.side] = nb.block;
                    }
                }
            }

            let aabb = new AABB();
            let points = 0;
            // 5. Calculate aabb
            for(let k of vc.keys()) {
                const item = vc.get(k);
                if(points++ == 0) {
                    aabb.set(
                        x + k.x + .5, y + k.y + .5, z + k.z + .5,
                        x + k.x + .5, y + k.y + .5, z + k.z + .5
                    );
                } else {
                    aabb.addPoint(x + k.x + .5, y + k.y + .5, z + k.z + .5);
                }
            }
            aabb.pad(.5);

            if(aabb.y_min < 0) {
                y -= aabb.y_min;
            }

            x -= aabb.width / 2;
            y -= aabb.height / 2;
            z -= aabb.depth / 2;

            // 6. Draw all blocks
            for(let k of vc.keys()) {
                const item = vc.get(k);
                resource_pack.pushVertices(
                    this.vertices,
                    item.block,
                    FakeWorld,
                    x + k.x,
                    y + k.y,
                    z + k.z,
                    item.neighbours,
                    biome,
                    draw_style
                );
            }

            this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
            this.buffer.changeFlags(QUAD_FLAGS.NO_AO, 'or');
            this.buffer.aabb = aabb;
            this.buffer.multipart = this.multipart;

            Particles_Block_Drop.buffer_cache.set(block.id, this.buffer);
        }

        this.modelMatrix = mat4.create();
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.swapYZ().toArray());

        this.lightTex = null;
        this.chunk = null;

    }

    updateLightTex(render) {
        const chunk = render.world.chunkManager.getChunk(this.chunk_addr);

        if (!chunk) {
            return;
        }

        this.chunk = chunk;
        this.lightTex = chunk.getLightTexture(render.renderBackend);
    }

    // Draw
    draw(render, delta) {

        this.update();
        this.updateLightTex(render);

        if(!this.chunk) {
            return;
        }

        // console.log(this.buffer.aabb.width, this.buffer.aabb.height, this.buffer.aabb.depth)
        // this.posFact.set(this.pos.x, this.pos.y + (this.parts / 2) * this.scale.x, this.pos.z);
        this.posFact.set(
            this.pos.x,
            this.pos.y,
            this.pos.z,
        );
        this.addY = (performance.now() - this.pn) / 10;
        this.posFact.y += Math.sin(this.addY / 35) / Math.PI * .2;

        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix, 
            [
                (this.posFact.x - this.chunk.coord.x),
                (this.posFact.z - this.chunk.coord.z),
                (this.posFact.y - this.chunk.coord.y + 3 / 16)
            ]
        );
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.toArray());
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.addY / 60);

        this.material.changeLighTex(this.lightTex);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.chunk.coord,
            this.modelMatrix
        );

        this.material.lightTex = null;
        this.material.shader.unbind();
    }

    /**
     * Push draw task directly without any pre-computation.
     * Any matrix updates should be applied manually
     * Allow prepend matrix to modelMatrix
     * @param {Render} render 
     * @param {mat4} prePendMatrix 
     */
     drawDirectly(render, prePendMatrix = null) {
        if (prePendMatrix) {
            mat4.mul(tmpMatrix, prePendMatrix, this.modelMatrix);
        }

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.pos,
            prePendMatrix ? tmpMatrix : this.modelMatrix
        );
    }

    destroy() {
        // this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
