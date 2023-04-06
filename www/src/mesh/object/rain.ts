import { IndexedColor, QUAD_FLAGS, Vector, VectorCollector, Mth, FastRandom } from '../../helpers.js';
import GeometryTerrain from "../../geometry_terrain.js";
import { BLEND_MODES } from '../../renders/BaseRenderer.js';
import { Resources } from '../../resources.js';
import { FLUID_TYPE_MASK, PACKED_CELL_LENGTH, PACKET_CELL_BIOME_ID } from "../../fluid/FluidConst.js";
import { Weather } from '../../block_type/weather.js';
import type { Renderer } from '../../render.js';
import type { ChunkManager } from '../../chunk_manager.js';
import type { ChunkGrid } from '../../core/ChunkGrid.js';
import { MAX_CHUNK_SQUARE } from '../../chunk_const.js';
import type { World } from '../../world.js';
import type { Player } from '../../player.js';

const TARGET_TEXTURES   = [.5, .5, 1, .25];
const RAIN_SPEED        = 1023; // 1023 pixels per second scroll . 1024 too much for our IndexedColor
const SNOW_SPEED        = 42;
const SNOW_SPEED_X      = 0;
const RAIN_RAD          = 8;
const RAIN_START_Y      = 128;
const RAIN_HEIGHT       = 128;
const RAIN_HEARING_DIST = 10; // maximum hearing distance for player

const randoms = new FastRandom('rain', MAX_CHUNK_SQUARE)
const _chunk_addr = new Vector(Infinity, Infinity, Infinity)

