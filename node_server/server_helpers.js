import { BLOCK } from "../www/js/blocks.js";
import { ArrayOrMap, StringHelpers, unixTime } from "../www/js/helpers.js";

export function epochMillis() {
    return ~~Date.now();
}

/**
 * Parses a config containing many-to-many relations between keys and values,
 * and stores the result in a map, which it returns.
 * 
 * @param {Array} conf - its elements can be:
 * - scalars (which represend both a key and a value);
 * - [keys, values], where both keys and values can be scalars or arrays of scalars.
 * @param {Function} transformKey - it's aplied to every key
 * @param {Map, Object or Array} result - the resulting mapping of transformed keys
 *   to values. For each key, it has a list of uniques values associated with this key.
 * @returns the result parametr.
 */
export function parseManyToMany(conf, transformKey = v => v, result = new Map()) {

    function add(key, value) {
        key = transformKey(key);
        var list = ArrayOrMap.get(result, key);
        if (list == null) {
            list = [];
            ArrayOrMap.set(result, key, list);
        }
        if (list.indexOf(value) < 0) {
            list.push(value);
        }
    }

    for(var entry of conf) {
        if (typeof entry !== 'object') {
            add(entry, entry);
            continue;
        }
        if (!Array.isArray(entry) || entry.length !== 2) {
            throw new Error('Elemetns of must be scalars or 2-element arrays. Wrong entry: ' + 
                JSON.stringify(entry));
        }
        var [keys, values] = entry;
        keys = Array.isArray(keys) ? keys : [keys];
        values = Array.isArray(values) ? values : [values];
        for(let key of keys) {
            for(let value of values) {
                add(key, value);
            }
        }
    }
    return result;
}

/**
 * Parses many-to-many conf and impots objects from .js modules.
 * 
 * @param {Array} conf - many-to-many conf, see {@link parseManyToMany}.
 *   A value can be "moduleName", or "moduleName:importDescription".
 *   importDescription can contain ":"; only the 1st ":" is treated as a separator.
 * @param {String} folder
 * @param {Function} transformKey - transforms keys.
 * @param {Function} doImport - imports and processes an export described by a string
 *   from a module. Implementations: {@link simpleImport}, {@link importClassInstance}.
 * @param {Map, Object or Array} result - the resulting mapping of transformed keys
 *   to loaded objects, see {@link parseManyToMany}.
 * @param {Object} uniqueImports - collects all unique [config_value, imported_objct] here.
 * @returns the result parametr,.
 */
export async function loadMappedImports(conf, folder, 
    transformKey = v => v,
    doImport = simpleImport,
    result = new Map(),
    uniqueImports = {}
) {
    parseManyToMany(conf, transformKey, result);
    for(let list of ArrayOrMap.valuesExceptUndefined(result)) {
        for(var i = 0; i < list.length; i++) {
            const rawValue = list[i];
            var imp = uniqueImports[rawValue];
            if (imp == null) {
                var [moduleName, importStr] = StringHelpers.splitFirst(rawValue, ':');
                importStr = importStr || 'default';
                moduleName = folder + moduleName + '.js'
                // TODO amybe async, maybe cache modules
                const module = await import(moduleName);
                imp = doImport(module, importStr);
                if (imp == null) {
                    throw new Error(`Can't import ${importStr} from ${moduleName}`);
                }
                uniqueImports[rawValue] = imp;
            }
            list[i] = imp;
        }
    }
    return result;
}

// https://stackoverflow.com/questions/526559/testing-if-something-is-a-class-in-javascript
function isClass(obj) {
    const isCtorClass = obj.constructor
        && obj.constructor.toString().substring(0, 5) === 'class'
    if (obj.prototype === undefined) {
        return isCtorClass
    }
    const isPrototypeCtorClass = obj.prototype.constructor 
        && obj.prototype.constructor.toString
        && obj.prototype.constructor.toString().substring(0, 5) === 'class'
    return isCtorClass || isPrototypeCtorClass
}

