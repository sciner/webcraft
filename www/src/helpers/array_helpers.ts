import {Mth} from "./mth.js";

export type UintArrayConstructor = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor

export class ArrayHelpers {
    static EMPTY = []

    /**
     * @param values can be either:
     *  - a single array of scalars
     *  - scalar rest parameters
     * @returns true if {@link arr} includes any of {@link values}
     */
    static includesAny(arr: scalar[], ...values: (scalar | scalar[])[]): boolean {
        if (arr.length) {
            if (values.length === 1 && Array.isArray(values[0])) {
                values = values[0]
            }
            for(const v of values) {
                if (arr.includes(v as scalar)) {
                    return true
                }
            }
        }
        return false
    }

    // elements order is not preserved
    static fastDelete(arr: any[], index: number): void {
        arr[index] = arr[arr.length - 1];
        --arr.length;
    }

    /**
     * Deletes all values equal to {@link value}. Order of elements is not preserved.
     * @return true if anything was deleted
     */
    static fastDeleteValue<T = any>(arr: T[], value: T): boolean {
        let i = 0
        let len = arr.length
        const prevLen = len
        while (i < len) {
            if (arr[i] == value) {
                arr[i] = arr[--len];
            } else {
                i++;
            }
        }
        arr.length = len;
        return prevLen !== len
    }

    static filterSelf<T = any>(arr : T[], predicate: (T) => boolean): void {
        // fast skip elements that don't change
        let src = 0;
        while (src < arr.length && predicate(arr[src])) {
            src++;
        }
        if (src === arr.length) {
            return;
        }
        // move elements
        let dst = src;
        src++;
        while (src < arr.length) {
            if (predicate(arr[src])) {
                arr[dst++] = arr[src];
            }
            ++src;
        }
        arr.length = dst;
    }

    static sum(arr : any[], mapper = (it: any): number => it): number {
        var sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += mapper(arr[i]);
        }
        return sum;
    }

    static max(arr : any[], initial: number = -Infinity, mapper = (it: any): number => it): number {
        let max = initial
        for (let i = 0; i < arr.length; i++) {
            const v = mapper(arr[i])
            if (max < v) {
                max = v
            }
        }
        return max
    }

    /**
     * Creates an array of at least the required length, or increases the length of the existing array.
     * @returns {AnyArray} the given array, or a new one.
     */
    static ensureCapacity(arr: AnyArray | null, length: number, arrayClass?: any): any {
        if (arr) {
            arrayClass ??= arr.constructor
            if (arrayClass !== arr.constructor) {
                throw new Error()
            }
            if (arrayClass === Array) {
                arr[length - 1] = null  // cause the array to grow
            } else { // a typed array
                if (arr.length < length) {
                    arr = new arrayClass(Mth.roundUpToPowerOfTwo(length))
                }
            }
        } else {
            arr = new arrayClass(length)
        }
        return arr
    }

    /**
     * Ensures that the first sortedLength elements are the same as if the entire array
     * was sorted. The order of the remaining elemnets is undefin.
     * It has O(length) time.
     * @param { int } sortedLength - the number of first array elements that will be sorted.
     */
    static partialSort(arr: any[], sortedLength = arr.length, compare: Function,
                       // do not pass the last 2 arguments - they are internal
                       fromIncl = 0, toExcl = arr.length
    ): void {
        while (true) {
            var d = toExcl - fromIncl;
            if (d <= 2) {
                if (d == 2) {
                    var v = arr[fromIncl + 1];
                    if (compare(arr[fromIncl], v) > 0) {
                        arr[fromIncl + 1] = arr[fromIncl];
                        arr[fromIncl] = v;
                    }
                }
                return;
            }
            var left = fromIncl;
            var right = toExcl - 1;
            var m = arr[(fromIncl + toExcl) >> 1];
            do {
                var vl = arr[left];
                while (compare(vl, m) < 0) {
                    vl = arr[++left];
                }
                var vr = arr[right];
                while (compare(vr, m) > 0) {
                    vr = arr[--right];
                }
                if (left > right) {
                    break;
                }
                arr[left] = vr;
                arr[right] = vl;
                left++;
                right--;
            } while (left <= right);
            if (left < sortedLength) {
                this.partialSort(arr, sortedLength, compare, left, toExcl);
            }
            toExcl = left;
        }
    }

    static toObject(arr: any[], toKeyFn = (ind : number, _ : any) => ind, toValueFn = (_ : number, value : any) => value): object {
        const res = {};
        if (typeof toValueFn !== 'function') {
            const value = toValueFn;
            toValueFn = () => value;
        }
        for(let i = 0; i < arr.length; i++) {
            const v = arr[i];
            res[toKeyFn(i, v)] = toValueFn(i, v);
        }
        return res;
    }

    static create<T = any>(size: int, fill?: ((index: int) => T) | T): T[] {
        const arr = new Array(size);
        if (typeof fill === 'function') {
            for(let i = 0; i < arr.length; i++) {
                arr[i] = (fill as Function)(i);
            }
        } else if (fill !== null) {
            arr.fill(fill);
        }
        return arr;
    }

    static copyToFrom(dst: any[], src: any[]): void {
        // it might be not the fastest, needs profiling
        dst.length = 0
        dst.push(...src)
    }

    /** Returns the class of Uint primitive arrays that can hold value {@link maxValue} */
    static uintArrayClassForMaxValue(maxValue : number): UintArrayConstructor {
        return maxValue <= 0xff
            ? Uint8Array
            : (maxValue <= 0xffff ? Uint16Array : Uint32Array)
    }

    /**
     * Return random item from array
     * @param {*[]} arr
     * @returns
     */
    static randomItem(arr : any[]) : any {
        if(!Array.isArray(arr) || arr.length == 0) {
            return undefined
        }
        return arr[(Math.random() * arr.length) | 0]
    }

    static shuffle(array : any[], random_func: Function) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(random_func() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
