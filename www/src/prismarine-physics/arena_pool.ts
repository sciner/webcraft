import type {PoolElement} from "../helpers/simple_pool.js";

/** Пул который возвращает в себя все ранее выделенные элементы одним вызовом {@link reset} */
export class ArenaPool<T = any> {
    private arr     : T[] = []
    private arg1    : any
    private used    = 0     // число использованных элементов в массиве
    private clazz   : new (arg1?: any) => T

    /**
     * @param clazz - конструктор эементов
     * @param arg1 - аргумент конструктора эементов
     */
    constructor(clazz: new (arg1?: any) => T, arg1?: any) {
        this.clazz = clazz
        this.arg1 = arg1
    }

    /** @returns объект из пула, действительный до следующего вызова {@link reset} */
    alloc(): T {
        const arr = this.arr
        if (this.used === arr.length) {
            arr.push(new this.clazz(this.arg1))
        }
        return arr[this.used++]
    }

    /**
     * Возвращает в пул все ранее выделенные из него объекты.
     * Очищет их если они имеют метод {@link PoolElement.reset}
     */
    reset(): void {
        if (this.used) {
            const arr = this.arr
            if ((arr[0] as PoolElement).reset) {
                for(let i = 0; i < this.used; i++) {
                    (arr[i] as PoolElement).reset()
                }
            }
            this.used = 0
        }
    }

}