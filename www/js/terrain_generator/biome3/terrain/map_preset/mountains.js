import { DensityParams } from "../manager_vars.js";

export class MapPresetMountains {

    constructor() {
        this.id = 'mountains';
        this.chance = 40;
        this.relief = 4;
        this.mid_level = 6;
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

        if(!cell.mountain_density) {
            const NOISE_SCALE = 100
            const HEIGHT_SCALE = 150 * dist_percent;
            const max_height = generator_options.WATER_LINE +
                               this.mountainFractalNoise(
                                   noise2d,
                                   xyz.x/3, xyz.z/3,
                                   4, // -- Octaves (Integer that is >1)
                                   3, // -- Lacunarity (Number that is >1)
                                   0.35, // -- Persistence (Number that is >0 and <1)
                                   NOISE_SCALE,
                               ) * HEIGHT_SCALE;
            const d1 = 0;
            const d2 = 0;
            const d3 = (
                noise2d(xyz.x/25, xyz.z/25) +
                noise2d((xyz.x + 1000) / 25, (xyz.z + 1000) / 25)
            ) / 2;
            const d4 = 0;
            cell.mountain_density = new DensityParams(d1, d2, d3, d4, 1);
            cell.mountain_density.max_height = max_height;
            cell.mountain_density_zero = new DensityParams(d1, d2, d3, d4, 0);
        }

        const dens = xyz.y < cell.mountain_density.max_height ? cell.mountain_density : cell.mountain_density_zero;

        result.set(dens.d1, dens.d2, dens.d3, dens.d4, dens.density)
        result.fixed_density = dens.density

        return result

    }

    // Шум для гор
    mountainFractalNoise(noise2d, x, y, octaves, lacunarity, persistence, scale) {
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