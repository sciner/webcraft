import type { Vector } from "../../../helpers.js";
import { Default_Terrain_Map_Cell } from "../../default.js";
import type { DensityParams } from "./manager_vars.js";

// Map cell
export class TerrainMapCell extends Default_Terrain_Map_Cell {
    [key: string]: any;

    blocks_good_for_plants : int[]

    constructor(value, humidity, temperature, biome, dirt_block_id) {
        super(biome);
        this.value                  = value;
        this.value2                 = value;
        this.humidity               = Math.round(humidity * 100000) / 100000;
        this.temperature            = temperature;
        this.equator                = Math.round(temperature * 100000) / 100000;
        this.dirt_block_id          = dirt_block_id;
        this.blocks_good_for_plants = [BLOCK.GRASS_BLOCK.id, BLOCK.SNOW_DIRT.id, BLOCK.SAND.id, BLOCK.SANDSTONE.id, BLOCK.MOSS_BLOCK.id]
        this.blocks_good_for_grass  = [BLOCK.GRASS_BLOCK.id, BLOCK.MOSS_BLOCK.id]
    }

    genPlantOrGrass(x : int, y : int, z : int, size : Vector, block_id : int, rnd, density_params : DensityParams, xyz : Vector) {

        const biome = this.biome
        const FLOWERS_THRESHOLD = .3

        let plant_blocks = null

        if((biome.plants || biome.grass) && this.blocks_good_for_plants.includes(block_id)) {

            let r = rnd.double()

            if(density_params.d4 < .05 && biome.plants) {
                plant_blocks = this.calcSet(r, y, size, biome.plants, xyz, density_params)
            }

            if(!plant_blocks && biome.plants && density_params.d2 > .85 && r < FLOWERS_THRESHOLD) {
                plant_blocks = biome.plants.list[((r/FLOWERS_THRESHOLD) * biome.plants.list.length) | 0].blocks
            }

            if(!plant_blocks && biome.grass) {
                plant_blocks = this.calcSet(r, y, size, biome.grass, xyz, density_params)
            }

        }

        if(plant_blocks) {
            if(plant_blocks[0].is_grass || plant_blocks[0].is_flower || plant_blocks[0].is_petals) {
                if(!this.blocks_good_for_grass.includes(block_id)) {
                    return null
                }
            }
        }

        return plant_blocks

    }

    calcSet(r : float, y : int, size : Vector, plant_set, xyz : Vector, density_params : DensityParams) {
        if(r < plant_set.frequency) {
            const freq = r / plant_set.frequency
            let s = 0
            for(let i = 0; i < plant_set.list.length; i++) {
                const p = plant_set.list[i]
                s += p.percent
                if(freq < s) {
                    if(p.when) {
                        const when = p.when
                        if('y' in when) {
                            if(!(xyz.y >= when.y.min && xyz.y < when.y.max)) continue
                        }
                        if('d3' in when) {
                            const d3 = density_params.d3
                            if(!(d3 >= when.d3.min && d3 < when.d3.max)) continue
                        }
                    }
                    if(y + p.blocks.length < size.y) {
                        return p.blocks
                    }
                    break
                }
            }
        }
        return null
    }

    getCapBlockId() {
        const dl = this.dirt_layer ?? this.biome.dirt_layers[0]
        return dl.cap_block_id
    }

}