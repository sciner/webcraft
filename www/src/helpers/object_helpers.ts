// maybe move other related methods here
import {Vector} from "./vector.js";

export const MAX_DEEP_CLONE_DEPTH = 100

export class ObjectHelpers {

    static isEmpty(obj: object): boolean {
        for (let _ in obj) {
            return false;
        }
        return true;
    }

    static clear(obj: Dict): void {
        for (let key in obj) {
            delete obj[key]
        }
    }

    // For now, it supports only plain objects, Array, primitives and Vector.
    static deepClone(src: any, depth : number = MAX_DEEP_CLONE_DEPTH, out : object = undefined) : any {
        if(src == null) {
            return src
        }
        // Splitting this function into 3 increases(!) performance
        // Probably because JIT can infer static types in deepCloneArray() and deepCloneObject()
        if(src.length != null && Array.isArray(src)) {
            return this.deepCloneArray(src, depth)
        }
        if(typeof src === 'object') {
            return this.deepCloneObject(src, depth, out)
        }
        return src
    }

    static deepCloneArray(src: Array<any>, depth : number = MAX_DEEP_CLONE_DEPTH): Array<any> {
        if(--depth < 0) {
            return src;
        }
        const out = [...src]
        const {deepCloneArray, deepCloneObject} = ObjectHelpers
        for(let i = 0; i < src.length; i++) {
            const val = src[i]
            if(val === null || !(typeof val === 'object')) continue
            out[i] = (val.length != null && Array.isArray(val)) ? deepCloneArray(val, depth) : deepCloneObject(val, depth, undefined)
        }
        return out
    }

    static deepCloneObject(src: any, depth : number = MAX_DEEP_CLONE_DEPTH, out : any = undefined): any {
        if(--depth < 0) {
            return src;
        }
        if((<any>src).x != null && src instanceof Vector) {
            const n = src.n
            src = new Vector(src)
            if(n) {
                (src as Vector).n = new Vector(n)
            }
            return src
        }
        out = out || {...src}
        const {deepCloneArray, deepCloneObject} = ObjectHelpers
        for(let key in src) {
            const val = src[key]
            if(val == null || !(typeof val === 'object')) {
                out[key] = val
                continue
            }
            out[key] = (val.length != null && Array.isArray(val)) ? deepCloneArray(val, depth) : deepCloneObject(val, depth, undefined)
        }
        return out
    }

    /**
     * It deep compares own properties of the objects.
     * It's not perfect (e.g. it doesn't distnguisgh between absence of a property and an undefined value),
     * but it's good enough for real game use cases.
     *
     * Maybe add support for Map, Set, primitive arrays.
     */
    static deepEqual(a: any, b: any): boolean {
        if (a === b) { // первая проверка - хороша как для примитивов, так и для неглдубоко клонированных объектов
            return true
        }
        if (a == null || b == null) {    // т.к. (null === undefined) == false, первая проверка в этом слкчае не выполнилась бы
            return a == b
        }
        if (typeof a !== 'object' || typeof b !== 'object') {
            // Мы уже знаем что (a === b) неверно, т.е. примитивные значения не равны.
            // Специальный случай: если оба NaN, то (NaN === NaN) неверно, но мы хотим вернуть в этом случае true.
            // В остальных случаях - false.
            return Number.isNaN(a) && Number.isNaN(b)
        }
        return a.length != null && Array.isArray(a)
            ? Array.isArray(b) && this.deepEqualArray(a, b)
            : (b.length == null || !Array.isArray(b)) && this.deepEqualObject(a, b)
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

    static toArray<ObjT, ArrT = ObjT>(obj: Dict<ObjT>,
        dst: ArrT[] | null = null,
        length: int | null = null,
        toIndexFn: ((key: string, value: ObjT) => int)  = (key, _) => parseInt(key),
        toValueFn: ((key: string, value: ObjT) => ArrT) = (_, value) => value as any
    ): ArrT[] {
        dst ??= []
        dst.length = length ?? 0
        dst.fill(null)
        for(let key in obj) {
            const value = obj[key]
            const ind = toIndexFn(key, value)
            while (dst.length < ind) {
                dst.push(null)
            }
            dst[ind] = toValueFn(key, value)
        }
        return dst
    }

}