import { Mth, Vector } from "../../../../helpers.js";
import { DENSITY_AIR_THRESHOLD } from "../manager.js";
import { ClimateParams, DensityParams, WATER_LEVEL } from "../manager_vars.js";
import type { TerrainMapCell } from "../map_cell.js";
import { MapCellPreset_Mountains } from "./mountains.js";

export class MapCellPreset_Swamp extends MapCellPreset_Mountains {
    [key: string]: any;

    constructor() {
        super()
        this.id = 'swamp';
        this.max_height = -16;
        this.noise_scale = 8
        this.climate = new ClimateParams(.6, 1.25) // Болото
    }

    calcDensity(xyz : Vector, cell : TerrainMapCell, dist_percent : float, noise2d : any, generator_options : any, result : DensityParams) : DensityParams {

        if(cell.mountains_max_height === undefined) {
            const max_height = xyz.y < WATER_LEVEL ? this.max_height / 20 : this.max_height
            const HEIGHT_SCALE = max_height * dist_percent;
            cell.mountains_height =  generator_options.WATER_LEVEL +
                this.mountainFractalNoise(
                    noise2d,
                    xyz.x/3, xyz.z/3,
                    4, // -- Octaves (Integer that is >1)
                    3, // -- Lacunarity (Number that is >1)
                    0.35, // -- Persistence (Number that is >0 and <1)
                    this.noise_scale,
                ) * HEIGHT_SCALE;
        }

        const density = Mth.clamp(DENSITY_AIR_THRESHOLD + (cell.mountains_height - xyz.y) / 64, 0, 1)

        // add some roughness
        result.density = density + result.d3 / 7.5

        return result

    }

}