/**
 * It can be passed to {@link loadMappedImports}
 */
export function simpleImport(module, str) {
    return module[str];
}

/**
 * It can be passed to {@link loadMappedImports}
 * Cases:
 * 1. Creates instances of imported classes;
 * 2. Calls imported functions (asumes that they are class factories);
 * 3. Returns imported instances of classes unchanged.
 * In cases 1 and 2, arguments can be described like this:
 *      moduleName:functionOrClassName(arg1, arg2, arg3)
 */
export function importClassInstance(module, str) {
    var [name, args] = StringHelpers.splitFirst(str, '(');
    if (args) {
        args = '[' + args.substr(0, args.length - 1) + ']';
        args = JSON.parse(args);
    } else {
        args = EMPTY_ARRAY;
    }
    const obj = module[name];
    if (typeof obj !== 'function') { // it's null or object
        return obj;
    }
    if (isClass(obj)) {
        return new obj(...args);
    } else {
        // assume it's a factory function
        return obj(...args);
    }
}

/**
 * @param {Array} calleesById - output object {@link DelayedCalls}, optinal.
 *  For the callees, declaring calleeId is optinal; the default value is (folder + key).
 *  Frequently used callees should decalre a short calleeId as an optimization.
 */
export async function loadBlockListeners(conf, folder, calleesById = null) {
    const uniques = {};
    const result = await loadMappedImports(conf, folder, 
        name => BLOCK.fromName(name.toUpperCase()).id,
        importClassInstance, [], uniques);
    if (calleesById) {
        for(var key in uniques) {
            var callee = uniques[key];
            if ('delayedCall' in callee) { // if it's actually a callee
                if (!callee.calleeId) { // we can't just set it becase it may have a getter
                    callee.calleeId = folder + key;
                }
                if (calleesById[callee.calleeId]) {
                    throw new Error('Duplicate calleeId: ' + callee.calleeId);
                }
                calleesById[callee.calleeId] = callee;
            }
        }
    }
    return result;
}

export class DelayedCalls {
    /**
     * @param {Object} calleesById - keys are ids, 
     *  values are objects:
     *  {
     *      delayedCall(args...)
     *      calleeId: String
     *      beforeDelayedSaving(args: Object): Any  // optional
     *      afterDelayedLoading(args: Any): Object  // optional
     *  }
     * 
     * @param {Boolean} sometimesSerialize - if it's true, half the time arguments are
     *  serialized and deserialized before a normal call. It helps debugging: ensures
     * that callees work with both direct and deserialized arguments.
     */
    constructor(calleesById, debugSometimesSerialize = true) {
        this.calleesById = calleesById;
        this.list = []; // sorted by time ascending
        this.debugSometimesSerialize = debugSometimesSerialize
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
                    args = JSON.parse(JSON.stringify(args));
                    if (callee.afterDelayedLoading) {
                        args = callee.afterDelayedLoading(args);
                    }
                }
            }
            entry.args = args;
        }
        var index = this.list.length;
        while(index - 1 >= 0 && entry.time < this.list[index - 1].time) {
            index--;
        }
        this.list.splice(index, 0, entry);
    }

    execute(contextArgs) {
        const now = epochMillis();
        var i = 0;
        while (i < this.list.length && this.list[i].time <= now) {
            var entry = this.list[i];
            const callee = this.calleesById[entry.id];
            // if the loaded callee is not present, skip it - maybe the code has changed
            if (entry.args) {
                callee?.delayedCall(...arguments, ...entry.args);
            } else {
                callee?.delayedCall(...arguments);
            }
            i++;
        }
        if (i > 0) {
            this.list.splice(0, i);
        }
    }

    serialize() {
        for (let entry of this.list) {
            const callee = this.calleesById[entry.id];
            if (callee.beforeDelayedSaving) {
                entry.args = callee.beforeDelayedSaving(entry.args);
            }
        }
        return JSON.stringify(this.list);
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

const EMPTY_ARRAY = [];