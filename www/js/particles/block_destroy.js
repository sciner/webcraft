import {TX_CNT, DIRECTION, NORMALS, Vector, Color} from '../helpers.js';
import {BLOCK} from '../blocks.js';
import {push_plane, QUAD_FLAGS, MULTIPLY} from '../blocks_func.js';
import GeometryTerrain from "../geometry_terrain.js";

const {mat4} = glMatrix;

export default class Particles_Block_Destroy {

    // Constructor
    constructor(render, block, pos) {
        let chunk_pos   = Game.world.chunkManager.getChunkPos(pos.x, pos.y, pos.z);
        let chunk       = Game.world.chunkManager.getChunk(chunk_pos);
        if(!chunk.map) {
            debugger;
        }
        let cell        = chunk.map.cells[pos.x - chunk.coord.x][pos.z - chunk.coord.z];
        this.yaw        = -Game.world.localPlayer.angles[2];
        this.life       = .5;
        let lm          = MULTIPLY.COLOR.WHITE;
        let n           = NORMALS.UP; // normal for lithning
        this.texture    = BLOCK.fromId(block.id).texture;
        let flags       = 0;
        let sideFlags   = 0;
        let upFlags     = QUAD_FLAGS.NORMAL_UP;
        if(typeof this.texture != 'function') {
            this.life = 0;
            return;
        }
        if([BLOCK.DIRT.id, BLOCK.GRASS.id].indexOf(block.id) >= 0) {
            lm          = cell.biome.dirt_color;
            sideFlags   = QUAD_FLAGS.MASK_BIOME;
        }
        let c           = BLOCK.calcTexture(this.texture(this, null, 1, null, null, null, DIRECTION.FORWARD)); // полная текстура
        this.pos        = new Vector(
            pos.x + .5 - Math.cos(this.yaw + Math.PI / 2) * .5,
            pos.y + .5,
            pos.z + .5 - Math.sin(this.yaw + Math.PI / 2) * .5
        );
        this.vertices   = [];
        this.particles  = [];
        //
        for(let i = 0; i < 30; i++) {
            const sz        = Math.random() * (3 / 16) + 1 / 16; // часть текстуры
            const half      = sz / TX_CNT;
            // random tex coord (случайная позиция в текстуре)
            let cx = c[0] + Math.random() * (half * 3);
            let cy = c[1] + Math.random() * (half * 3);
            let c_half = [cx - c[2] / 2 + half / 2, cy - c[3] / 2 + half / 2, half, half];
            // случайная позиция частицы (в границах блока)
            let x = (Math.random() - Math.random()) * .5;
            let y = (Math.random() - Math.random()) * .5;
            let z = (Math.random() - Math.random()) * .5;
            push_plane(this.vertices, x, y, z, c_half, lm, n, true, false, sz, sz, null, flags | upFlags | sideFlags);
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
        let a_pos = new Vector(this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y - Game.shift.y);
        render.renderBackend.drawMesh(this.buffer, render.materials.doubleface, a_pos, this.modelMatrix);
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
