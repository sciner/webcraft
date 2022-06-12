import { Color, QUAD_FLAGS, Vector, VectorCollector } from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import { BLEND_MODES } from '../renders/BaseRenderer.js';
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { Resources } from '../resources.js';

import glMatrix from "../../vendors/gl-matrix-3.3.min.js";

const {mat4} = glMatrix;

const TARGET_TEXTURES   = [.5, .5, 1, .25];
const RAIN_SPEED        = 3 / 1000;
const RAIN_RAD          = 6;
const RAIN_HEIGHT       = 14;

//
class RainColumn {

    constructor(i, j, y, version) {
        this.update(i, j, y, version);
        this.matrix = mat4.create();
        mat4.rotateZ(this.matrix, this.matrix, Math.random() * Math.PI);
    }

    update(i, j, y, version) {
        this.i = i;
        this.j = j;
        this.y = y;
        this.max_y = y;
        this.version = version;
    }

}

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
    #_blocks_sets = 0;

    constructor(render, pos) {

        this.life = 1;
        this.chunkManager = Game.world.chunkManager;

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
        this.aabb.set(0, 0, 0, 0, RAIN_HEIGHT, 0);
        this.aabb.expand(.5, 0, .5);
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
        
        if(!this.#_player_block_pos.equal(player.blockPos)) {
            this.#_player_block_pos.copyFrom(player.blockPos);
            this.#_version++;
            // update
            const vec = new Vector();
            for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
                for(let j = - RAIN_RAD; j <= RAIN_RAD; j++) {
                    vec.copyFrom(this.#_player_block_pos);
                    vec.addScalarSelf(i, -vec.y, j);
                    const existing = this.#_map.get(vec);
                    const y = Math.random() + this.#_player_block_pos.y - 4;
                    if(existing) {
                        existing.update(i, j, y, this.#_version);
                        continue;
                    }
                    const item = new RainColumn(i, j, y, this.#_version);
                    this.#_map.set(vec, item);
                }
            }
            this.updateHeightMap();
        } else {
            if(this.#_blocks_sets != this.chunkManager.block_sets) {
                this.#_blocks_sets = this.chunkManager.block_sets;
                this.updateHeightMap();
            }
        }

        // draw
        for(const [vec, item] of this.#_map.entries()) {
            if(item.version != this.#_version) {
                this.#_map.delete(vec);
                continue;
            }
            vec.x += .5;
            vec.y = item.max_y; // + Math.abs(Math.sin(item.i + item.j)) % 1;
            vec.z += .5;
            render.renderBackend.drawMesh(this.buffer, this.material, vec, item.matrix);
        }

    }

    // updateHeightMap...
    updateHeightMap() {
        const world = Game.world;
        const pos = this.#_player_block_pos;
        const vec = new Vector();
        for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
            for(let j = -RAIN_RAD; j <= RAIN_RAD; j++) {
                for(let k = RAIN_HEIGHT; k >= -1; k--) {
                    const block = world.getBlock(pos.x + i, pos.y + k, pos.z + j);
                    if(block.id > 0) {
                        vec.copyFrom(this.#_player_block_pos);
                        vec.addScalarSelf(i, -vec.y, j);
                        this.#_map.get(vec).max_y = pos.y + k + 1;
                        break;
                    }
                }
            }
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
        const lm        = new Color(0, -RAIN_SPEED, 0);
        const sideFlags = QUAD_FLAGS.TEXTURE_SCROLL;
        const pivot     = null;
        const matrix    = null;

        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
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