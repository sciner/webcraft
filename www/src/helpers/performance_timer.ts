import {ObjectHelpers} from "./object_helpers.js";

export class PerformanceTimer {

    #names : {name: string, p: number}[] = []
    #keys : string[] = []   // a reusable temporary array

    result: Map<string, number> = new Map()
    /** The total time measured by this timer */
    sum: number = 0
    /**
     * The total number of uses. The exact semantics is up to the caller.
     * It's delcared here for convenience, but not managed by this class, because
     * it doesn't know which start() and stop() to cosider the same or different uses.
     */
    count: number = 0
    #countByTopKey = {}

    constructor() {
    }

    start(name: string) : void {
        this.#names.push({name, p: performance.now()})
    }

    stop() : PerformanceTimer {
        this.#keys.length = 0
        for(let item of this.#names) {
            this.#keys.push(item.name)
        }
        const key = this.#keys.join(' -> ')
        const item = this.#names.pop()
        if(item === undefined) {
            throw 'error_not_started'
        }
        const diff = performance.now() - item.p
        const exist_value = this.result.get(key) ?? 0
        this.result.set(key, exist_value + diff)
        if (this.#keys.length === 1) {
            this.sum += diff
        }
        return this
    }

    /** Adds the sum as a field (which will be exported with other fields). */
    addSum(key : string = 'sum') : PerformanceTimer {
        this.result.set(key, this.sum)
        return this
    }

    /** Add to this timer values from the other timer */
    addFrom(other : PerformanceTimer) : PerformanceTimer {
        this.sum += other.sum
        this.count += other.count
        for(const [key, value] of other.result) {
            this.result.set(key, (this.result.get(key) ?? 0) + value)
        }
        return this
    }

    round() : PerformanceTimer {
        for(const [key, value] of this.result.entries()) {
            this.result.set(key, Math.round(value))
        }
        return this
    }

    filter(minTime : number = 1) : PerformanceTimer {
        for(const [key, value] of this.result.entries()) {
            if(value < minTime) {
                this.result.delete(key)
            }
        }
        return this
    }

    export() : object {
        return Object.fromEntries(this.result.entries())
    }

    exportMultiline(pad = 0) : string {
        return ObjectHelpers.toMultiline(this.export(), pad)
    }
}
