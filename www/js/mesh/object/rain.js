import { IndexedColor, getChunkAddr, QUAD_FLAGS, Vector, VectorCollector } from '../../helpers.js';
import GeometryTerrain from "../../geometry_terrain.js";
import { BLEND_MODES } from '../../renders/BaseRenderer.js';
import { AABB } from '../../core/AABB.js';
import { Resources } from '../../resources.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../chunk_const.js';
import {impl as alea} from "../../../vendors/alea.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../fluid/FluidConst.js";

const TARGET_TEXTURES   = [.5, .5, 1, .25];
const RAIN_SPEED        = 1023; // 1023 pixels per second scroll . 1024 too much for our IndexedColor
const SNOW_SPEED        = 42;
const SNOW_SPEED_X      = 16;
const RAIN_RAD          = 8;
const RAIN_START_Y      = 128;
const RAIN_HEIGHT       = 128;

const RANDOMS_COUNT = CHUNK_SIZE_X * CHUNK_SIZE_Z;
const randoms = new Array(RANDOMS_COUNT);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

/**
 * Draw rain over player
 * @class Mesh_Object_Raindrop
 * @param {Renderer} gl Renderer
 * @param {Vector} pos Player position
 */
export default class Mesh_Object_Rain {

    #_enabled           = false;
    #_map               = new VectorCollector();
    #_player_block_pos  = new Vector();
    #_version           = 0;
    #_blocks_sets       = 0;

    constructor(render, type, chunkManager) {

        this.life           = 1;
        this.type           = type;
        this.chunkManager   = chunkManager;
        this.player         = render.player;
        
        // Material (rain)
        const mat = render.defaultShader.materials.doubleface_transparent;

        // Material
        this.material = mat.getSubMat(render.renderBackend.createTexture({
            source: Resources.weather[type],
            blendMode: BLEND_MODES.MULTIPLY,
            minFilter: 'nearest',
            magFilter: 'nearest'
        }));
        
        if (this.type == 'rain') {
            this.sound_id = Qubatch.sounds.play('madcraft:environment', 'rain', null, true);  
        }

    }

    /**
     * 
     * @param {AABB} aabb 
     * @param {*} c 
     * @returns 
     */
    createBuffer(c) {

        const snow      = this.type == 'snow';
        const vertices  = [];
        const lm        = new IndexedColor((snow ? SNOW_SPEED_X : 0), snow ? SNOW_SPEED : RAIN_SPEED, 0);
        const flags     = QUAD_FLAGS.FLAG_TEXTURE_SCROLL | QUAD_FLAGS.NO_CAN_TAKE_LIGHT;
        const pp        = lm.pack();

        let quads       = 0;

        if(this.buffer) {
            this.buffer.destroy();
        }

        this.pos = new Vector(this.player.lerpPos.x, RAIN_START_Y, this.player.lerpPos.z).flooredSelf();
        let chunk_addr = null;
        const chunk_size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

        for(let [vec, height] of this.#_map.entries()) {

            chunk_addr = getChunkAddr(vec, chunk_addr).multiplyVecSelf(chunk_size);
            const rx = vec.x - chunk_addr.x;
            const rz = vec.z - chunk_addr.z;

            const rnd_index = Math.abs(Math.round(rx * CHUNK_SIZE_Z + rz)) % randoms.length;
            const rnd = randoms[rnd_index];

            const add = rnd;
            height += add;
            const x = vec.x - this.pos.x + (rnd * .2 - .1)
            const y = add + 1;
            const z = vec.z - this.pos.z + (rnd * .2 - .1)
            const c2 = [...c];
            const uvSize0 = c[2];
            const uvSize1 = -height * c[3];
            // SOUTH
            vertices.push(
                x + 0.5, z + 0.5, y - height/2,
                1, 0, 0, 0, 1, height,
                c2[0], c2[1],
                uvSize0,
                uvSize1,
                pp, flags
            );
            // WEST
            vertices.push(
                x + 0.5, z + 0.5, y - height/2,
                0, -1, 0, 1, 0, height,
                c2[0], c2[1],
                uvSize0,
                uvSize1,
                pp, flags
            );
            quads += 2;
        }

        this.buffer = new GeometryTerrain(vertices);

        return quads;

    }

    //
    update(delta) {
    }

    /**
     * Draw particles
     * @param {Renderer} render Renderer
     * @param {float} delta Delta time from previous call
     * @memberOf Mesh_Object_Raindrop
     */
    draw(render, delta) {

        if(!this.enabled || !this.prepare() || !this.buffer) {
            return false;
        }

        render.renderBackend.drawMesh(this.buffer, this.material, this.pos);

    }

