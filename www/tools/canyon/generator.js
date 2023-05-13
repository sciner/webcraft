import { createNoise2D, createNoise3D } from '../../vendors/simplex-noise.js';
import {alea, CANYON} from "../../js/terrain_generator/default.js";

import {Vector} from '../../js/helpers.js';
// import {API_Client} from '../../js/ui/api.js';

// const api = new API_Client()

const WORLD_SEED = 1740540541
const START_COORD = new Vector(1000, 0, 18000)

//
const cnv = document.getElementById('sandbox_canvas')
const ctx = cnv.getContext('2d', { alpha: false })

const a = new alea(WORLD_SEED)
const noise2d = createNoise2D(a.double)
const SIZE = 1000
const SCALE = 20

class Sandbox {

    generate(vec, imgData) {

        const xz = new Vector()
        const s = SIZE / SCALE / 2

        for(let x = 0; x < 1000; x++) {
            for(let z = 0; z < 1000; z++) {
                const index = (z * 1000 + x) * 4
                xz.copyFrom(START_COORD).addScalarSelf(x/s/2, 0, z/s/2)
                const n = noise2d(xz.x, xz.z) * 1
                const n2 = noise2d((xz.x + 5000) / 2, (xz.z + 5000) / 2) * 2
                const n3 = noise2d((xz.x + 10000) / 4, (xz.z + 10000) / 4) * 4
                const value = Math.abs(n + n2 + n3) / 7
                let r = 0
                let g = 0
                let b = 0
                if(value < CANYON.FLOOR_DENSITY / 8) {
                    b = 255
                } else if(value < CANYON.DENSITY_MARGIN / 4) {
                    b = 128
                }

                if(x % s == 0 || z % s == 0) g = 128

                imgData.data[index + 0] = r
                imgData.data[index + 1] = g
                imgData.data[index + 2] = b
                imgData.data[index + 3] = 255
            }
        }

    }

}

const sandbox = globalThis.sandbox = new Sandbox()
const imgData = ctx.getImageData(0, 0, 1000, 1000)
const pn = performance.now()
sandbox.generate(START_COORD, imgData)
console.log(performance.now() - pn)
ctx.putImageData(imgData, 0, 0)