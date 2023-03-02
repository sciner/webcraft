import {Vector} from "./vector.js";

export class SpiralEntry {
    [key: string]: any;
    dist: number;
    pos: Vector;
    chunk: any;
    constructor() {
        this.pos = new Vector();
        this.dist = 0;
        this.chunk = null;
    }

    copyTranslate(se, translation) {
        this.pos.copyFrom(se.pos);
        this.pos.addSelf(translation);
        this.dist = se.dist;
        this.chunk = null;
        return this;
    }
}

/**
 * SpiralGenerator
 */
export class SpiralGenerator {
    [key: string]: any;

    static cache = new Map();
    static cache3D = {};

    // generate ...
    static generate(margin: int) {
        let size : number = margin * 2;
        if(SpiralGenerator.cache.has(margin)) {
            return SpiralGenerator.cache.get[margin];
        }
        var resp = [];
        function rPush(vec : IVector) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let x = vec.x - size / 2;
            let z = vec.z - size / 2;
            let dist = Math.sqrt(x * x + z * z);
            if(dist < margin) {
                resp.push(vec);
            }
        }
        let iInd = Math.trunc(size / 2);
        let jInd = Math.trunc(size / 2);
        let iStep = 1;
        let jStep = 1;
        rPush(new Vector(iInd, 0, jInd));
        for(let i = 0; i < size; i++) {
            for (let h = 0; h < i; h++) rPush(new Vector(iInd, 0, jInd += jStep));
            for (let v = 0; v < i; v++) rPush(new Vector(iInd += iStep, 0, jInd));
            jStep = -jStep;
            iStep = -iStep;
        }
        for(let h = 0; h < size - 1; h++) {
            rPush(new Vector(iInd, 0, jInd += jStep));
        }
        SpiralGenerator.cache.set(margin, resp);
        return resp;
    }

    /**
     * generate3D
     * @param {Vector} vec_margin
     * @returns
     */
    static generate3D(vec_margin : IVector) : SpiralEntry[] {
        const cache_key = vec_margin.toString();
        if(SpiralGenerator.cache3D.hasOwnProperty(cache_key)) {
            return SpiralGenerator.cache3D[cache_key];
        }
        const resp : SpiralEntry[] = [];
        const center = new Vector(0, 0, 0);
        const exists : string[] = [];
        const MAX_DIST  = vec_margin.x;
        for(let y = -vec_margin.y; y <= vec_margin.y; y++) {
            for(let x = -vec_margin.x; x <= vec_margin.x; x++) {
                for(let z = -vec_margin.z; z <= vec_margin.z; z++) {
                    let vec = new Vector(x, y, z);
                    let dist = Math.round(vec.distance(center) * 1000) / 1000;
                    if(dist <= MAX_DIST) {
                        let key = vec.toString();
                        if(exists.indexOf(key) < 0) {
                            const entry = new SpiralEntry();
                            entry.pos = vec;
                            entry.dist = dist;
                            resp.push(entry);
                            exists.push(key)
                        }
                    }
                }
            }
        }
        resp.sort(function(a : SpiralEntry, b : SpiralEntry) {
            return a.dist - b.dist;
        });
        SpiralGenerator.cache3D[cache_key] = resp;
        return resp;
    }
}
