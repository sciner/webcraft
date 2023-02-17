import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from "../../chunk_const.js";
import { Vector } from "../../helpers.js";
import { DENSITY_AIR_THRESHOLD, UNCERTAIN_ORE_THRESHOLD } from "./terrain/manager.js";

export const BIOME3_CAVE_LAYERS = [
    {y: 76, octave1: 28.4 + 16, octave2: 28.4, width: 0.2, height: 16, shift: 64000},
    {y: 60, octave1: 32 + 16, octave2: 7.11, width: 0.2, height: 16, shift: 48000},
    {y: 44, octave1: 32 + 16, octave2: 7.11, width: 0.2, height: 16, shift: 16000},
];

export class CaveGenerator {

    chunk_coord : any
    noisefn : any
    cave_layers : any

    constructor(chunk_coord : Vector, noisefn : any, cave_layers : any) {
        this.chunk_coord = new Vector(chunk_coord.x, 0, chunk_coord.z);
        this.noisefn = noisefn
        this.cave_layers = cave_layers
    }

}

export class CaveGeneratorRegular extends CaveGenerator {
    [key: string]: any;

    constructor(chunk_coord : Vector, noisefn : any, cave_layers : any) {

        super(chunk_coord, noisefn, cave_layers)
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
                    const y = options.y + Math.sin(noisefn(ax / 164, az / 164)) * options.height;
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

    exp(percent) {
        return Math.pow(2, 10 * (percent - 1))
    }

    // Return cave point
    getPoint(xyz, map_cell, in_ocean, density_params) {

        // Sponge caves
        const y_perc = (xyz.y - 20) / 60
        if(y_perc > -1 && y_perc < 1) {
            const mul = this.easeInOut(1 - Math.abs(y_perc), this.exp)
            if(density_params.d1 * mul < -.3) {
                const sponge_cave_density = density_params.d3 * .8 + density_params.d4 * .2
                if(sponge_cave_density < 0) {
                    let densisiy = DENSITY_AIR_THRESHOLD // плотность воздуха
                    if(sponge_cave_density > -0.1) {
                        // плотность нужная для формирования легкого налета полезных ископаемых
                        densisiy += UNCERTAIN_ORE_THRESHOLD * .999
                    }
                    return densisiy
                }
            }
        }

        const x = xyz.x - this.chunk_coord.x
        const z = xyz.z - this.chunk_coord.z
        for(let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            const cell = layer[z * CHUNK_SIZE_X + x];
            if(!cell) {
                continue
            }
            const vert_dist = xyz.y - cell.y;
            const dens = cell.density
            if(vert_dist < (-1 * (1 + density_params.d4 * 2)) * dens || vert_dist > (8 + density_params.d4 * 3) * dens) {
                continue;
            }
            return DENSITY_AIR_THRESHOLD
        }

        return DENSITY_AIR_THRESHOLD + UNCERTAIN_ORE_THRESHOLD // * .999

    }

}

export class CaveGeneratorBigCaves extends CaveGenerator {
    [key: string]: any;

    constructor(chunk_coord : Vector, noisefn : any, cave_layers : any) {

        super(chunk_coord, noisefn, cave_layers)

        this.layers = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z)

        // const layer = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
        for(let x = 0; x < CHUNK_SIZE_X; x++) {
            for(let z = 0; z < CHUNK_SIZE_Z; z++) {
                const values = this.layers[z * CHUNK_SIZE_X + x] = new Array(cave_layers.length * 2)
                let index = 0;
                for(let i = 0; i < cave_layers.length; i++) {
                    const options = cave_layers[i];
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
                    values[index++] = value / 1.5 // density
                    values[index++] = options.y + Math.sin(noisefn(ax / 164, az / 164)) * options.height // y
                }
            }
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

    exp(percent) {
        return Math.pow(2, 10 * (percent - 1))
    }

    // Return cave point
    getPoint(xyz : Vector, map_cell, in_ocean, density_params) {

        // Sponge caves
        const y_perc = (xyz.y - 20) / 60
        if(y_perc > -1 && y_perc < 1) {
            const mul = 1 // this.easeInOut(1 - Math.abs(y_perc), this.exp)
            if(density_params.d1 * mul < -.3) {
                const sponge_cave_density = density_params.d3 * .8 + density_params.d4 * .2
                if(sponge_cave_density < 0) {
                    let densisity = DENSITY_AIR_THRESHOLD // плотность воздуха
                    if(sponge_cave_density > -0.1) {
                        // плотность нужная для формирования легкого налета полезных ископаемых
                        densisity += UNCERTAIN_ORE_THRESHOLD * .999
                    }
                    return densisity
                }
            }
        }

        const x = xyz.x - this.chunk_coord.x
        const z = xyz.z - this.chunk_coord.z

        if(x < 0 || z < 0 || x >= CHUNK_SIZE_X || z >= CHUNK_SIZE_Z) {
            return DENSITY_AIR_THRESHOLD
        }

        const col = this.layers[z * CHUNK_SIZE_X + x]

        if(!col) debugger

        for(let i = 0; i < col.length; i += 2) {
            const density = col[i]
            const y = col[i + 1]
            const vert_dist = xyz.y - y;
            if(vert_dist < (-1 * (1 + density_params.d4 * 2)) * density || vert_dist > (8 + density_params.d4 * 3) * density) {
                continue;
            }
            return DENSITY_AIR_THRESHOLD
        }

        return DENSITY_AIR_THRESHOLD + UNCERTAIN_ORE_THRESHOLD // * .999

    }

}