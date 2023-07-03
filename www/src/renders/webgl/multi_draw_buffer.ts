export class MultiDrawBuffer {
    arrZeros: Int32Array;
    arrSixes: Int32Array;
    counts: Int32Array;
    offsets: Uint32Array;
    offsetsInt: Int32Array;
    size: number;
    constructor(capacity = 64) {
        this.resize(capacity);
    }

    ensureSize(sz) {
        if (sz <= this.size) {
            return;
        }
        while (sz > this.size) {
            this.size *= 2;
        }
        this.resize(this.size);
    }

    resize(sz) {
        this.size = sz;
        const oldCnt = this.counts, oldOff = this.offsets;
        this.arrZeros = new Int32Array(sz);
        this.arrSixes = new Int32Array(sz);
        this.counts = new Int32Array(sz);
        this.offsets = new Uint32Array(sz);
        this.offsetsInt = new Int32Array(this.offsets.buffer);
        for (let i = 0; i < sz; i++) {
            this.arrSixes[i] = 6;
        }
        if (oldCnt) {
            this.counts.set(oldCnt, 0);
            this.offsets.set(oldOff, 0);
        }
    }
}