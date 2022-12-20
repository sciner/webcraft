import { BLOCK } from "../../blocks.js";
import { Vector } from "../../helpers.js";
import { createNoise3D } from '../../../vendors/simplex-noise.js';
import { impl as alea } from '../../../vendors/alea.js';

export class WorldClientOreGenerator {

    /**
     * @param {string} seed 
     */
    constructor(seed) {
        this.seed = seed.replaceAll('-', '')
        this.ores = [];
        this.random = new alea(seed)
        this.addOreLayer(20, 20, 11, .7, BLOCK.DIAMOND_ORE.id)
        this.addOreLayer(30, 30, 11, .7, BLOCK.GOLD_ORE.id)
        this.addOreLayer(50, 40, 11, .7, BLOCK.IRON_ORE.id)
        this.addOreLayer(30, 60, 11, .7, BLOCK.REDSTONE_ORE.id)
        this.addOreLayer(0, Infinity, 11, .7, BLOCK.COAL_ORE.id)
    }

    addOreLayer(y, height, scale, threshold, ore_block_id) {
        const seed = this.seed + this.seed
        const s32 = new String(this.random.int32())
        const noise_hi = createNoise3D(new alea(seed.substring(0, 16) + s32).double)
        const noise_lo = createNoise3D(new alea((seed.substring(16, 16) || seed) + s32).double)
        this.ores.push({y, height, scale, threshold, ore_block_id, noise_hi, noise_lo})
    }

    /**
     * @param {Vector} pos 
     * @returns {int}
     */
    generate(pos) {
        for(let i = 0; i < this.ores.length; i++) {
            const {y, height, scale, threshold, ore_block_id, noise_hi, noise_lo} = this.ores[i]
            if(height != Infinity && Math.abs(pos.y - y) > height) continue
            const nhi = noise_hi(pos.x / scale, pos.y / scale, pos.z / scale);
            const nlo = noise_lo(pos.x / scale, pos.y / scale, pos.z / scale);
            let n = nhi * .5 + nlo * .5
            if(n < 0) n = -n
            if(n > threshold) {
                return ore_block_id
            }
        }
        return BLOCK.STONE.id;
    }

}