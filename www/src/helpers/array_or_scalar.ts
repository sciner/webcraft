// Helper methods to work with an array or a scalar in the same way.
export class ArrayOrScalar {

    // Returns Array or null as is. Non-null scalars are wraped into an array.
    static toArray<T = any>(v: T | T[]): T[] {
        return (v == null || Array.isArray(v)) ? v as T[] : [v];
    }

    static *values<T = any>(v: T | T[]): IterableIterator<T> {
        if (Array.isArray(v)) {
            yield* v
        } else {
            yield v
        }
    }

    static get<T = any>(v: T | T[], index: int): T {
        return Array.isArray(v) ? v[index] : v;
    }

    static find<T = any>(v: T | T[], fn: (v: T) => boolean): T {
        return Array.isArray(v)
            ? v.find(fn)
            : (fn(v) ? v : null)
    }

    /** For aray, the same as {@link Array.map}. For scalar, returns {@link fn} applied to it. */
    static map<T = any, OutT = any>(v: T | T[], fn: (v: T) => OutT): OutT | OutT[] {
        return Array.isArray(v) ? v.map(fn) : fn(v);
    }

    // Sets the length of an Array, but doesn't change a scalar
    static setArrayLength<T = any>(v: T | T[], length: int): T | T[] {
        if (Array.isArray(v)) {
            v.length = length;
        }
        return v;
    }

    /** Similar to {@link map}, but changes the array itself instead of creating a copy. */
    static mapSelf<T = any, OutT = any>(v: T | T[], fn: (v: T) => OutT): OutT | OutT[] {
        if (Array.isArray(v)) {
            for(let i = 0; i < v.length; i++) {
                (v as any[])[i] = fn(v[i]);
            }
            return v as any[];
        } else {
            return fn(v);
        }
    }
}
