import {DIRECTION, MULTIPLY, QUAD_FLAGS, TX_CNT, Vector} from '../helpers.js';
import {getChunkAddr} from "../chunk.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import {BLOCK} from "../blocks.js";

const push_plane = push_plane_style.getRegInfo().func;
const {mat4} = glMatrix;

export default class Particles_Block_Destroy {

    // Constructor
    constructor(render, block, pos, small) {
        let chunk_addr  = getChunkAddr(pos.x, pos.y, pos.z);
        let chunk       = Game.world.chunkManager.getChunk(chunk_addr);
        if(!chunk.map) {
            debugger;
            return false;
        }
        let cell        = chunk.map.cells[pos.x - chunk.coord.x][pos.z - chunk.coord.z];
        this.yaw        = -Game.player.rotate.z;
        this.life       = .5;
        let lm          = MULTIPLY.COLOR.WHITE;
        let ao          = [0, 0, 0, 0];
        this.texture    = BLOCK.fromId(block.id).texture;
        let flags       = 0;
        let sideFlags   = 0;
        let upFlags     = QUAD_FLAGS.NORMAL_UP;
        if(typeof this.texture != 'function' && typeof this.texture != 'object' && !(this.texture instanceof Array)) {
            this.life = 0;
            return;
        }
        if([BLOCK.DIRT.id, BLOCK.GRASS.id].indexOf(block.id) >= 0) {
            lm          = cell.biome.dirt_color;
            sideFlags   = QUAD_FLAGS.MASK_BIOME;
        }
        let c           = BLOCK.calcTexture(this.texture, DIRECTION.UP); // полная текстура
        this.pos        = new Vector(
            pos.x + .5 - Math.cos(this.yaw + Math.PI / 2) * .5,
            pos.y + .5,
            pos.z + .5 - Math.sin(this.yaw + Math.PI / 2) * .5
        );
        this.vertices   = [];
        this.particles  = [];
        //
        let count = small ? 5 : 30;
        for(let i = 0; i < count; i++) {
            const max_sz    = small ? .25 / 16 : 3 / 16;
            const sz        = Math.random() * max_sz + 1 / 16; // случайный размер текстуры
            const half      = sz / TX_CNT;
            // random tex coord (случайная позиция в текстуре)
            let cx = c[0] + Math.random() * (half * 3);
            let cy = c[1] + Math.random() * (half * 3);
            let c_half = [
                cx - c[2] / 2 + half / 2,
                cy - c[3] / 2 + half / 2,
                half,
                half
            ];
            // случайная позиция частицы (в границах блока)
            let x = (Math.random() - Math.random()) * .5;
            let y = (Math.random() - Math.random()) * .5;
            let z = (Math.random() - Math.random()) * .5;
            push_plane(this.vertices, x, y, z, c_half, lm, ao, true, false, sz, sz, null, flags | upFlags | sideFlags);
            let p = {
                x:              x,
                y:              y,
                z:              z,
                vertices_count: 12,
                gravity:        .06,
                speed:          .00375
            };
            let d = Math.sqrt(p.x * p.x + p.z * p.z);
            p.x = p.x / d * p.speed;
            p.z = p.z / d * p.speed;
            this.particles.push(p);
        }
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
        this.modelMatrix = mat4.create();
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.yaw);
    }

    // Draw
    draw(render, delta) {
        //
        this.life -= delta / 100000;
        //
        let idx = 0;
        for(let p of this.particles) {
            for(let i = 0; i < p.vertices_count; i++) {
                let j = (idx + i) * GeometryTerrain.strideFloats;
                this.vertices[j + 0] += p.x * delta * p.speed;
                this.vertices[j + 1] += p.z * delta * p.speed;
                this.vertices[j + 2] += (delta / 1000) * p.gravity;
            }
            idx += p.vertices_count;
            p.gravity -= delta / 250000;
        }
        this.buffer.updateInternal(this.vertices);
        render.renderBackend.drawMesh(this.buffer, render.shader.materials.doubleface, this.pos, this.modelMatrix);
    }

    destroy(render) {
        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }
    }

    isAlive() {
        return this.life > 0;
    }

}
