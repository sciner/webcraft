import { LEAVES_COLOR_FLAGS } from "../../../block_style/cube.js";
import { CHUNK_SIZE_X } from "../../../chunk_const.js";
import { ChunkManager } from "../../../chunk_manager.js";
import { GRASS_PALETTE_OFFSET } from "../../../constant.js";
import { DIRECTION, getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from "../../../helpers.js";
import { Mesh_Effect_Particle, PARTICLE_FLAG_BOUNCE_CEILING } from "../particle.js";

const _pos_floored = new Vector(0, 0, 0);
const _lm_grass = new IndexedColor(0, 0, 0);

export default class emitter {

    constructor(pos, args) {

        this.args           = args;
        this.pos            = pos;
        this.block_manager  = args.block_manager;
        this.max_distance   = 32;

        // get chunk
        this.chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);
        const chunk = ChunkManager.instance.getChunk(this.chunk_addr);
        if(!chunk || !chunk.dirt_colors) {
            this.life = 0;
            return;
        }

        const block         = this.block_manager.fromId(args.block.id);
        const {pp, flags}   = this.calcPPAndFlags(chunk, pos, block, args.block.extra_data);
        const {material, c} = this.calcMaterialAndTexture(block);

        //
        this.c              = c;
        this.material_key   = block.material_key;
        this.tx_cnt         = block.tx_cnt;
        this.material       = material;
        this.pp             = pp;
        this.flags          = flags | PARTICLE_FLAG_BOUNCE_CEILING;
        this.ticks          = 0;

    }

    /**
     * Return true if this emitter can be deleted
     * @returns {bool}
     */
    canDelete() {
        return this.ticks > 0;
    }

    /**
     * Method return array of generated particles
     * @returns {Mesh_Effect_Particle[]}
     */
    emit() {

        if(this.ticks++ > 1 || this.life <= 0) {
            return [];
        }

        const c     = this.c;
        const small = this.args.small;
        const scale = this.args.scale;
        const force = this.args.force * 3;
        const count = small ? 5 : 30;

        const resp = [];

        for(let i = 0; i < count; i++) {

            // случайная позиция частицы (в границах блока)
            const x = (Math.random() - Math.random()) * (.5 * scale);
            const y = (Math.random() - Math.random()) * (.5 * scale);
            const z = (Math.random() - Math.random()) * (.5 * scale);

            // ускорение в случайнуюю сторону
            const velocity = new Vector(
                Math.random() - Math.random(),
                1,
                Math.random() - Math.random()
            ).normSelf().multiplyScalarSelf(force);

            // случайный размер текстуры
            const tex_sz = ((Math.random() * (small ? .25/16 : 3/16) + 1/16) * scale) / this.tx_cnt;

            // random tex coord (случайная позиция в текстуре)
            const cx = c[0] - c[2]/2 + tex_sz/2 + Math.random() * (c[2] - tex_sz);
            const cy = c[1] - c[3]/2 + tex_sz/2 + Math.random() * (c[3] - tex_sz);

            // пересчет координат и размеров текстуры в атласе
            const texture = [cx, cy, tex_sz, tex_sz];

            // новая частица
            const p = new Mesh_Effect_Particle({
                texture:        texture,
                size:           tex_sz * this.tx_cnt,
                scale:          scale,
                velocity:       velocity,
                pp:             this.pp,
                flags:          this.flags,
                material_key:   this.material_key,
                pos:            this.pos.clone().addScalarSelf(x, y, z),
                material:       this.material
            });

            // Change to bone meal particle effect
            // p.life = Math.random() * 6;
            // p.ag = new Vector(0, 0, 0);
            // p.velocity.divScalar(40);
            // p.size = scale;

            resp.push(p);

        }

        return resp;

    }

    // Texture params
    calcMaterialAndTexture(block) {
        const texture        = block.texture;
        const resource_pack  = block.resource_pack;
        const material       = resource_pack.getMaterial(block.material_key);
        if(typeof texture != 'function' && typeof texture != 'object' && !(texture instanceof Array)) {
            this.life = 0;
            return;
        }
        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }
        const tex = resource_pack.textures.get(texture_id);
        const c = this.block_manager.calcTexture(texture, DIRECTION.DOWN, tex.tx_cnt); // полная текстура
        return {material, c};
    }

    /**
     * 
     * @param {*} chunk 
     * @param {Vector} pos 
     * @param {object} block 
     * @param {?object} extra_data 
     * @returns 
     */
    calcPPAndFlags(chunk, pos, block, extra_data) {
        // Color masks
        let flags = QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.LOOK_AT_CAMERA; // QUAD_FLAGS.NO_AO;
        let lm = _lm_grass.copyFrom(IndexedColor.WHITE);
        if(block) {
            if(this.block_manager.MASK_BIOME_BLOCKS.includes(block.id)) {
                _pos_floored.copyFrom(pos).flooredSelf();
                const index = ((_pos_floored.z - chunk.coord.z) * CHUNK_SIZE_X + (_pos_floored.x - chunk.coord.x)) * 2;
                lm.set(chunk.dirt_colors[index], chunk.dirt_colors[index + 1], 0);
                if(block.id == this.block_manager.GRASS_BLOCK.id || block.is_grass) {
                    lm.r += GRASS_PALETTE_OFFSET;
                }
                flags |= QUAD_FLAGS.MASK_BIOME;
                // leaves custom color
                if(extra_data && extra_data.v != undefined) {
                    const color = LEAVES_COLOR_FLAGS[extra_data.v % LEAVES_COLOR_FLAGS.length]
                    lm.r = color.r
                    lm.g = color.g
                }
            } else if(this.block_manager.MASK_COLOR_BLOCKS.includes(block.id)) {
                lm.set(block.mask_color.r, block.mask_color.g, block.mask_color.b);
                flags |= QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
            } else if(block.tags.includes('multiply_color')) {
                lm.set(block.multiply_color.r, block.multiply_color.g, block.multiply_color.b);
                flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
            }
        }
        return {
            pp: lm.pack(),
            flags
        };
    }

}