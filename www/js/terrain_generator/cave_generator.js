import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from "../chunk_const.js";
import { Vector } from "../helpers.js";

const CAVE_SCALE            = 1;
const CAVE_NOISE_SCALE      = 4.5;
const CAVE_WIDTH            = 0.08 * CAVE_SCALE;
const CAVE_OCTAVE_1         = 64 / CAVE_SCALE;
const CAVE_OCTAVE_2         = CAVE_OCTAVE_1 / CAVE_NOISE_SCALE;
const LAYER_SHIFT           = 8192;
const CAVE_LAYERS           = 3;

export class CaveGenerator {

    constructor(chunk_coord, noisefn) {

        this.chunk_coord = new Vector(chunk_coord.x, 0, chunk_coord.z);
        this.layers = [];

        for(let i = 0; i < CAVE_LAYERS; i++) {
            const layer = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
            for(let x = 0; x < CHUNK_SIZE_X; x++) {
                for(let z = 0; z < CHUNK_SIZE_Z; z++) {
                    const ax = chunk_coord.x + x + LAYER_SHIFT * i;
                    const az = chunk_coord.z + z + LAYER_SHIFT * i;
                    const value1 = noisefn(ax / CAVE_OCTAVE_1, az / CAVE_OCTAVE_1);
                    const value2 = noisefn(ax / CAVE_OCTAVE_2, az / CAVE_OCTAVE_2);
                    // calc value
                    let value = value1 * .8 + value2 * .1;
                    if(value < 0) value *= -1;
                    if(value > CAVE_WIDTH) continue;
                    value = 1 - value / CAVE_WIDTH;
                    // generate vertical position of worm
                    const y = (i * 32) + Math.sin(noisefn(ax / 128, az / 128)) * 32 + (i * 3);
                    layer[z * CHUNK_SIZE_X + x] = {
                        value, // density
                        y // vertical position
                    };
                }
            }
            this.layers.push(layer)
        }

    }

    // Return cave point
    getPoint(xyz, map_cell, in_ocean) {
        const x = xyz.x - this.chunk_coord.x;
        const z = xyz.z - this.chunk_coord.z;
        for(let i = 0; i < CAVE_LAYERS; i++) {
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
            const dens = cell.value / 1.5
            if(dist < -5 * dens || dist > 5 * dens) {
                continue;
            }
            return cell.value;
        }
        return null;
    }

}