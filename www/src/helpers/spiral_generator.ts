import {Vector} from "./vector.js";

export class SpiralEntry {
    pos = new Vector();
    chunk: any = null;
    newValue: any = null;
    translated = false;
    dist = 0;
    indexYZ = 0;

    copyTranslate(se, translation) {
        this.pos.copyFrom(se.pos);
        this.pos.addSelf(translation);
        this.dist = se.dist;
        this.indexYZ = se.indexYZ;
        this.chunk = null;
        this.translated = false;
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
        const MAX_DIST = vec_margin.x;
        const indexByYZ = resp.size.indexByYZ = [];
        const radByYZ = resp.size.radByYZ = [];
        const startByYZ = resp.size.startByYZ = [];
        let cnt = 0;
        for (let y = -vec_margin.y; y <= vec_margin.y; y++) {
            for (let z = -vec_margin.z; z <= vec_margin.z; z++) {
                const d = Math.min(vec_margin.x, Math.floor(Math.sqrt(MAX_DIST * MAX_DIST - y * y - z * z)));
                radByYZ.push(d >= 0 ? d : -1);
                startByYZ.push(cnt);
                if (d < 0) {
                    continue;
                }
                for (let x = -d; x <= d; x++) {
                    const entry = new SpiralEntry();
                    entry.indexYZ = cnt++;
                    entry.pos.set(x, y, z);
                    entry.dist = Math.round(entry.pos.distance(center) * 1000) / 1000;
                    resp.entries.push(entry);
                }
            }
        }
        startByYZ.push(cnt);
        resp.entriesByYZ = resp.entries.slice(0);
        resp.size.len = radByYZ.length;
        resp.entries.sort(function (a: SpiralEntry, b: SpiralEntry) {
            return a.dist - b.dist;
        });
        for (let i = 0; i < resp.entries.length; i++) {
            indexByYZ[resp.entries[i].indexYZ] = i;
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
    radByYZ: number[] = null;
    indexByYZ: number[] = null;
    startByYZ: number[] = null;

    depth: number;
    dw: number;
    len: number;

    /**
     * number of coord indices for spiral of this size
     */
    constructor(marginVec: IVector) {
        this.marginVec.copyFrom(marginVec);

        this.depth = this.marginVec.z * 2 + 1;
        this.dw = this.marginVec.y * this.depth + this.marginVec.z;
        this.len = 0;
    }

    equal(other: SpiralSize) {
        return this.marginVec.equal(other.marginVec);
    }

    arrayIndByVec(dvec: IVector) {
        if (Math.abs(dvec.y) > this.marginVec.y || Math.abs(dvec.z) > this.marginVec.z) {
            return -1;
        }
        let yz = dvec.y * this.depth + dvec.z + this.dw;
        let rad = this.radByYZ[yz];
        if (Math.abs(dvec.x) > rad) {
            return -1;
        }
        return this.startByYZ[yz] + dvec.x + rad;
    }
}

const tempVec = new Vector();
const deltaVec = new Vector();

export class SpiralGrid {
    entries:        Array<SpiralEntry> = []
    entriesByYZ:    SpiralEntry[] = []
    center:         Vector = new Vector()
    size:           SpiralSize = null
    cullIDs:        number[] = []

    constructor(marginVec: IVector = new Vector()) {
        this.size = new SpiralSize(marginVec);
    }

    make(center: Vector, marginVec: IVector) {
        const {entries, entriesByYZ, cullIDs} = this;

        const template = SpiralGenerator.generate3D(marginVec);
        const spiral_moves_3d = template.entries;

        const size = this.size = template.size;
        this.center.copyFrom(center);

        while (entries.length < spiral_moves_3d.length) {
            entries.push(new SpiralEntry());
            cullIDs.push(-1);
        }
        let n = entries.length = entriesByYZ.length = cullIDs.length = spiral_moves_3d.length;
        for (let i = 0; i < n; i++) {
            entries[i].copyTranslate(spiral_moves_3d[i], center);
            entriesByYZ[i] = entries[size.indexByYZ[i]];
        }
    }

    translate(newCenter: IVector) {
        const {entries, entriesByYZ, size} = this;
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
            entry.translated = true;
            entry.newValue = entriesByYZ[ind].chunk;
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
        tempVec.copyFrom(absAddr).subSelf(this.center);
        let ind = this.size.arrayIndByVec(tempVec);
        if (ind < 0 || !this.sortedNumByIndex) {
            return;
        }
        //TODO: events on add/remove here
        this.entriesByYZ[ind].chunk = chunk;
    }

}
