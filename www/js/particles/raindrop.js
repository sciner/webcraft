import { Color, DIRECTION, QUAD_FLAGS, TX_CNT, Vector } from '../helpers.js';
import { default as push_plane_style } from '../block_style/plane.js';
import GeometryTerrain from "../geometry_terrain.js";
import { BLOCK } from "../blocks.js";

const push_plane = push_plane_style.getRegInfo().func;

export default class Particles_Raindrop {
    // Constructor
    constructor(gl, pos) {
        const RAIN_X = 10;
        const RAIN_Y = 12;
        const RAIN_Z = 10;

        this.yaw = 0;//-Game.player.rotate.z;
        this.life = 0.5;
        this.pos = new Vector(pos.x, pos.y, pos.z);
        let lm = new Color(0, 0, 0, 0);
        const b = BLOCK.STILL_WATER;
        this.texture = b.texture;
        let c = BLOCK.calcTexture(this.texture, DIRECTION.FORWARD); // полная текстура
        this.vertices = [];
        this.particles = [];
        this.map = []

        //карта высот
        for (let i = 0; i <= RAIN_X; ++i) {
            this.map[i] = [];
            for (let j = 0; j <= RAIN_Z; ++j) {
                for (let p = RAIN_Y; p > 0; --p) {
                    let block = Game.world.getBlock(parseInt(this.pos.x + i - RAIN_X / 2.0), p, parseInt(this.pos.z + j - RAIN_Z / 2.0));
                    if (block.id > 0) {
                        this.map[i][j] = p;
                        break;
                    }
                }
            }
        }

        for (let i = 0; i < 5000; i++) {
            const sz = Math.random() * (2 / 16) + 1 / 16; // часть текстуры
            const half = sz / TX_CNT;
            // случайная позиция в текстуре
            let cx = c[0] + Math.random() * (half * 3);
            let cy = c[1] + Math.random() * (half * 3);
            let c_half = [cx - c[2] / 2 + half / 2, cy - c[3] / 2 + half / 2, half, half];
            // случайная позиция частицы (в границах блока)
            let x = Math.random() * RAIN_X;
            let z = Math.random() * RAIN_Z;
            let ix = Math.round(x - 0.5);
            let iz = Math.round(z);
            let y = RAIN_Y;
            if (!this.map[ix][iz])
                y = Math.random() * RAIN_Y;
            else
                y = Math.random() + this.map[ix][iz] + 20;
            
            push_plane(this.vertices, x - RAIN_X / 2.0, y, z - RAIN_Z / 2.0, c_half, lm, true, false, sz / 5, sz, null, QUAD_FLAGS.NORMAL_UP);
        }

        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
        this.resource_pack = b.resource_pack
        this.material = this.resource_pack.getMaterial(b.material_key);
    }

    // Draw
    draw(render, delta) {
        let gl = render.gl;
        this.life -= delta / 100000;
        delta /= 1000;
        this.pos.y += delta * -.40;
        render.renderBackend.drawMesh(this.buffer, this.material, this.pos, this.modelMatrix);
    }

    destroy(render) {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}