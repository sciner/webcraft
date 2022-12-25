import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from "../../chunk_const.js";
import { Helpers, Mth, Vector } from "../../helpers.js";
import { DENSITY_THRESHOLD, UNCERTAIN_ORE_THRESHOLD } from "./terrain/manager.js";

export const BIOME3_CAVE_LAYERS = [
    {y: 72, octave1: 28.4 + 16, octave2: 28.4, width: 0.2, height: 24, shift: 64000},
    {y: 48, octave1: 32 + 16, octave2: 7.11, width: 0.2, height: 48, shift: 48000},
    {y: 16, octave1: 32 + 16, octave2: 7.11, width: 0.2, height: 16, shift: 16000},
];

export class CaveGenerator {

    constructor(chunk_coord, noisefn, cave_layers) {

        this.cave_layers = cave_layers
        this.chunk_coord = new Vector(chunk_coord.x, 0, chunk_coord.z);
        this.layers = [];

        for(let i = 0; i < cave_layers.length; i++) {
            const options = cave_layers[i];
            const layer = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
            for(let x = 0; x < CHUNK_SIZE_X; x++) {
                for(let z = 0; z < CHUNK_SIZE_Z; z++) {
                    const ax = chunk_coord.x + x + options.shift;
                    const az = chunk_coord.z + z + options.shift;
                    const value1 = noisefn(ax / options.octave1, az / options.octave1);
                    const value2 = noisefn(ax / options.octave2, az / options.octave2);
                    // calc value
                    let value = value1 * .8 + value2 * .1;
                    if(value < 0) value *= -1;
                    if(value > options.width) continue;
                    value = 1 - value / options.width;
                    // generate vertical position of worm
                    const y = options.y + Math.sin(noisefn(ax / 128, az / 128)) * options.height;
                    layer[z * CHUNK_SIZE_X + x] = {
                        density: value / 1.5, // density
                        y: y // vertical position
                    };
                }
            }
            this.layers.push(layer)
        }

    }

    easeInOut(percent, func) {
        let value
        if (percent < 0.5) {
            value = func(percent * 2) / 2
        } else {
            value = 1 - func((1 - percent) * 2) / 2
        }
        return value
    }

    sine(percent) {
        return 1 - Math.cos(percent * Math.PI / 2)
    }

    // Return cave point
    getPoint(xyz, map_cell, in_ocean, density_params) {

        const y_perc = (xyz.y - 20) / 60
        if(y_perc > -1 && y_perc < 1) {
            const mul = this.easeInOut(1 - Math.abs(y_perc), this.sine)
            if(density_params.d1 * mul < -.3) {
                if(density_params.d3 * .8 + density_params.d4 * .2 < 0) {
                    return DENSITY_THRESHOLD + UNCERTAIN_ORE_THRESHOLD * .999
                }
            }
        }

        const x = xyz.x - this.chunk_coord.x;
        const z = xyz.z - this.chunk_coord.z;
        for(let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            const cell = layer[z * CHUNK_SIZE_X + x];
            if(!cell) {
                continue;
            }
            if(in_ocean && map_cell) {
                if(cell.y > map_cell.value2 - 5) {
                    return null;
                }
            }
            const dist = xyz.y - cell.y;
            const dens = cell.density
            if(dist < -2 * dens || dist > (8 + density_params.d4 * 3) * dens) {
                continue;
            }
            return cell.density;
        }
        return null;
    }

}