let _chunk = null;

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
    #_player_pos        = new Vector();
    #_blocks_sets       = 0;

    world:              World
    chunkManager:       ChunkManager
    grid:               ChunkGrid
    sound_id            = null
    type                = null
    life:               number
    player:             Player
    render:             Renderer
    strength_val:       number
    weather:            any
    player_dist:        number
    contact_blocks:     any[]
    material:           any
    defaultVolume:      any
    buffer:             any
    pos:                Vector
    volume:             any

    /**
     * @param render
     * @param type rain|snow
     * @param chunkManager
     */
    constructor(world : World, render : Renderer, type : string, chunkManager : ChunkManager) {

        this.life           = 1;
        this.type           = type;
        this.world          = world
        this.chunkManager   = chunkManager;
        this.grid           = chunkManager.grid
        this.player         = render.player;
        this.render         = render;

        this.strength_val   = 0
        this.weather        = Weather.BY_NAME[type]
        this.player_dist    = Infinity
        this.contact_blocks = [] // блоки, которые дождь принял за препятствие и ниже них не льёт

        // Material
        const mat = this.render.defaultShader.materials.doubleface_transparent;
        this.material = mat.getSubMat(this.render.renderBackend.createTexture({
            source: Resources.weather.image,
            blendMode: BLEND_MODES.MULTIPLY,
            minFilter: 'nearest',
            magFilter: 'nearest'
        }));

        // if this weather has an associted soundtrack, start it
        this.defaultVolume = Qubatch.sounds.getTrackProps('madcraft:environment', this.type)?.volume
        if (this.defaultVolume) {
            this.sound_id = Qubatch.sounds.play('madcraft:environment', this.type, null, true)
            // Start quiet. It'll change the volume with time.
            Qubatch.sounds.setVolume(this.sound_id, 0)
        }

    }

    createBuffer(c) {

        const vertices  = [];
        const flags     = QUAD_FLAGS.FLAG_TEXTURE_SCROLL | QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_RAIN_OPACITY;
        let quads       = 0;

        if(this.buffer) {
            this.buffer.destroy();
        }

        this.pos = new Vector(this.player.lerpPos.x, RAIN_START_Y, this.player.lerpPos.z).flooredSelf();
        let chunk_addr = null;

        const chunk_size = this.render.world.chunkManager.grid.chunkSize;
        const pp_rain = new IndexedColor(0, RAIN_SPEED, 0).pack()
        const pp_snow = new IndexedColor(SNOW_SPEED_X, SNOW_SPEED, 0).pack()

        for (let [xz, height] of this.#_map.entries()) {

            chunk_addr = this.grid.toChunkAddr(xz, chunk_addr).multiplyVecSelf(chunk_size);

            const rx = xz.x - chunk_addr.x;
            const rz = xz.z - chunk_addr.z;
            const is_snow = this.isSnowCell(xz);
            const pp = is_snow ? pp_snow : pp_rain;
            const rnd = randoms.double(rz * chunk_size.x + rx);

            const add = rnd;
            height += add;
            const x = xz.x - this.pos.x + (rnd * .2 - .1)
            const y = add + 1;
            const z = xz.z - this.pos.z + (rnd * .2 - .1);
            c[0] = is_snow ? 0.75 : 0.25;
            const c2 = [...c];
            const uvSize0 = c[2] / 2;
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
    update(weather, delta) {
        if (this.sound_id) {
            const old_volume = this.volume
            this.strength_val = Mth.clamp(this.strength_val + delta / 1000 * (weather ? 1 : -1), 0, 1)
            const hearing_dist_volume = Mth.clamp(1 - this.player_dist / RAIN_HEARING_DIST, 0, 1)
            this.volume = Mth.round(this.defaultVolume * Math.min(this.strength_val, hearing_dist_volume), 3)
            if(old_volume != this.volume) {
                Qubatch.sounds.setVolume(this.sound_id, this.volume)
            }
        }
        if (!weather && this.strength_val == 0) {
            this.enabled = false
        }
    }

    /**
     * Draw particles
     * @param render Renderer
     * @param delta Delta time from previous call
     * @memberOf Mesh_Object_Raindrop
     */
    draw(render : Renderer, delta : float) {

        if(!this.enabled || !this.prepare() || !this.buffer) {
            return false;
        }

        render.renderBackend.drawMesh(this.buffer, this.material, this.pos);

        // random raindrop particles on earth
        // let prev_item = null
        // for(let i = 0; i < 10; i++) {
        //     const item = ArrayHelpers.randomItem(this.contact_blocks)
        //     if(item !== prev_item) {
        //         const scale = Mth.clamp(1 - this.#_player_pos.distance(item.pos) / 8, 0, 1) * .5
        //         render.destroyBlock({id: 202}, item.pos.clone().addScalarSelf(Math.random(), 1, Math.random()), true, scale, .5, 1)
        //         prev_item = item
        //     }
        // }

    }

    prepare() : boolean {

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
            this.#_player_pos.copyFrom(player.lerpPos);
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

        // let p = performance.now();
        let checked_blocks = 0;
        let chunk = null;

        const pos           = this.#_player_block_pos;
        const vec           = new Vector();
        const block_pos     = new Vector();
        const chunk_size    = this.grid.chunkSize;
        const chunk_addr    = new Vector();

        this.contact_blocks = []

        // check chunks available
        const chunk_y_max = Math.floor(RAIN_START_Y / chunk_size.y);
        const chunkManager = this.chunkManager
        const grid : ChunkGrid = chunkManager.grid
        for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
            for(let j = -RAIN_RAD; j <= RAIN_RAD; j++) {
                for(let chunk_addr_y = 0; chunk_addr_y <= chunk_y_max; chunk_addr_y++) {
                    vec.copyFrom(this.#_player_block_pos);
                    vec.addScalarSelf(i, -vec.y, j);
                    block_pos.set(pos.x + i, chunk_addr_y * chunk_size.y, pos.z + j);
                    grid.getChunkAddr(block_pos.x, block_pos.y, block_pos.z, chunk_addr);
                    if(!chunk || !chunk.addr.equal(chunk_addr)) {
                        chunk = chunkManager.getChunk(chunk_addr)
                    }
                    if(!chunk || !chunk.tblocks) {
                        return false;
                    }
                }
            }
        }

        let min_player_dist = Infinity

        //
        let block = null;
        let cx = 0, cy = 0, cz = 0, cw = 0;
        chunk = null
        for(let i = -RAIN_RAD; i <= RAIN_RAD; i++) {
            for(let j = -RAIN_RAD; j <= RAIN_RAD; j++) {
                for(let k = 0; k <= RAIN_HEIGHT; k++) {
                    vec.copyFrom(this.#_player_block_pos);
                    vec.addScalarSelf(i, -vec.y, j);
                    block_pos.set(pos.x + i, RAIN_START_Y - k, pos.z + j);
                    grid.getChunkAddr(block_pos.x, block_pos.y, block_pos.z, chunk_addr);
                    if(!chunk || !chunk.addr.equal(chunk_addr)) {
                        chunk = this.chunkManager.getChunk(chunk_addr);
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
                                const is_snow = this.isSnowCell(block.posworld)
                                const is_rain = !is_snow
                                if(is_rain) {
                                    let player_dist = this.#_player_pos.distance(block.posworld)
                                    if(player_dist < min_player_dist) {
                                        min_player_dist = player_dist
                                    }
                                }
                                this.contact_blocks.push({block, pos: block.posworld})
                                this.#_map.set(vec, k)
                                break;
                            }
                        }
                    }
                }
            }
        }

        this.player_dist = min_player_dist - 1

        this.createBuffer(TARGET_TEXTURES);
        // console.log('tm', checked_blocks, Mth.round(performance.now() - p, 3));
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
    get isAlive() : boolean {
        return this.enabled;
    }

    /**
     * Снежная ячейка или нет
     */
    isSnowCell(xz : Vector) : boolean {
        const pos = xz.floored();
        this.chunkManager.grid.getChunkAddr(pos.x, pos.y, pos.z, _chunk_addr);
        if(!_chunk || !_chunk.addr.equal(_chunk_addr)) {
            _chunk = this.chunkManager.getChunk(_chunk_addr)
        }
        if(!_chunk?.packedCells) {
            return false;
        }
        const x = pos.x - _chunk_addr.x * _chunk.size.x;
        const z = pos.z - _chunk_addr.z * _chunk.size.z;
        const cell_index = z * _chunk.size.x + x;
        const biome_id = _chunk.packedCells[cell_index * PACKED_CELL_LENGTH + PACKET_CELL_BIOME_ID]
        const biome = this.chunkManager.biomes.byID.get(biome_id)
        return biome?.is_snowy ?? false
    }

}