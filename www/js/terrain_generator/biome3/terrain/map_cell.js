import { Default_Terrain_Map_Cell } from "../../default.js";

// Map cell
export class TerrainMapCell extends Default_Terrain_Map_Cell {

    constructor(value, humidity, temperature, biome, dirt_block_id) {
        super(biome);
        this.value          = value;
        this.value2         = value;
        this.humidity       = Math.round(humidity * 100000) / 100000;
        this.temperature    = temperature;
        this.equator        = Math.round(temperature * 100000) / 100000;
        this.dirt_block_id  = dirt_block_id;
    }

    /**
     * @param {Vector} xyz 
     * @param {int} block_id 
     */
    genPlantOrGrass(x, y, z, size, block_id, rnd, density_params) {
        
        const biome = this.biome;
        let resp = false;
        const FLOWERS_THRESHOLD = .3

        if((biome.plants || biome.grass) && [BLOCK.GRASS_BLOCK.id, BLOCK.SNOW_DIRT.id, BLOCK.SAND.id, BLOCK.SANDSTONE.id, BLOCK.MOSS_BLOCK.id].includes(block_id)) {

            let r = rnd.double();

            const calcSet = (plant_set) => {
                if(r < plant_set.frequency) {
                    const freq = r / plant_set.frequency;
                    let s = 0;
                    for(let i = 0; i < plant_set.list.length; i++) {
                        const p = plant_set.list[i];
                        s += p.percent;
                        if(freq < s) {
                            if(y + p.blocks.length < size.y) {
                                return p.blocks;
                            }
                            break;
                        }
                    }
                }
                return false;
            };
            
            if(density_params.d4 < .05 && biome.plants) {
                resp = calcSet(biome.plants);
            }

            if(!resp && biome.plants && density_params.d2 > .85 && r < FLOWERS_THRESHOLD) {
                resp = biome.plants.list[((r/FLOWERS_THRESHOLD) * biome.plants.list.length) | 0].blocks
            }

            if(!resp && biome.grass) {
                resp = calcSet(biome.grass);
            }
            

        }

        return {plant_blocks: resp};

    }

}