import { BLOCK } from "../www/js/blocks.js";

export async function loadListeners(conf, folder, nameToId = v => v, callees = null) {
    const res = new Map();
    for (let key in conf) {
        const id = nameToId(key);
        var values = conf[key];
        if (values == null) {
            values = [key];
        } else if (typeof values === "string") {
            values = [values];
        }
        for (let value of values) {
            // TODO maybe cache
            await import(folder + value + '.js').then(module => {
                let listener = new module.default();
                if (callees) {
                    // TODO validate that ids are not repeated
                    callees[listener.calleeId] = listener;
                }
                var list = res.get(id);
                if (list == null) {
                    list = [];
                    res.set(id, list);
                }
                list.push(listener);
            });
        }
    }
    return res;
}

export async function loadBlockListeners(conf, folder, callees = null) {
    return await loadListeners(conf, folder, 
        name => BLOCK.fromName(name.toUpperCase()).id, 
        callees);
}

export class DelayedCalls {
    /**
     * @param {Object} callees - keys are callees ids,
     *  and elements are callees.
     * 
     * Each callee must have:
     * - calleeId: String
     * - delayedCall(context, varargs...)
     */
    constructor(callees) {
        this.callees = callees;
        this.list = []; // sorted by time ascending
    }

    get length() {
        return this.list.length;
    }

    /**
     * @param {Array} args - arguments pased to the function. 
     *    The 0th element is "this".
     */
    add(delay, callee, args = EMPTY_ARRAY) {
        const entry = {
            time: performance.now() + delay,
            id: callee.calleeId,
            args
        }
        var index = 0;
        while(index < this.list.length && entry.time >= this.list[index].time) {
            index++;
        }
        this.list.splice(index, 0, entry);
    }

    execute(context) {
        const now = performance.now();
        var i = 0;
        while (i < this.list.length && this.list[i].time <= now) {
            var entry = this.list[i];
            const callee = this.callees[entry.id];
            callee.delayedCall(context, ...entry.args);
            this.list[i] = this.list[this.list.length - 1];
            this.list.length--;
        }
        if (i > 0) {
            this.list.splice(0, i);
        }
    }
}

const EMPTY_ARRAY = [];