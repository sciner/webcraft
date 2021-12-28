import {Color, Vector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import { NetworkPhysicObject } from '../network_physic_object.js';

const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

class FakeTBlock {

    constructor(id) {this.id = id;}

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

        this.scale      = new Vector(.2, .2, .2);
        this.pn         = performance.now() + Math.random() * 2000;
        this.life       = 1.0;
        this.posFact    = this.pos.clone();
        this.addY       = 0;
        this.vertices   = [];
        this.block      = new FakeTBlock(block.id);

        let b           = this.block;
        this.block_material = b.material;

        this.resource_pack = b.material.resource_pack
        this.material = this.resource_pack.getMaterial(b.material.material_key);

        let x = -.5, y = -.5, z = -.5;
        let draw_style = b.material.inventory_style ? b.material.inventory_style :  b.material.style;
        this.resource_pack.pushVertices(
            this.vertices,
            b, // UNSAFE! If you need unique block, use clone
            FakeWorld,
            x,
            y,
            z,
            Particles_Block_Drop.neighbours,
            biome,
            draw_style
        );

        this.modelMatrix = mat4.create();
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.swapYZ().toArray());

        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
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

        this.posFact.set(this.pos.x, this.pos.y, this.pos.z);
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

        
        // not working yet
        //this.material.lightTex = this.lightTex;

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.chunk.coord,
            this.modelMatrix
        );

        //this.material.lightTex = null;
    }

    /**
     * Push draw task directly without any pre-computation.
     * Any matrix updates should be applied manually
     * Allow prepend matrix to modelMatrix
     * @param {Rendere} render 
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
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
