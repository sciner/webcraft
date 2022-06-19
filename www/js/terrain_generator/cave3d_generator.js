import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import { Vector } from "../helpers.js";

const CAVE = { octave1: 56.8, octave2: 28.4, limit: 0.9, shift: 64000 };

export class Cave3DGenerator {

    constructor(noisefn3d) {
        this.noisefn3d = noisefn3d
    }

    // Return cave point
    getPoint(xyz, map_cell, in_ocean) {
        const layer = this.layer;
        const ay = xyz.y + CAVE.shift;
        const ax = xyz.x + CAVE.shift;
        const az = xyz.z + CAVE.shift;
        const value1 = this.noisefn3d(ax / CAVE.octave1, ay / CAVE.octave2, az / CAVE.octave1);
        const value2 = this.noisefn3d(333.3 + ax / CAVE.octave1, 333.3 + ay / CAVE.octave2, 333.3 + az / CAVE.octave1);
        if ((1-Math.abs(value1))*(1-Math.abs(value2)) > CAVE.limit) {
            return 1;
        }

        return null;
    }
}