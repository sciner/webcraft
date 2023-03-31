export interface PoolElement {
    reset(): void;
}

export class SimplePool<T extends PoolElement = any> {
    arr: T[] = [];
    sz = 0;
    clazz: new () => T;

    constructor(clazz: new () => T) {
        this.clazz = clazz;
    }

    alloc() {
        if (this.sz > 0) {
            this.sz--;
            const elem = this.arr[this.sz];
            this.arr[this.sz] = null;
            return elem;
        }
        return new this.clazz();
    }

    free(item) {
        item.reset();
        this.arr[this.sz++] = item;
    }
}