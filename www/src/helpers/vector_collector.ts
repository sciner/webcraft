// VectorCollector...
import type {AABB} from "../core/AABB.js";
import {Vector} from "./vector.js";

export class VectorCollector<T = any> {
    size: int;
    list: Map<int, Map<int, Map<int, T>>>;

    /**
     */
    constructor(list?: any, blocks_size: int | null = null) {
        this.clear(list);
        if(list && (blocks_size !== null)) {
            this.size = blocks_size
        }
    }

    *[Symbol.iterator](): IterableIterator<T> {
        for (let x of this.list.values()) {
            for (let y of x.values()) {
                for (let value of y.values()) {
                    yield value;
                }
            }
        }
    }

    /**
     * All values are split into {@link groupsCount} in an undetermined, but consistent way.
     * Goupd are numbered from 0 to {@link groupsCount} - 1.
     * It method iterates over values from group {@link groupIndex}
     */
    *subsetOfValues(groupIndex: int, groupsCount: int): IterableIterator<T> {
        for (let [x, byX] of this.list) {
            if (((x % groupsCount) + groupsCount) % groupsCount === groupIndex) {
                for (let byY of byX.values()) {
                    yield *byY.values()
                }
            }
        }
    }

    entries(aabb?: AABB): IterableIterator<[Vector, T]> {
        const that = this;
        return (function* () {
            if(that.size == 0) {
                return;
            }
            const vec = new Vector(0, 0, 0);
            for (let [xk, x] of that.list) {
                if(aabb && (xk < aabb.x_min || xk > aabb.x_max)) continue;
                for (let [yk, y] of x) {
                    if(aabb && (yk < aabb.y_min || yk > aabb.y_max)) continue;
                    for (let [zk, value] of y) {
                        if(aabb && (zk < aabb.z_min || zk > aabb.z_max)) continue;
                        vec.set(xk|0, yk|0, zk|0);
                        yield [vec, value];
                    }
                }
            }
        })()
    }

    clear(list : any = null) {
        this.list = list ? list : new Map();
        this.size = 0;
    }

    set(vec: IVector, value: T) : boolean {
        let size = this.size;
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            this.size++;
        }
        if (typeof value === 'function') {
            value = value(vec);
        }
        this.list.get(vec.x).get(vec.y).set(vec.z, value);
        return this.size > size;
    }

    add(vec : IVector, value: T): T {
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            if (typeof value === 'function') {
                value = value(vec);
            }
            this.list.get(vec.x).get(vec.y).set(vec.z, value);
            this.size++;
        }
        return this.list.get(vec.x).get(vec.y).get(vec.z);
    }

    // If the element exists, returns it. Otherwise sets it to the result of createFn().
    getOrSet(vec : IVector, createFn : (vec: IVector) => T): T {
        let byY = this.list.get(vec.x);
        if (byY == null) {
            byY = new Map();
            this.list.set(vec.x, byY);
        }
        let byZ = byY.get(vec.y);
        if (byZ == null) {
            byZ = new Map();
            byY.set(vec.y, byZ);
        }
        let v = byZ.get(vec.z);
        if (v == null && !byZ.has(vec.z)) {
            v = createFn(vec);
            byZ.set(vec.z, v);
            this.size++;
        }
        return v;
    }

    /**
     * Updates a value (existing or non-existng), possibly setting it or deleting it.
     * It's faster than getting and then setting a value.
     * @param {Vector} vec
     * @param {Function} mapFn is called for the existing value (or undefined, if there is no value).
     *   If its result is not null, it's set as the new value.
     *   If its result is null, the value is deleted.
     * @return the new value.
     */
    update(vec : IVector, mapFn : (old?: T) => T | null): T | null {
        let byY = this.list.get(vec.x);
        if (byY == null) {
            byY = new Map();
            this.list.set(vec.x, byY);
        }
        let byZ = byY.get(vec.y);
        if (byZ == null) {
            byZ = new Map();
            byY.set(vec.y, byZ);
        }
        const oldV = byZ.get(vec.z);
        const newV = mapFn(oldV);
        if (newV != null) {
            if (newV !== oldV) {
                if (oldV === undefined && !byZ.has(vec.z)) { // fast check, then slow
                    this.size++;
                }
                byZ.set(vec.z, newV);
            }
        } else {
            if (byZ.delete(vec.z)) {
                this.size--;
            }
        }
        return newV;
    }

    delete(vec : IVector) : boolean {
        let resp = false
        const x = this.list?.get(vec.x)
        if(x) {
            const y = x.get(vec.y)
            if(y) {
                const z = y.get(vec.z)
                if(z) {
                    y.delete(vec.z)
                    resp = true
                    this.size--
                    if(y.size == 0) {
                        x.delete(vec.y)
                        if(x.size == 0) {
                            this.list.delete(vec.x)
                        }
                    }
                }
            }
        }
        return resp
    }

    has(vec : IVector) {
        return this.list.get(vec.x)?.get(vec.y)?.has(vec.z) || false;
    }

    get(vec: IVector): T | null {
        return this.list.get(vec.x)?.get(vec.y)?.get(vec.z) || null;
    }

    keys(): IterableIterator<Vector> {
        const that = this;
        return (function* () {
            if(that.size == 0) {
                return;
            }
            for (let [xk, x] of that.list) {
                for (let [yk, y] of x) {
                    for (let zk of y.keys()) {
                        yield new Vector(xk|0, yk|0, zk|0)
                    }
                }
            }
        })()
    }

    values(): IterableIterator<T> {
        const that = this;
        return (function* () {
            for (let x of that.list.values()) {
                for (let y of x.values()) {
                    for (let value of y.values()) {
                        yield value;
                    }
                }
            }
        })()
    }

    reduce(max_size) {
        if(this.size < max_size) {
            return false;
        }
    }

}
