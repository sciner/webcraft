import {Color, DIRECTION, QUAD_FLAGS, TX_CNT, Vector} from '../helpers.js';
import { default as push_plane_style } from '../block_style/plane.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";

const push_plane = push_plane_style.getRegInfo().func;
const {mat4} = glMatrix;

export default class Particles_Raindrop {

    // Constructor
    constructor(gl, pos) {
        this.yaw        = -Game.player.rotate.z;
        this.life       = 0.5;
        let lm          = new Color(0, 0, 0, 0);
        const b         = BLOCK.STILL_WATER;
        this.texture    = b.texture;
        let c           = BLOCK.calcTexture(this.texture, DIRECTION.FORWARD); // полная текстура
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.vertices   = [];
        this.particles  = [];
        //
        for(let i = 0; i < 100; i++) {
            const sz        = Math.random() * (2 / 16) + 1 / 16; // часть текстуры
            const half      = sz / TX_CNT;
            // случайная позиция в текстуре
            let cx = c[0] + Math.random() * (half * 3);
            let cy = c[1] + Math.random() * (half * 3);
            let c_half = [cx - c[2]/2 + half/2, cy - c[3]/2 + half/2, half, half];
            // случайная позиция частицы (в границах блока)
            let x = (Math.random() - Math.random()) * 16;
            let y = (Math.random() - Math.random()) * 16;
            let z = (Math.random() - Math.random()) * 16;
            push_plane(this.vertices, x, y, z, c_half, lm, true, false, sz / 3, sz, null, QUAD_FLAGS.NORMAL_UP);
        }
        this.modelMatrix = mat4.create();
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.yaw);
        //
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
        this.resource_pack = b.resource_pack
        this.material = this.resource_pack.getMaterial(b.material_key);
    }

    // Draw
    draw(render, delta) {
        let gl      = render.gl;
        this.life   -= delta / 100000;
        delta       /= 1000;
        this.pos.y  += delta * -.40;
        render.renderBackend.drawMesh(this.buffer, this.material, this.pos, this.modelMatrix);
    }

    destroy(render) {
        this.buffer.destroy();
    }

    isAlive() {
        /*let pos = new Vector(parseInt(this.pos.x), parseInt(this.pos.y), parseInt(this.pos.z));
        let chunk_addr = BLOCK.getChunkAddr(pos.x, pos.y, pos.z);
        let chunk = Game.world.chunkManager.getChunk(chunk_addr);
        if(chunk) {
            if(pos.z < chunk.lightmap[pos.x][pos.y]) {
                this.life = 0;
            }
        }
        */
        return this.life > 0;
    }

}
