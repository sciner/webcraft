import type { Vector } from "../../../../helpers.js";
import { ClimateParams, DensityParams, WATER_LEVEL } from "../manager_vars.js";
import type { TerrainMapCell } from "../map_cell.js";
import { MapCellPreset_Mountains } from "./mountains.js";

export class MapCellPreset_Ices extends MapCellPreset_Mountains {

    constructor() {
        super()
        this.id = 'ices';
        this.max_height = 64;
        this.noise_scale = 64
        this.climate = new ClimateParams(-1, .35) // Льдины (Заснеженые горы)
    }

    calcDensity(xyz : Vector, cell : TerrainMapCell, dist_percent : float, noise2d : any, generator_options : any, result : DensityParams) : DensityParams {

        this.max_height = xyz.y <= WATER_LEVEL ? 64 : 0

        super.calcDensity(xyz, cell, dist_percent, noise2d, generator_options, result)

        if(xyz.y <= WATER_LEVEL) {
            result.density /= 1.4;
        }

        this.max_height = 64

        if(xyz.y > WATER_LEVEL - Math.abs(result.d1) * 16 + Math.abs(result.d4) * 4) {
            if(result.d2 + result.d3 * .2 < .5) {
                result.density = 0
            }
        } else {
            // result.density *= 20
        }

        return result

    }

}