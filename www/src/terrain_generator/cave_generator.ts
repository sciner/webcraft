import { Vector } from "../helpers.js";

const CAVE_LAYERS = [
                        {y: 56, octave1: 28.4, octave2: 28.4, width: 0.12, height: 24, shift: 64000},
                        {y: 32, octave1: 32, octave2: 7.11, width: 0.12, height: 48, shift: 48000},
                        {y: 0, octave1: 32, octave2: 7.11, width: 0.12, height: 16, shift: 16000},
                    ];

export class CaveGenerator {
    [key: string]: any;

    constructor(grid, chunk_coord, noisefn) {
        this.grid = grid;
        const CHUNK_SIZE_X = this.CHUNK_SIZE_X = grid.chunkSize.x;
        const CHUNK_SIZE_Z = grid.chunkSize.z;
        this.chunk_coord = new Vector(chunk_coord.x, 0, chunk_coord.z);
        this.layers = [];

        for(let i = 0; i < CAVE_LAYERS.length; i++) {
            const options = CAVE_LAYERS[i];
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

    // Return cave point
    getPoint(xyz, map_cell, in_ocean) {
        const CHUNK_SIZE_X = this.grid.chunkSize.x;
        const x = xyz.x - this.chunk_coord.x;
        const z = xyz.z - this.chunk_coord.z;
        for(let i = 0; i < CAVE_LAYERS.length; i++) {
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
            if(dist < -5 * dens || dist > 5 * dens) {
                continue;
            }
            return cell.density;
        }
        return null;
    }

}