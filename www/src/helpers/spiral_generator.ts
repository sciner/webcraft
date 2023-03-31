import {Vector} from "./vector.js";
import {DIR27_BY_SIGN_INDEX} from "../chunk_const.js";

export class SpiralEntry {
    pos = new Vector();
    chunk: any = null;
    newValue: any = null;
    dir27 = 0;
    dist = 0;
    index = 0;
    translated = false;

    constructor() {
    }

    copyTranslate(se, translation) {
        this.pos.copyFrom(se.pos);
        this.pos.addSelf(translation);
        this.dist = se.dist;
        this.index = se.index;
        this.dir27 = se.dir27;
        this.chunk = null;
        this.translated = false;
        return this;
    }
}

function spiralDistSort(a: SpiralEntry, b: SpiralEntry) {
    return a.dist - b.dist;
}

function spiralDirSort(a: SpiralEntry, b: SpiralEntry) {
    if (a.dir27 !== b.dir27) {
        return a.dir27 - b.dir27;
    }
    return a.index - b.index;
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
        let size: number = margin * 2;
        if (SpiralGenerator.cache.has(margin)) {
            return SpiralGenerator.cache.get[margin];
        }
        var resp = [];

        function rPush(vec: IVector) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let x = vec.x - size / 2;
            let z = vec.z - size / 2;
            let dist = Math.sqrt(x * x + z * z);
            if (dist < margin) {
                resp.push(vec);
            }
        }

        let iInd = Math.trunc(size / 2);
        let jInd = Math.trunc(size / 2);
        let iStep = 1;
        let jStep = 1;
        rPush(new Vector(iInd, 0, jInd));
        for (let i = 0; i < size; i++) {
            for (let h = 0; h < i; h++) rPush(new Vector(iInd, 0, jInd += jStep));
            for (let v = 0; v < i; v++) rPush(new Vector(iInd += iStep, 0, jInd));
            jStep = -jStep;
            iStep = -iStep;
        }
        for (let h = 0; h < size - 1; h++) {
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
    static generate3D(vec_margin: IVector): SpiralGrid {
        const cache_key = vec_margin.toString();
        if (SpiralGenerator.cache3D.hasOwnProperty(cache_key)) {
            return SpiralGenerator.cache3D[cache_key];
        }
        const resp = new SpiralGrid(vec_margin);
        const center = new Vector(0, 0, 0);
        const exists: string[] = [];
        const MAX_DIST = vec_margin.x;
        for (let y = -vec_margin.y; y <= vec_margin.y; y++) {
            for (let x = -vec_margin.x; x <= vec_margin.x; x++) {
                for (let z = -vec_margin.z; z <= vec_margin.z; z++) {
                    let vec = new Vector(x, y, z);
                    let dist = Math.round(vec.distance(center) * 1000) / 1000;
                    if (dist <= MAX_DIST) {
                        let key = vec.toString();
                        if (exists.indexOf(key) < 0) {
                            const entry = new SpiralEntry();
                            entry.pos = vec;
                            entry.dist = dist;
                            resp.entries.push(entry);
                            exists.push(key)
                        }
                    }
                }
            }
        }
        const n = resp.entries.length;
        resp.entries.sort(spiralDistSort);
        resp.entriesDir = new Array(n);
        resp.numGrid = new Array(n);
        for (let i = 0; i < resp.entries.length; i++) {
            const entry = resp.entries[i];
            entry.index = i;
            resp.numGrid[resp.size.arrayIndByVec(entry.pos)] = i;
            resp.entriesDir[i] = entry;

            const pos = entry.pos;
            entry.dir27 = DIR27_BY_SIGN_INDEX[entry.pos.signIndex()];
            if (Math.max(Math.abs(pos.x), Math.abs(pos.y), Math.abs(pos.z)) <= 1) {
                entry.dir27 = 0;
            }
        }
        resp.entriesDir.sort(spiralDirSort);
        resp.numDir = new Array();
        for (let i = 0; i < n; i++) {
            resp.numDir[i] = resp.entriesDir[i].index;
        }
        resp.startDir = [0];
        for (let i = 1; i < 28; i++) {
            resp.startDir.push(n);
        }
        let j = 0;
        for (let i = 0; i < n; i++) {
            while (j < resp.entriesDir[i].dir27) {
                j++;
                resp.startDir[j] = i;
            }
        }

        SpiralGenerator.cache3D[cache_key] = resp;
        return resp;
    }
}

