import {Color, QUAD_FLAGS, Vector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import { NetworkPhysicObject } from '../network_physic_object.js';

const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

class FakeTBlock {

    constructor(id) {
        this.id = id;
        this.offset = null;
        /**
         * @type {FakeTBlock}
         */
        this.next = null;

        if (this.material.next_part) {
            const {
                id, offset_pos
            } = this.material.next_part;

            this.next = new FakeTBlock(id);
            this.next.offset = new Vector(offset_pos);
        }
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

        if(!Particles_Block_Drop.neighbours) {
            let air = new FakeTBlock(BLOCK.AIR.id);
            Particles_Block_Drop.neighbours = {
                UP:     air,
                DOWN:   air,
                NORTH:  air,
                SOUTH:  air,
                WEST:   air,
                EAST:   air
            };
        }

        this.scale          = new Vector(.2, .2, .2);
        this.pn             = performance.now() + Math.random() * 2000; // рандом, чтобы одновременно сгенерированные дропы крутились не одинаково
        this.life           = 1.0;
        this.posFact        = this.pos.clone();
        this.addY           = 0;
        this.vertices       = [];
        this.block          = new FakeTBlock(block.id);
        this.block_material = this.block.material;
        this.parts          = 0;

        let b               = this.block;
        
        const isDoor        = this.block_material.tags.indexOf('door') > -1;
        const resource_pack = b.material.resource_pack
        const draw_style    = b.material.inventory_style
            ? b.material.inventory_style 
            : b.material.style;

        let yBaseOffset = 1;
        // calc how many parts is exist
        for(let ib = b; !!ib; ib = ib.next) {
            this.parts ++;
            if(ib.offset)
                yBaseOffset += ib.offset.y;
        }

        this.material = resource_pack.getMaterial(b.material.material_key);
        this.buffer = Particles_Block_Drop.buffer_cache.get(block.id);

        if(!this.buffer) {
            let x = -.5;
            let y = - yBaseOffset / 2;
            let z = isDoor ? -1 : -.5;

            if (draw_style ==='extruder') {
                x = y = z = 0;
            } 

            while(b) {
                if(b.offset) {
                    x += b.offset.x;
                    y += b.offset.y;
                    z += b.offset.z;
                }

                resource_pack.pushVertices(
                    this.vertices,
                    b,
                    FakeWorld,
                    x,
                    y,
                    z,
                    Particles_Block_Drop.neighbours,
                    biome,
                    draw_style
                );

                b = b.next;
            }

            this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
            this.buffer.changeFlags(QUAD_FLAGS.NO_AO, 'or');

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

        this.posFact.set(this.pos.x, this.pos.y + (this.parts / 2) * this.scale.x, this.pos.z);
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
