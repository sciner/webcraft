import { alea } from "../default.js";
import { createNoise3DOpt } from './optimizedNoise.js';
import { Vector } from "../../helpers.js";
import type { DensityParams } from "./terrain/manager_vars.js";

const oneVector = new Vector(1, 1, 1);

export class Noise3d {
    [key: string]: any;
    
    result: Float32Array
    
    constructor(factory, seed, randomFunc, map_noise_shift : IVector) {
        this.factory = factory;
        this.seed = seed;

        this.result = new Float32Array(factory.outputSize);
        this.genPos = new Vector();
        this.genSize = null;
        this.cx = 0;
        this.cy = 0;
        this.cz = 0;
        this.cw = 0;
        this.cgen = 0;
        this.scales = [];
        this.map_noise_shift = map_noise_shift

        if (randomFunc) {
            this.alea = null;
            this.noise3d = createNoise3DOpt(randomFunc);
        } else {
            this.alea = new alea(seed);
            this.noise3d = createNoise3DOpt(this.alea.double);
        }

        this.scoreCounter = 0;
    }

    generate(pos: IVector, size = oneVector, scale = 1.0, genNum = 0) {
        this.genPos.copyFrom(pos).addSelf(this.map_noise_shift)
        this.genSize = size;
        this.cx = 1;
        this.cy = size.x;
        this.cz = size.x * size.y;
        this.cgen = size.x * size.y * size.z;
        this.shiftCoord = -(this.cx * pos.x + this.cy * pos.y + this.cz * pos.z);

        const {result} = this;

        let ind = genNum * this.cgen;
        for (let z = 0; z < size.z; z++)
            for (let y = 0; y < size.y; y++) {
                this.noise3d(pos.x * scale, (pos.y + y) * scale, (pos.z + z) * scale, scale, size.x, result, ind);
                ind += size.x;
            }
    }

    setScale4(scale1, scale2, scale3, scale4) {
        this.scales = [scale1, scale2, scale3, scale4];
    }

    generate4(pos, size) {
        const {scales} = this;
        this.generate(pos, size, scales[0], 0);
        this.generate(pos, size, scales[1], 1);
        this.generate(pos, size, scales[2], 2);
        this.generate(pos, size, scales[3], 3);
        this.scoreCounter += size.x * size.y * size.z;
    }

    getLocalAt(gen, vec) {
        const {cx, cy, cz, cgen, result} = this;
        const ind = gen * cgen + cx * vec.x + cy * vec.y + cz * vec.z;
        return result[ind];
    }

    getGlobalAt(gen, vec) {
        const {cx, cy, cz, shiftCoord, cgen, result} = this;
        const ind = gen * cgen + cx * vec.x + cy * vec.y + cz * vec.z + shiftCoord;
        return result[ind];
    }

    fetchGlobal4(vec : Vector, out : DensityParams) {
        const {cx, cy, cz, shiftCoord, cgen, result} = this;
        const ind = cx * vec.x + cy * vec.y + cz * vec.z + shiftCoord;
        if(ind < 0 || ind >= cgen) {
            throw 'error_invalid_noise_index'
        }
        out.d1 = result[ind];
        out.d2 = result[ind + cgen];
        out.d3 = result[ind + cgen * 2];
        out.d4 = result[ind + cgen * 3];
    }
}

export class NoiseFactory {
    [key: string]: any;
    constructor() {
        this.outputSize = 0;
    }

    async init({ outputSize, maxNoises = 1 }) {
        this.outputSize = outputSize;
        this.maxNoises = maxNoises;
    }

    createNoise3D({seed, randomFunc, map_noise_shift}) {
        const noise = new Noise3d(this, seed, randomFunc, map_noise_shift);
        // might use integer id for where its stored in wasm
        return noise;
    }

    async gen() {

    }
}