/**
 * Metrics to store spiral data
 */
export class SpiralSize {
    marginVec = new Vector();

    cx: number;
    cy: number;
    cz: number;
    cw: number;
    /**
     * number of coord indices for spiral of this size
     */
    outerLen: number;

    constructor(marginVec: IVector) {
        this.marginVec.copyFrom(marginVec);

        this.cx = this.marginVec.y * 2 + 1;
        this.cy = 1;
        this.cz = this.cx * (this.marginVec.x * 2 + 1);
        this.cw = (this.cx * this.marginVec.x + this.cy * this.marginVec.y + this.cz * this.marginVec.z);
        this.outerLen = this.cz * (this.marginVec.z * 2 + 1);
    }

    equal(other: SpiralSize) {
        return this.marginVec.equal(other.marginVec);
    }

    containsXYZ(dx: number, dy: number, dz: number) {
        const {marginVec} = this;
        return Math.abs(dx) <= marginVec.x && Math.abs(dy) <= marginVec.y && Math.abs(dz) <= marginVec.z;
    }

    arrayIndByVec(dvec: IVector) {
        const {marginVec} = this;
        if (Math.abs(dvec.x) <= marginVec.x && Math.abs(dvec.y) <= marginVec.y && Math.abs(dvec.z) <= marginVec.z) {
            return this.cx * dvec.x + this.cy * dvec.y + this.cz * dvec.z + this.cw;
        }
        return -1;
    }
}

const tempVec = new Vector();
const deltaVec = new Vector();

export class SpiralGrid {
    entries: Array<SpiralEntry> = [];
    entriesDir: Array<SpiralEntry> = null;
    startDir: Array<number> = null;
    center = new Vector();
    size: SpiralSize = null;
    numGrid: number[] = null;
    numDir: number[] = null;

    constructor(marginVec: IVector = new Vector()) {
        this.size = new SpiralSize(marginVec);
    }

    make(center: Vector, marginVec: IVector) {
        const {entries} = this;

        const template = SpiralGenerator.generate3D(marginVec);
        const spiral_moves_3d = template.entries;

        this.size = new SpiralSize(marginVec);
        this.center.copyFrom(center);

        this.numGrid = template.numGrid;
        this.numDir = template.numDir;
        this.startDir = template.startDir;
        const entriesDir = this.entriesDir = [];

        while (entries.length < spiral_moves_3d.length) {
            entries.push(new SpiralEntry());
        }
        let n = entries.length = spiral_moves_3d.length;
        for (let i = 0; i < n; i++) {
            entries[i].copyTranslate(spiral_moves_3d[i], center);
            entriesDir.push(entries[this.numDir[i]]);
        }
    }

    translate(newCenter: IVector) {
        const {entries, size, numGrid} = this;
        deltaVec.copyFrom(newCenter).subSelf(this.center);
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            entry.pos.addSelf(deltaVec);
            tempVec.copyFrom(entry.pos).subSelf(this.center);
            entry.translated = false;
            let ind = size.arrayIndByVec(tempVec);
            if (ind < 0) {
                continue;
            }
            ind = numGrid[ind];
            if (ind < 0) {
                continue;
            }
            if (entries[ind]) {
                entry.translated = true;
                entry.newValue = entries[ind].chunk;
            }
        }
        //TODO: events on add/remove here
        for (let i = 0; i < entries.length; i++) {
            entries[i].chunk = entries[i].newValue;
            entries[i].newValue = null;
        }
        this.center.copyFrom(newCenter);
    }

    makeOrTranslate(center: Vector, marginVec: IVector) {
        if (this.entries.length > 0 && this.size.marginVec.equal(marginVec)) {
            this.translate(center);
            return;
        }
        this.make(center, marginVec);
    }

    setChunk(absAddr: Vector, chunk: any) {
        if (!this.numGrid) {
            return;
        }
        tempVec.copyFrom(absAddr).subSelf(this.center);
        let ind = this.size.arrayIndByVec(tempVec);
        if (ind < 0) {
            return;
        }
        ind = this.numGrid[ind];
        if (ind < 0) {
            return;
        }
        //TODO: events on add/remove here
        if (this.entries[ind]) {
            this.entries[ind].chunk = chunk;
        }
    }
}
