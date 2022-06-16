import {GeometryPool} from "./GeometryPool.js";

export class Worker05GeometryPool extends GeometryPool {
    constructor(context, {
        pageSize = 227,
        pageCount = 100,
        instanceSize = 18,
    }) {
        super(context)

        this.instanceSize = instanceSize;
        this.pageCount = pageCount;
        this.pageSize = pageSize;
        this.pages = [];
        this.freePageStack = [];
        this.freePageCount = pageCount;
        for (let i = 0; i < pageCount; i++) {
            const page = new Worker05GeometryPage({
                sizeQuads: this.pageSize,
                instanceSize: this.instanceSize
            });
            this.pages.push(page);
            this.freePageStack.push(page);
        }
    }

    allocPage() {
        if (this.freePageCount === 0) {
            const page = new Worker05GeometryPage({
                sizeQuads: this.pageSize,
                instanceSize: this.instanceSize
            });
            this.pages.push(page);
            return page;
        }
        const page = this.freePageStack[--this.freePageCount];
        this.freePageStack[this.freePageCount] = null;
        return page;
    }
}

export class Worker05GeometryPage {
    constructor({sizeQuads = 227, instanceSize = 18}) {
        this.sizeQuads = sizeQuads;
        this.instanceSize = instanceSize;
        this.data = new Float32Array(sizeQuads * instanceSize);
        this.clear();
    }

    clear() {
        this.filled = 0;
    }
}

export class Worker05SubGeometry {
    constructor({pool, chunkDataId}) {
        this.pool = pool;
        this.pages = [];
        this.chunkDataId = chunkDataId;
        this.lastPage = null;
        this.clear();
    }

    clear() {
        const {pages, pool} = this;
        for (let i = 0; i < pages.length; i++) {
            pool.freePageStack[pool.freePageCount++] = pages[i];
            pages[i].clear();
        }
        pages.length = 0;
        this.filled = 0;
        this.touch = 0;
    }

    push(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9,
         arg10, arg11, arg12, arg13, arg14, arg15, arg16) {
        if (!this.lastPage || this.lastPage.filled === this.lastPage.sizeQuads) {
            this.pages.push(this.lastPage = this.pool.allocPage());
        }

        const data = this.lastPage.data;
        const ind = (this.lastPage.filled++) * 18;
        this.filled++;

        data[ind] = arg0;
        data[ind + 1] = arg1;
        data[ind + 2] = arg2;
        data[ind + 3] = arg3;
        data[ind + 4] = arg4;
        data[ind + 5] = arg5;
        data[ind + 6] = arg6;
        data[ind + 7] = arg7;
        data[ind + 8] = arg8;
        data[ind + 9] = arg9;
        data[ind + 10] = arg10;
        data[ind + 11] = arg11;
        data[ind + 12] = arg12;
        data[ind + 13] = arg13;
        data[ind + 14] = arg14;
        data[ind + 15] = arg15;
        data[ind + 16] = arg16;
        data[ind + 17] = this.chunkDataId;
    }

    // offsets are in instances
    pushData(floatBuffer, offsetI, countI) {
        const {instanceSize} = this.pool;
        //TODO: easier version, just copy a few quads
        while (countI > 0) {
            if (!this.lastPage || this.lastPage.filled === this.lastPage.sizeQuads) {
                this.pages.push(this.lastPage = this.pool.allocPage());
            }

            const inst = Math.min(countI, this.lastPage.sizeQuads - this.lastPage.filled);
            this.lastPage.data.set(floatBuffer.subarray(offsetI * instanceSize, (offsetI + inst) * instanceSize),
                this.lastPage.filled * instanceSize);
            this.lastPage.filled += inst;
            this.filled += inst;

            countI -= inst;
            offsetI += inst;
        }
    }
}