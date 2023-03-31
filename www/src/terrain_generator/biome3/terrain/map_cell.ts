import { Default_Terrain_Map_Cell } from "../../default.js";
import type { Vector } from "../../../helpers.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type { DensityParams } from "./manager_vars.js";
import type { Biome } from "../biomes.js";
import { BLOCK_FLAG } from "../../../constant.js";
import { BLOCK } from "../../../blocks.js";

const CALC_SET_DX_WHERE_LIST = ['d1', 'd2', 'd3', 'd4']

// Map cell
export class TerrainMapCell extends Default_Terrain_Map_Cell {

    blocks_good_for_plants : int[]
    blocks_good_for_grass : int[]

    constructor(value : int, humidity : float, temperature : float, biome : Biome, dirt_block_id : int) {
        super(biome);
        this.value                  = value;
        this.value2                 = value;
        this.humidity               = Math.round(humidity * 100000) / 100000;
        this.temperature            = temperature;
        this.equator                = Math.round(temperature * 100000) / 100000;
        this.dirt_block_id          = dirt_block_id;
        this.blocks_good_for_plants = [BLOCK.GRASS_BLOCK.id, BLOCK.SNOW_DIRT.id, BLOCK.SAND.id, BLOCK.SANDSTONE.id, BLOCK.MOSS_BLOCK.id]
        this.blocks_good_for_grass  = [BLOCK.GRASS_BLOCK.id, BLOCK.MOSS_BLOCK.id, BLOCK.NETHERRACK.id]
    }

    genPlantOrGrass(x : int, y : int, z : int, xyz : Vector, size : Vector, block_id : int, rnd, density_params : DensityParams, chunk? : ChunkWorkerChunk) {

        const biome = this.biome
        const FLOWERS_THRESHOLD = .3

        let plant_blocks = null

        // if((biome.plants || biome.grass) && this.blocks_good_for_plants.includes(block_id)) {

            let r = rnd.double()
            let r2 = rnd.double()

            if(density_params.d4 < .05 && biome.plants) {
                plant_blocks = this.calcSet(r, y, size, biome.plants, xyz, density_params, r2, chunk)
            }

            if(!plant_blocks && biome.plants && density_params.d2 > .85 && r < FLOWERS_THRESHOLD) {
                plant_blocks = biome.plants.list[((r/FLOWERS_THRESHOLD) * biome.plants.list.length) | 0].blocks
            }

            if(!plant_blocks && biome.grass) {
                plant_blocks = this.calcSet(r, y, size, biome.grass, xyz, density_params, r2, chunk)
            }

        // }

        if(plant_blocks) {
            const first_block = plant_blocks[0]
            if(first_block.is_grass || first_block.is_flower || first_block.is_petals) {
                if(!this.blocks_good_for_grass.includes(block_id)) {
                    return null
                }
            }
        }

        return plant_blocks

    }

    calcSet(r : float, y : int, size : Vector, plant_set, xyz : Vector, density_params : DensityParams, r2 : float, chunk? : ChunkWorkerChunk) {
        if(r < plant_set.frequency) {
            const freq = r / plant_set.frequency
            let s = 0
            for(let i = 0; i < plant_set.list.length; i++) {
                const p = plant_set.list[i]
                s += p.percent
                if(freq < s) {
                    if(this.checkWhen(p.when, xyz, density_params, null, null)) {
                        if(y + p.blocks.length < size.y) {
                            return p.blocks
                        }
                    }
                    break
                }
            }
        }
        return null
    }

    checkWhen(when : any, xyz : Vector, density_params : DensityParams, under_block_id? : int, bm? : BLOCK) : boolean {
        if(!when) {
            return true
        }
        if('y' in when) {
            if(xyz.y < when.y.min || xyz.y >= when.y.max) {
                return false
            }
        }
        // check if under block is dirt
        if(when.under_good_for_plant) {
            if(!this.blocks_good_for_plants.includes(under_block_id)) {
                return false
            }
        }
        for(let i = 0; i < CALC_SET_DX_WHERE_LIST.length; i++) {
            const dk = CALC_SET_DX_WHERE_LIST[i]
            if(dk in when) {
                const when_criteria = when[dk]
                const value = density_params[dk]
                if(value < when_criteria.min || value > when_criteria.max) {
                    return false
                }
            }
        }
        return true
    }

    getCapBlockId() {
        const dl = this.dirt_layer ?? this.biome.dirt_layers[0]
        return dl.cap_block_id
    }

}