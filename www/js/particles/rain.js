import { Color, QUAD_FLAGS, Vector, VectorCollector } from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import { BLEND_MODES } from '../renders/BaseRenderer.js';
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { Resources } from '../resources.js';

import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr } from '../chunk_const.js';

const {mat4} = glMatrix;

const TARGET_TEXTURES   = [.5, .5, 1, .25];
const RAIN_SPEED        = 2 / 1000;
const RAIN_RAD          = 8;
const RAIN_HEIGHT       = 14;

//
class RainColumn {

    constructor(i, j, y, version) {
        this.update(i, j, y, version);
        // this.matrix = mat4.create();
        // mat4.rotateZ(this.matrix, this.matrix, Math.random() * (Math.PI * 2));
        this.matrix = mat4.create();
        const angle_z = Math.random() * Math.PI * 2; // this.angleTo(vec, center);
        mat4.rotateZ(this.matrix, this.matrix, -angle_z);
    }

    update(i, j, y, version) {
        this.i = i;
        this.j = j;
        this.y = y;
        this.max_y = y;
        this.version = version;
        const dist = Math.sqrt(i * i + j * j);
        this.dist = dist / RAIN_RAD;
        if(this.dist > 1) {
            this.version = 0;
        }
        this.add_y = 0; // Math.random() * this.dist;
    }

}

/**
 * Draw rain over player
 * @class Particles_Raindrop
 * @param {Renderer} gl Renderer
 * @param {Vector} pos Player position
 */
export default class Particles_Rain {

    #_enabled           = false;
    #_map               = new VectorCollector();
    #_player_block_pos  = new Vector();
    #_version           = 0;
    #_blocks_sets       = 0;

    constructor(render, pos) {

        this.life = 1;
        this.chunkManager = Game.world.chunkManager;

        // Material (rain)
        const mat = render.defaultShader.materials.doubleface_transparent;

        // Material
        this.material = mat.getSubMat(render.renderBackend.createTexture({
            source: Resources.weather.rain,
            blendMode: BLEND_MODES.MULTIPLY,
            minFilter: 'nearest',
            magFilter: 'nearest'
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

        this.prepare();

        // draw
        for(const [vec, item] of this.#_map.entries()) {
            if(item.version != this.#_version) {
                this.#_map.delete(vec);
                continue;
            }
            if(item.i == 0 && item.j == 0) continue;
            vec.x += .5;
            vec.y = item.max_y + item.add_y;
            vec.z += .5;
            render.renderBackend.drawMesh(this.buffer, this.material, vec, item.matrix);
        }

    }

    prepare() {
        
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
                    const y = this.#_player_block_pos.y - 4;
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
    }

    angleTo(pos, target) {
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle - 2 * Math.PI;
    }

    // updateHeightMap...
    updateHeightMap() {
        // let p = performance.now();
        const world         = Game.world;
        const pos           = this.#_player_block_pos;
        const vec           = new Vector();
        const block_pos     = new Vector();
        const chunk_size    = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        const chunk_addr    = new Vector();
        const chunk_addr_o  = new Vector(Infinity, Infinity, Infinity);
        let chunk           = null;
        let block           = null;
        for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
            for(let j = -RAIN_RAD; j <= RAIN_RAD; j++) {
                for(let k = RAIN_HEIGHT; k >= -1; k--) {
                    vec.copyFrom(this.#_player_block_pos);
                    vec.addScalarSelf(i, -vec.y, j);
                    const item = this.#_map.get(vec);
                    if(!item) continue;
                    if(item.version != this.#_version) {
                        this.#_map.delete(vec);
                        continue;
                    }
                    block_pos.set(pos.x + i, pos.y + k, pos.z + j);
                    getChunkAddr(block_pos.x, block_pos.y, block_pos.z, chunk_addr);
                    if(!chunk_addr.equal(chunk_addr_o)) {
                        chunk = world.chunkManager.getChunk(chunk_addr);
                        chunk_addr_o.copyFrom(chunk_addr);
                    }
                    if(chunk) {
                        chunk_addr.multiplyVecSelf(chunk_size);
                        block_pos.x -= chunk.coord.x;
                        block_pos.y -= chunk.coord.y;
                        block_pos.z -= chunk.coord.z;
                        block = chunk.tblocks.get(block_pos, block);
                        if(block.id > 0) {
                            item.max_y = pos.y + k + 1;
                            break;
                        }
                    }
                }
            }
        }
        // p = performance.now() - p;
        // console.log(Math.round(p * 1000) / 1000)
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
        const lm        = new Color(RAIN_SPEED / 5, -RAIN_SPEED, 0);
        const sideFlags = QUAD_FLAGS.TEXTURE_SCROLL | QUAD_FLAGS.NO_CAN_TAKE_LIGHT;
        const pivot     = null;
        const matrix    = null;

        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                // south:  new AABBSideParams(c, sideFlags, 1, lm, null, true),
                north:  new AABBSideParams(c, sideFlags, 1, lm, null, true),
                // west:   new AABBSideParams(c, sideFlags, 1, lm, null, true),
                // east:   new AABBSideParams(c, sideFlags, 1, lm, null, true),
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