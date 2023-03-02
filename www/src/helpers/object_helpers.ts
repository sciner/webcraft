// maybe move other related methods here
import {Vector} from "./vector.js";

export class ObjectHelpers {

    static isEmpty(obj: object): boolean {
        for (let _ in obj) {
            return false;
        }
        return true;
    }

    // For now, it supports only plain objects, Array, primitives and Vector.
    static deepClone(v: any, depth : number = Infinity): any {
        if (v == null) {
            return v;
        }
        // Splitting this function into 3 increases(!) performance
        // Probably because JIT can infer static types in deepCloneArray() and deepCloneObject()
        if (v.length != null && Array.isArray(v)) {
            return this.deepCloneArray(v, depth);
        }
        if (typeof v === 'object') {
            return this.deepCloneObject(v, depth);
        }
        return v;
    }

    static deepCloneArray(v: Array<any>, depth: number = Infinity): Array<any> {
        if (--depth < 0) {
            return v;
        }
        const res = new Array(v.length);
        for(let i = 0; i < v.length; i++) {
            res[i] = this.deepClone(v[i], depth);
        }
        return res;
    }

    static deepCloneObject(v: object, depth: number = Infinity): object {
        if (--depth < 0) {
            return v;
        }
        if ((<any>v).x != null && v instanceof Vector) {
            return new Vector(v);
        }
        const res = {};
        for(let key in v) {
            // Don't check hasOwnProperty(key) here, because it's not checked anywhere.
            // If something is added to Object.prototype, the entire project is screwed.
            res[key] = this.deepClone(v[key], depth);
        }
        return res;
    }

    /**
     * It deep compares own properties of the objects.
     * It's not perfect (e.g. it doesn't distnguisgh between absence of a property and an undefined value),
     * but it's good enough for real game use cases.
     *
     * Maybe add support for Map, Set, primitive arrays.
     */
    static deepEqual(a: any, b: any): boolean {
        if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
            return a === b;
        }
        return Array.isArray(a)
            ? Array.isArray(b) && this.deepEqualArray(a, b)
            : this.deepEqualObject(a, b);
    }

    static deepEqualArray(a: AnyArray, b: AnyArray): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for(let i = 0; i < a.length; i++) {
            if (!this.deepEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }

    static deepEqualObject(a: object, b: object): boolean {
        for (let key in a) {
            // We could also check b.hasOwnProperty(key) - i.e. it's not in the prototype,
            // but for real game objects it seems unnecesssary.
            if (!this.deepEqual(a[key], b[key])) {
                return false;
            }
        }
        for (let key in b) {
            if (!(key in a)) {
                return false;
            }
        }
        return true;
    }

    // Returns a result similar to JSON.stringify, but the keys are sorted alphabetically.
    static sortedStringify(obj: any) {
        if (obj == null) {
            return 'null'; // for both null and undefined
        }
        if (typeof obj !== 'object') {
            return JSON.stringify(obj);
        }
        if (Array.isArray(obj)) {
            const transformedArr = obj.map(it => this.sortedStringify(it));
            return '[' + transformedArr.join(',') + ']';
        }
        // it's an object
        const keys = Object.keys(obj).sort();
        for(let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // stringify the key to escape quotes in it
            keys[i] = JSON.stringify(key) + ':' + this.sortedStringify(obj[key]);
        }
        return '{' + keys.join(',') + '}';
    }

    static toMultiline(obj: object, pad = 0) : string {
        const result: string[] = []
        const prefix = ' '.repeat(pad)
        for (const key in obj) {
            result.push(prefix + key + ': ' + obj[key])
        }
        return result.join('\n')
    }
}
