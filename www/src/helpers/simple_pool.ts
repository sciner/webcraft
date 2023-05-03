export interface PoolElement {
    reset(): void;
}

export class SimplePool<T extends PoolElement = any> {
    arr: T[] = [];
    arg1: any;
    sz = 0;
    clazz: new (arg1?: any) => T;

    constructor(clazz: new (arg1?: any) => T, arg1?: any) {
        this.clazz = clazz;
        this.arg1 = arg1;
    }

    alloc() {
        if (this.sz > 0) {
            this.sz--;
            const elem = this.arr[this.sz];
            this.arr[this.sz] = null;
            return elem;
        }
        return new this.clazz(this.arg1);
    }

    free(item) {
        item.reset();
        this.arr[this.sz++] = item;
    }
}