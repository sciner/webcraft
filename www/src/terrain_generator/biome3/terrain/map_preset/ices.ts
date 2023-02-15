import { Vector } from "../../../../helpers.js";
import { ClimateParams, DensityParams, WATER_LEVEL } from "../manager_vars.js";
import { MapCellPreset_Mountains } from "./mountains.js";

export class MapCellPreset_Ices extends MapCellPreset_Mountains {
    [key: string]: any;

    constructor() {
        super()
        this.id = 'ices';
        this.max_height = 0;
        this.noise_scale = 64
        this.climate = new ClimateParams(-1, .35) // Льдины (Заснеженые горы)
    }

    /**
     * @param {Vector} xyz
     * @param {TerrainMapCell} cell
     * @param {float} dist_percent
     * @param {*} generator_options
     * @param {*} noise2d
     * @param {DensityParams} result
     *
     * @returns {DensityParams}
     */
    calcDensity(xyz, cell, dist_percent, noise2d, generator_options, result) {
        super.calcDensity(xyz, cell, dist_percent, noise2d, generator_options, result)
        if(xyz.y > WATER_LEVEL - 4) {
            if(result.d2 + result.d3 * .2 < .5) {
                result.density = 0
            }
        }
        return result
    }

}