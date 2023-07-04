import { Mth, Vector } from "../../../../helpers.js";
import { ClimateParams, DensityParams, DENSITY_AIR_THRESHOLD, MapCellPreset } from "../manager_vars.js";
import type { TerrainMapCell } from "../map_cell.js";

export class MapCellPreset_Mountains extends MapCellPreset {
    max_height:     number;
    noise_scale:    number;
    climate:        ClimateParams;
    prev_x:         int = Infinity
    prev_z:         int = Infinity
    mfn:            float = null

    constructor() {
        super('mountains', {chance: 4, relief: 4, mid_level: 6})
        this.max_height = 150;
        this.noise_scale = 200
        this.climate = new ClimateParams(.6, .75) // Лес
    }

    modifyClimate(xz : Vector, params : ClimateParams) : boolean {
        params.temperature = this.climate.temperature
        params.humidity = this.climate.humidity
        return true
    }

    calcMaxHeight(xyz : Vector) : float {
        return this.max_height
    }

    calcDensity(xyz : Vector, cell : TerrainMapCell, dist_percent : float, noise2d : any, generator_options : any, result : DensityParams) : DensityParams {

        const shift = generator_options.map_noise_shift

        if(cell.mountains_max_height === undefined) {
            const max_height = this.calcMaxHeight(xyz)
            const HEIGHT_SCALE = max_height * dist_percent;

            let mfn = this.mfn
            if(mfn === null || this.prev_x != xyz.x || this.prev_z != xyz.z) {
                this.prev_x = xyz.x
                this.prev_z = xyz.z
                mfn = this.mfn = this.mountainFractalNoise(noise2d, (xyz.x + shift.x) / 3, (xyz.z + shift.z) / 3, 4, 3, 0.35, this.noise_scale)
            }

            cell.mountains_height =  generator_options.WATER_LEVEL + mfn * HEIGHT_SCALE
        }

        const density = Mth.clamp(DENSITY_AIR_THRESHOLD + (cell.mountains_height - xyz.y) / 64, 0, 1)

        // add some roughness
        result.density = density + result.d3 / 7.5

        return result

    }

    /**
     * Шум для гор
     * @param noise2d 
     * @param x 
     * @param y 
     * @param octaves Octaves (Integer that is >1)
     * @param lacunarity Lacunarity (Number that is >1)
     * @param persistence Persistence (Number that is >0 and <1)
     * @param scale 
     */
    mountainFractalNoise(noise2d, x, y, octaves, lacunarity, persistence, scale) : float {
        // The sum of our octaves
        let value = 0
        // These coordinates will be scaled the lacunarity
        let x1 = x
        let y1 = y
        // Determines the effect of each octave on the previous sum
        let amplitude = 1
        for (let i = 1; i < octaves; i++) {
            // Multiply the noise output by the amplitude and add it to our sum
            value += noise2d(x1 / scale, y1 / scale) * amplitude;
            // Scale up our perlin noise by multiplying the coordinates by lacunarity
            y1 *= lacunarity
            x1 *= lacunarity
            // Reduce our amplitude by multiplying it by persistence
            amplitude *= persistence
        }
        // It is possible to have an output value outside of the range [-1,1]
        // For consistency let's clamp it to that range
        return Math.abs(value); // Helpers.clamp(value, -1, 1)
    }

}