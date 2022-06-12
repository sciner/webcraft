import { Color, Vector, VectorCollector } from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import { BLEND_MODES } from '../renders/BaseRenderer.js';
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { Resources } from '../resources.js';

import glMatrix from "../../vendors/gl-matrix-3.3.min.js";

const {mat4} = glMatrix;

const TARGET_TEXTURES = [.5, .5, 1, .25];
const RAIN_RAD = 5;
const RAIN_SPEED = 3;

/**
 * Draw rain over player
 * @class Particles_Raindrop
 * @param {Renderer} gl Renderer
 * @param {Vector} pos Player position
 */
export default class Particles_Rain {

    #_enabled = false;
    #_map = new VectorCollector();
    #_player_block_pos = new Vector();
    #_version = 0;

    constructor(render, pos) {

        this.life = 1;

        // Material (rain)
        const mat = render.renderBackend.createMaterial({
            cullFace: true,
            opaque: false,
            blendMode: BLEND_MODES.MULTIPLY,
            shader: render.defaultShader,
        });

        // Material
        this.material = mat.getSubMat(render.renderBackend.createTexture({
            source: Resources.weather.rain,
            blendMode: BLEND_MODES.MULTIPLY,
            minFilter: 'nearest',
            magFilter: 'nearest'
            //, textureWrapMode: 'clamp_to_edge'
        }));

        this.aabb = new AABB();
        this.aabb.set(0, 0, 0, 1, 16, 1);
        this.buffer = this.createBuffer(this.aabb, TARGET_TEXTURES);

    }

    update(delta) {
    }

    /**
     * Draw particles
     * @param {Renderer} render Renderer
     * @param {float} delta Delta time from previous call
     * @memberOf Particles_Raindrop
     */
    draw(render, delta) {

        if(!this.enabled) {
            return false;
        }
        
        const player = Game.player;
        // player.lerpPos.y - 2;
        
        if(!this.#_player_block_pos.equal(player.blockPos)) {
            this.#_player_block_pos.copyFrom(player.blockPos);
            this.#_version++;
            // update
            const vec = new Vector();
            for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
                for(let j = - RAIN_RAD; j <= RAIN_RAD; j++) {
                    // if(Math.abs(i) < 4 || Math.abs(j) < 4) continue;
                    vec.copyFrom(this.#_player_block_pos).addScalarSelf(i, 0, j);
                    const existing = this.#_map.get(vec);
                    if(existing) {
                        existing.version = this.#_version;
                        continue;
                    }
                    const item = {
                        matrix: mat4.create(),
                        version: this.#_version,
                        y: Math.random()
                    };
                    mat4.rotateZ(item.matrix, item.matrix, Math.random() * Math.PI);
                    this.#_map.set(vec, item);
                }
            }
        }

        // draw
        this.buffer.destroy();
        const c = [...TARGET_TEXTURES];
        c[1] = -performance.now() / 1000 * RAIN_SPEED;
        this.buffer = this.createBuffer(this.aabb, c);
        for(const [vec, item] of this.#_map.entries()) {
            if(item.version != this.#_version) {
                this.#_map.delete(vec);
                continue;
            }
            const a_pos = vec;
            a_pos.y = item.y;
            render.renderBackend.drawMesh(this.buffer, this.material, a_pos, item.matrix);
        }

    }

    get enabled() {
        return this.#_enabled;
    }

    set enabled(value) {
        this.#_enabled = value;
    }

    // createBuffer...
    createBuffer(aabb, c) {

        const vertices  = [];
        const lm        = new Color(0, 0, 0);
        const flags     = 0, sideFlags = 0, upFlags = 0;
        const pivot     = null;
        const matrix    = null;

        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                // up:     new AABBSideParams(c, upFlags, 1, lm, null, false),
                // down:   new AABBSideParams(c, flags, 1, lm, null, false),
                south:  new AABBSideParams(c, sideFlags, 1, lm, null, true),
                north:  new AABBSideParams(c, sideFlags, 1, lm, null, true),
                west:   new AABBSideParams(c, sideFlags, 1, lm, null, true),
                east:   new AABBSideParams(c, sideFlags, 1, lm, null, true),
            },
            Vector.ZERO
        );

        return new GeometryTerrain(vertices);
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
        return true;
    }

}