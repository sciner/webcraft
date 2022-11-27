import { alea } from "../default.js";
import { createNoise3D } from '../../../vendors/simplex-noise.js';
import { Vector } from "../../helpers.js";

const oneVector = new Vector(1, 1, 1);

export class Noise3d {
    constructor(factory, seed, randomFunc) {
        this.factory = factory;
        this.seed = seed;

        // For WebASM we can use Float32Array
        this.result = new Float64Array(factory.outputSize);
        this.genPos = null;
        this.genSize = null;
        this.cx = 0;
        this.cy = 0;
        this.cz = 0;
        this.cw = 0;
        this.cgen = 0;
        this.scales = [];

        if (randomFunc) {
            this.alea = null;
            this.noise3d = createNoise3D(randomFunc);
        } else {
            this.alea = new alea(seed);
            this.noise3d = createNoise3D(this.alea.double);
        }
    }

    generate(pos, size = oneVector, scale = 1.0, genNum = 0) {
        this.genPos = pos;
        this.genSize = size;
        this.cx = 1;
        this.cy = size.x;
        this.cz = size.x * size.y;
        this.cgen = size.x * size.y * size.z;
        this.shiftCoord = -(this.cx * pos.x + this.cy * pos.y + this.cz * pos.z);

        const {result} = this;

        let ind = genNum * this.cgen;
        for (let z = 0; z < size.z; z++)
            for (let y = 0; y < size.y; y++)
                for (let x = 0; x < size.x; x++)
                {
                    result[ind++] = this.noise3d((pos.x + x) * scale, (pos.y + y) * scale, (pos.z + z) * scale);
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
}

export class NoiseFactory {
    constructor() {
        this.outputSize = 0;
    }

    async init({ outputSize, maxNoises = 1 }) {
        this.outputSize = outputSize;
        this.maxNoises = maxNoises;
    }

    createNoise3D({seed, randomFunc}) {
        const noise = new Noise3d(this, seed, randomFunc);
        // might use integer id for where its stored in wasm
        return noise;
    }

    async gen() {

    }
}