    /**
     * @returns {boolean}
     */
    prepare() {

        const player = this.player;

        if(this.#_player_block_pos.equal(player.blockPos)) {
            if(this.#_blocks_sets != this.chunkManager.block_sets) {
                if(!this.updateHeightMap()) {
                    return false;
                }
                this.#_blocks_sets = this.chunkManager.block_sets;
            }
        } else {
            this.#_player_block_pos.copyFrom(player.blockPos);
            this.#_map.clear();
            // update
            const vec = new Vector();
            for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
                for(let j = - RAIN_RAD; j <= RAIN_RAD; j++) {
                    const dist = Math.sqrt(i * i + j * j);
                    if(dist < RAIN_RAD) {
                        vec.copyFrom(this.#_player_block_pos);
                        vec.addScalarSelf(i, -vec.y, j);
                        this.#_map.set(vec, 0);
                    }
                }
            }
            if(!this.updateHeightMap()) {
                this.#_player_block_pos.set(Infinity, Infinity, Infinity);
                return false;
            }

        }

        return true;

    }

    angleTo(pos, target) {
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle - 2 * Math.PI;
    }

    // Update height map
    updateHeightMap() {

        let p = performance.now();
        let checked_blocks = 0;
        let chunk = null;

        const pos           = this.#_player_block_pos;
        const vec           = new Vector();
        const block_pos     = new Vector();
        const chunk_size    = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        const chunk_addr    = new Vector();
        const chunk_addr_o  = new Vector(Infinity, Infinity, Infinity);

        // check chunks available
        const chunk_y_max = Math.floor(RAIN_START_Y / CHUNK_SIZE_Y);
        for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
            for(let j = -RAIN_RAD; j <= RAIN_RAD; j++) {
                for(let chunk_addr_y = 0; chunk_addr_y <= chunk_y_max; chunk_addr_y++) {
                    vec.copyFrom(this.#_player_block_pos);
                    vec.addScalarSelf(i, -vec.y, j);
                    block_pos.set(pos.x + i, chunk_addr_y * CHUNK_SIZE_Y, pos.z + j);
                    getChunkAddr(block_pos.x, block_pos.y, block_pos.z, chunk_addr);
                    chunk = this.chunkManager.getChunk(chunk_addr);
                    if(!chunk || !chunk.tblocks) {
                        return false;
                    }
                }
            }
        }

        //
        let block = null;
        let cx = 0, cy = 0, cz = 0, cw = 0;
        for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
            for(let j = -RAIN_RAD; j <= RAIN_RAD; j++) {
                for(let k = 0; k <= RAIN_HEIGHT; k++) {
                    vec.copyFrom(this.#_player_block_pos);
                    vec.addScalarSelf(i, -vec.y, j);
                    block_pos.set(pos.x + i, RAIN_START_Y - k, pos.z + j);
                    getChunkAddr(block_pos.x, block_pos.y, block_pos.z, chunk_addr);
                    if(!chunk_addr.equal(chunk_addr_o)) {
                        chunk = this.chunkManager.getChunk(chunk_addr);
                        chunk_addr_o.copyFrom(chunk_addr);
                        const dc = chunk.tblocks.dataChunk;
                        cx = dc.cx;
                        cy = dc.cy;
                        cz = dc.cz;
                        cw = dc.cw;
                    }
                    if(chunk && chunk.tblocks) {
                        chunk_addr.multiplyVecSelf(chunk_size);
                        block_pos.x -= chunk.coord.x;
                        block_pos.y -= chunk.coord.y;
                        block_pos.z -= chunk.coord.z;
                        const index = (block_pos.x * cx + block_pos.y * cy + block_pos.z * cz + cw);
                        const block_id = chunk.tblocks.id[index];
                        const is_fluid = (chunk.fluid.uint16View[index] & FLUID_TYPE_MASK) > 0
                        if(block_id > 0 || is_fluid) {
                            block = chunk.tblocks.get(block_pos, block);
                            checked_blocks++;
                            if(block && (block.id > 0 || block.fluid > 0) && !block.material.invisible_for_rain) {
                                this.#_map.set(vec, k)
                                break;
                            }
                        }
                    }
                }
            }
        }

        p = performance.now() - p;
        this.createBuffer(TARGET_TEXTURES);
        // console.log('tm', checked_blocks, p);
        return true;
        
    }

    get enabled() {
        return this.#_enabled;
    }

    set enabled(value) {
        this.#_enabled = value;
    }

    /**
     * Destructor
     * @memberOf Mesh_Object_Raindrop
     */
    destroy(render) {
        if(this.buffer) {
            this.buffer.destroy();
        }
        if(this.sound_id) {
            Qubatch.sounds.stop(this.sound_id);
        }
    }

    /**
     * Check particle status
     * @return {boolean}
     * @memberOf Mesh_Object_Raindrop
     */
    isAlive() {
        return this.enabled;
    }

}