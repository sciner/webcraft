import { Default_Terrain_Map_Cell } from "../../default.js";

// Map cell
export class TerrainMapCell extends Default_Terrain_Map_Cell {

    constructor(value, humidity, temperature, biome, dirt_block_id) {
        super(biome);
        this.value                  = value;
        this.value2                 = value;
        this.humidity               = Math.round(humidity * 100000) / 100000;
        this.temperature            = temperature;
        this.equator                = Math.round(temperature * 100000) / 100000;
        this.dirt_block_id          = dirt_block_id;
        this.blocks_good_for_plants = [BLOCK.GRASS_BLOCK.id, BLOCK.SNOW_DIRT.id, BLOCK.SAND.id, BLOCK.SANDSTONE.id, BLOCK.MOSS_BLOCK.id]
    }

    /**
     * @param {Vector} xyz 
     * @param {int} block_id 
     */
    genPlantOrGrass(x, y, z, size, block_id, rnd, density_params) {
        
        const biome = this.biome
        const FLOWERS_THRESHOLD = .3

        let plant_blocks = null

        if((biome.plants || biome.grass) && this.blocks_good_for_plants.includes(block_id)) {

            let r = rnd.double()

            if(density_params.d4 < .05 && biome.plants) {
                plant_blocks = this.calcSet(r, y, size, biome.plants)
            }

            if(!plant_blocks && biome.plants && density_params.d2 > .85 && r < FLOWERS_THRESHOLD) {
                plant_blocks = biome.plants.list[((r/FLOWERS_THRESHOLD) * biome.plants.list.length) | 0].blocks
            }

            if(!plant_blocks && biome.grass) {
                plant_blocks = this.calcSet(r, y, size, biome.grass)
            }

        }

        return plant_blocks

    }

    calcSet(r, y, size, plant_set) {
        if(r < plant_set.frequency) {
            const freq = r / plant_set.frequency
            let s = 0
            for(let i = 0; i < plant_set.list.length; i++) {
                const p = plant_set.list[i]
                s += p.percent
                if(freq < s) {
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