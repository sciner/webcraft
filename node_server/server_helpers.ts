import {ArrayHelpers, ObjectHelpers, StringHelpers} from "@client/helpers.js";

export function epochMillis() {
    return Date.now();
}

/** Импорт из некоторых директорий, совместимый с rollup */
async function rollupImport(dir: string, file: string): Promise<any> {
    switch(dir) {
        case './ticker/listeners/': return import(`./ticker/listeners/${file}.js`);
    }
    throw new Error('Unsupported directory: ' + dir);
}

/**
 * Ипортирует объект или экземпляр класса из модуля:
 *  - если импортируется клаасс - создает его экземпляр через new
 *  - если импортируется функция, она считается фабрикой классов - вызывает ее и возвращает реузльтат
 *  - иначе (просто объект) - возвращает его
 * @param classDescription - строка, описывающая импортируемый класс. Форматы:
 *  - "moduleName" - импортирует default из модуля
 *  - "moduleName:name" - импортирует name из модуля moduleName
 *  - "moduleName:name(arg1, arg2, arg3)" - импортирует name из модуля moduleName и использует указанные
 *    аргументы при вызове функции или конструктора.
 */
export async function importInstance<T>(folder: string, classDescription: string): Promise<T> {
    let [moduleName, importStr] = StringHelpers.splitFirst(classDescription, ':')
    importStr ??= 'default'
    const module = await rollupImport(folder, moduleName)
    let [name, args] = StringHelpers.splitFirst(importStr, '(')
    if (args) {
        args = '[' + args.substr(0, args.length - 1) + ']';
        args = JSON.parse(args);
    } else {
        args = ArrayHelpers.EMPTY
    }
    let obj = module[name];
    if (obj === undefined) {
        throw new Error(`Can't import ${importStr} from ${folder + moduleName}.js`);
    }
    if (typeof obj === 'function') {
        // https://stackoverflow.com/questions/526559/testing-if-something-is-a-class-in-javascript
        const isClass = obj.constructor?.toString().substring(0, 5) === 'class' ||
            obj.prototype?.constructor?.toString().substring(0, 5) === 'class'
        obj = isClass ? new obj(...args) : obj(...args)
    }
    return obj
}

export class DelayedCalls {
    calleesById: any;
    list: any[];
    debugSometimesSerialize: boolean;
    dirty: boolean;
    /**
     * @param { object } calleesById - keys are ids,
     *  values are objects:
     *  {
     *      delayedCall(args...)
     *      calleeId: String
     *      beforeDelayedSaving(args: Object): Any  // optional
     *      afterDelayedLoading(args: Any): Object  // optional
     *  }
     * beforeDelayedSaving and afterDelayedLoading can be used to convert (object references <-> ids)
     *
     * @param { boolean } sometimesSerialize - if it's true, half the time arguments are
     *  serialized and deserialized before a normal call. It helps debugging: ensures
     * that callees work with both direct and deserialized arguments.
     */
    constructor(calleesById, debugSometimesSerialize = true) {
        this.calleesById = calleesById;
        this.list = []; // sorted by time ascending
        this.debugSometimesSerialize = debugSometimesSerialize
        this.dirty = false;
    }

    get length() {
        return this.list.length;
    }

    /**
     * @param {Array} args - arguments pased to the function.
     *    The 0th element is "this".
     */
    add(calleeId, delay, args) {
        const callee = this.calleesById[calleeId];
        if (!callee) {
            throw new Error("Unknown calleeId: " + calleeId);
        }
        const entry = {
            id: calleeId,
            time: epochMillis() + delay
        }
        if (args?.length) {
            if (this.debugSometimesSerialize) {
                callee._debugDelayedSerialize = !callee._debugDelayedSerialize;
                if (callee._debugDelayedSerialize) {
                    if (callee.beforeDelayedSaving) {
                        args = callee.beforeDelayedSaving(args);
                    }
                    // not deepClone - it's intentional, we need to see the effect of stringiy
                    args = JSON.parse(JSON.stringify(args));
                    if (callee.afterDelayedLoading) {
                        args = callee.afterDelayedLoading(args);
                    }
                }
            }
            (entry as any).args = args;
        }
        var index = this.list.length;
        while(index - 1 >= 0 && entry.time < this.list[index - 1].time) {
            index--;
        }
        this.list.splice(index, 0, entry);
        this.dirty = true;
    }

    execute(contextArgs) {
        const now = epochMillis();
        var i = 0;
        while (i < this.list.length && this.list[i].time <= now) {
            var entry = this.list[i];
            const callee = this.calleesById[entry.id];
            // if the loaded callee is not present, skip it - maybe the code has changed
            if (!callee) {
                continue;
            }
            if (entry.args) {
                callee(...arguments, ...entry.args);
            } else {
                callee(...arguments);
            }
            i++;
        }
        if (i > 0) {
            this.list.splice(0, i);
            this.dirty = true;
        }
    }

    serialize() {
        const list = [...this.list];
        for (let i = 0; i < list.length; i++) {
            let entry = list[i];
            const callee = this.calleesById[entry.id];
            if (callee.beforeDelayedSaving) {
                entry = ObjectHelpers.deepClone(entry);
                entry.args = callee.beforeDelayedSaving(entry.args);
                list[i] = entry;
            }
        }
        return JSON.stringify(list);
    }

    deserialize(str) {
        this.list = JSON.parse(str);
        for (let entry of this.list) {
            const callee = this.calleesById[entry.id];
            if (callee.afterDelayedLoading) {
                entry.args = callee.afterDelayedLoading(entry.args);
            }
        }
    }
}

export class PacketHelpers {

    /**
     * Starts countdown of atemps and time for a packet.
     * Returns true until the coundown ends. After that, returns false.
     */
    static waitInQueue(packet, ttl, maxAttempts = 2000000000) {
        const now = performance.now();
        if (!packet.attempts_count) {
            packet.expiress = now + ttl;
            packet.attempts_count = 0;
        }
        return ++packet.attempts_count <= maxAttempts && packet.expiress >= now;
    }
}