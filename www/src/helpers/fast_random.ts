import {impl as alea} from "../../vendors/alea.js";

// FastRandom...
export class FastRandom {
    int32s: any[];
    doubles: any[];
    index: number;
    cnt: any;
    length: any;

    /**
     * @param seed : string
     * @param cnt : int
     */
    constructor(seed : string, cnt : int, mul : number = 1, round: boolean = false) {
        const a = new alea(seed);
        this.int32s = new Array(cnt);
        this.doubles = new Array(cnt);
        this.index = 0;
        this.cnt = cnt;
        this.length = cnt;
        for(let i = 0; i < cnt; i++) {
            this.int32s[i] = a.int32() * mul
            this.doubles[i] = a.double() * mul
            if(round) {
                this.doubles[i] = Math.round(this.doubles[i])
            }
        }
    }

    double(offset : int) : float {
        offset = Math.abs(offset) % this.cnt;
        return this.doubles[offset];
    }

    int32(offset : int) : int {
        offset = Math.abs(offset) % this.cnt;
        return this.int32s[offset];
    }

}

/**
 * @param {string} seed
 * @param {int} len
 * @returns
 */
export function createFastRandom(seed : string, len : int = 512) {
    const random_alea = new alea(seed);
    // fast random
    const randoms = new Array(len); // new Float32Array(len)
    for(let i = 0; i < len; i++) {
        randoms[i] = random_alea.double();
    }
    let random_index = 0;
    // return random_alea.double
    return () => randoms[random_index++ % len];
}
