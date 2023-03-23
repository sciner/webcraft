/**
 * A queue backed by an array that wraps around.
 * shift() and length are compatible with that of Array.
 * push() is not fully compatible with Array: it doesn't support multiple arguments.
 */
export class SimpleQueue<T = any> {
    arr: T[];
    left = 0;
    length = 0; // the number of actually used elements

    constructor() {
        this.arr = [null]; // a single element to prevent division by 0
    }

    push(v: T): void {
        if (this.length === this.arr.length) {
            this._grow();
        }
        this.arr[(this.left + this.length) % this.arr.length] = v;
        this.length++;
    }

    unshift(v: T): void {
        if (this.length === this.arr.length) {
            this._grow();
        }
        this.left = (this.left + this.arr.length - 1) % this.arr.length;
        this.arr[this.left] = v;
        this.length++;
    }

    shift(): T | undefined {
        if (this.length === 0) {
            return;
        }
        const v = this.arr[this.left];
        this.arr[this.left] = null; // free memory
        this.left = (this.left + 1) % this.arr.length;
        this.length--;
        return v;
    }

    get(index: int): T | undefined {
        if (index >= 0 && index < this.length) {
            return this.arr[(this.left + index) % this.arr.length];
        }
    }

    getFirst(): T | undefined {
        if (this.length) {
            return this.arr[this.left]
        }
    }

    getLast(): T | undefined {
        if (this.length) {
            return this.arr[(this.left + this.length - 1) % this.arr.length]
        }
    }

    /** Sets (replaces) an existing element within the queue. */
    set(index: int, value: T): T {
        if (index < 0 || index >= this.length) {
            throw new Error()
        }
        return this.arr[(this.left + index) % this.arr.length] = value;
    }

    _grow(): void {
        // grow: copy the beginning into the end; the beginning becomes empty.
        for(let i = 0; i < this.left; i++) {
            this.arr.push(this.arr[i]);
            this.arr[i] = null; // free memory
        }
        // ensure that at least one element is added
        this.arr.push(null);
    }
}
