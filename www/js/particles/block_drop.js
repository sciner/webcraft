import {Vector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";

const {mat4} = glMatrix;

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

export default class Particles_Block_Drop {

    static neighbours = null;

    // Constructor
    constructor(gl, block, pos) {

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
        this.pn         = performance.now();
        this.life       = 1.0;
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.posFact    = this.pos.clone();
        this.addY       = 0;
        this.vertices   = [];

        let b = new FakeTBlock(block.id);
        this.block_material = b.material;

        // const chunk = Game.world.chunkManager.getChunk(Game.player.chunkAddr);
        // const biome = chunk.map.cells[0][0].biome;

        this.resource_pack = b.material.resource_pack
        this.material = this.resource_pack.getMaterial(b.material.material_key);

        let x = -.5, y = -.5, z = -.5;
        this.resource_pack.pushVertices(
            this.vertices,
            b, // UNSAFE! If you need unique block, use clone
            FakeWorld,
            x,
            y,
            z,
            Particles_Block_Drop.neighbours,
            null
        );

        this.modelMatrix = mat4.create();
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.swapYZ().toArray());
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
    }

    // Draw
    draw(render, delta) {
        delta /= 1000;
        this.posFact.set(this.pos.x, this.pos.y, this.pos.z);
        this.addY += delta;
        this.posFact.y += Math.sin(this.addY / 35) / Math.PI * .2;
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, delta / 60);
        render.renderBackend.drawMesh(this.buffer, this.material, this.posFact, this.modelMatrix);
    }

    destroy() {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
