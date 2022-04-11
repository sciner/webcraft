import { Color, DIRECTION, QUAD_FLAGS, TX_CNT, Vector } from '../helpers.js';
import { default as push_plane_style } from '../block_style/plane.js';
import GeometryTerrain from "../geometry_terrain.js";
import { BLOCK } from "../blocks.js";

const push_plane = push_plane_style.getRegInfo().func;

/**
 * Draw rain over player
 * @class Particles_Raindrop
 * @param {Renderer} gl Renderer
 * @param {Vector} pos Player position
 */
export default class Particles_Raindrop {

    constructor(gl, pos) {

        const RAIN_X = 18;      // количество блоков по x на которые льет дождь
        const RAIN_Y = 18;      // количество блоков высоты дождя
        const RAIN_Z = 18;      // количество блоков по z на которые льет дождь
        const LENGTH_Y = 2;     // плотность дождя по высоте, не должно быть больше RAIN_Y
        const RAIN_COUNT = 500; // rain density
        const RAIN_SPEED = 0.4; // rain speed

        let vertices = [];
        let map = [];
        let b = BLOCK.STILL_WATER;
        let texture = b.texture;
        let c = BLOCK.calcTexture(texture, DIRECTION.FORWARD);
        let lm = new Color(0, 0, 0, 0);

        this.speed = RAIN_SPEED;
        this.life = LENGTH_Y / (100.0 * this.speed);
        this.pos = new Vector(pos.x, pos.y, pos.z);

        // Heightmap
        for (let i = 0; i <= RAIN_X; ++i) {
            map[i] = [];
            for (let j = 0; j <= RAIN_Z; ++j) {
                for (let p = RAIN_Y; p > 0; --p) {
                    let block = Game.world.getBlock(Math.floor(this.pos.x + i - RAIN_X / 2.0), p + Math.floor(this.pos.y), Math.floor(this.pos.z + j - RAIN_Z / 2.0));
                    if (block.id > 0) {
                        if ((block.material.material.id == 'leaves') && (Math.random() < 0.2)) {
                            continue;
                        }
                        map[i][j] = p;
                        break;
                    }
                }
            }
        }

        for (let i = 0; i < RAIN_COUNT; i++) {
            const sz = Math.random() * (2 / 16) + 1 / 16; // part of texture
            const half = sz / TX_CNT;
            // random position im texture
            let cx = c[0] + Math.random() * (half * 3);
            let cy = c[1] + Math.random() * (half * 3);
            let c_half = [cx - c[2] / 2 + half / 2, cy - c[3] / 2 + half / 2, half, half];
            // random particle position
            let x = Math.random() * RAIN_X;
            let z = Math.random() * RAIN_Z;
            let ix = Math.round(x);
            let iz = Math.round(z);
            let y = 100;
            if (!map[ix][iz]) {
                y = Math.random() * (RAIN_Y - LENGTH_Y) + LENGTH_Y;
            } else {
                y = Math.random() * LENGTH_Y + LENGTH_Y + map[ix][iz] + 1;
            }
            if (Math.random() < 0.5) {
                push_plane(vertices, x - RAIN_X / 2.0, y, z - RAIN_Z / 2.0, c_half, lm, true, false, sz / 20, sz, null, QUAD_FLAGS.NORMAL_UP);
            } else {
                push_plane(vertices, x - RAIN_X / 2.0, y, z - RAIN_Z / 2.0, c_half, lm, false, false, null, sz, sz / 20, QUAD_FLAGS.NORMAL_UP);
            }
        }

        this.buffer = new GeometryTerrain(new Float32Array(vertices));
        this.resource_pack = b.resource_pack
        this.material = this.resource_pack.getMaterial(b.material_key);
    }

    /**
     * Draw particles
     * @param {Renderer} render Renderer
     * @param {float} delta Delta time from previous call
     * @memberOf Particles_Raindrop
     */
    draw(render, delta) {
        delta *= 25;
        this.life -= delta / 100000;
        delta /= 1000;
        this.pos.y -= delta * this.speed;
        render.renderBackend.drawMesh(this.buffer, this.material, this.pos, this.modelMatrix);
    }

    /**
     * Destructor
     * @memberOf Particles_Raindrop
     */
    destroy(render) {
        this.buffer.destroy();
    }

    /**
     * Check particle status
     * @return {boolean}
     * @memberOf Particles_Raindrop
     */
    isAlive() {
        return this.life > 0;
    }

}