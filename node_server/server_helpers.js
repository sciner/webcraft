import { ArrayOrMap, StringHelpers, ArrayHelpers } from "../www/js/helpers.js";
import mkdirp from 'mkdirp';
import path from 'path';

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

async function rollupImport(dir, file) {
    switch(dir) {
        case './ticker/listeners/': return import(`./ticker/listeners/${file}.js`);
    }
    throw new Error('Unsupported directory: ' + dir);
}

/**
 * Parses many-to-many conf and impots objects from .js modules.
 * 
 * @param {Array} conf - the reult of {@link parseManyToMany}.
 *   The values can be "moduleName", or "moduleName:importDescription".
 *   importDescription can contain ":"; only the 1st ":" is treated as a separator.
 * @param {String} folder
 * @param {Function} doImport - imports and processes an export described by a string
 *   from a module. Implementations: {@link simpleImport}, {@link importClassInstance}.
 * @param {Map, Object or Array} result - the resulting mapping of transformed keys
 *   to loaded objects, see {@link parseManyToMany}.
 * @param {Object} uniqueImports - collects all unique [config_value, imported_objct] here.
 * @returns the result parametr,.
 */

export async function loadMappedImports(resultMap,
    folder,
    doImport = simpleImport,
    uniqueImports = {}
) {
    // load missing unique imports into uniqueImports as promises
    const promises = [];
    for(let list of ArrayOrMap.values(resultMap)) {
        for(var i = 0; i < list.length; i++) {
            const fullImportString = list[i];
            if (uniqueImports[fullImportString]) {
                continue;
            }
            // declare them const, otherwise functions use the same value from the closure
            const [moduleName, importStr_] = StringHelpers.splitFirst(fullImportString, ':');
            const importStr = importStr_ || 'default';            
            const p = rollupImport(folder, moduleName).then(function (module) {                    
                const imp = doImport(module, importStr, fullImportString);
                if (imp == null) {
                    moduleName = folder + moduleName + '.js'
                    throw new Error(`Can't import ${importStr} from ${moduleName}`);
                }
                return imp;
            });
            uniqueImports[fullImportString] = p;
            promises.push(p);
        }
    }
    // await all promises and replace the strings with imported objects
    return await Promise.all(promises).then(async function () {
        for(let list of ArrayOrMap.values(resultMap)) {
            for(var i = 0; i < list.length; i++) {
                const fullImportString = list[i];
                var imp = uniqueImports[fullImportString];
                if (imp instanceof Promise) {
                    imp = await imp; // it's already resolved
                    uniqueImports[fullImportString] = imp;
                    imp._mappedfullImportString = fullImportString;
                }
                list[i] = imp;
            }
        }
        return resultMap;
    });
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
export function simpleImport(module, str, fullStr) {
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
export function importClassInstance(module, str, fullImportString) {
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

export function importClassInstanceWithId(module, str, fullImportString) {
    const res = importClassInstance(module, str);
    res.importString = fullImportString;
    return res;
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

/**
 * Copies files from {@link srcDir} to {@link dstDir} if the destination doesn't exist, or is older.
 * Deletes files and directories from {@link dstDir} if they aren't present in {@link srcDir}.
 * Recursively processes subfolders.
 * @return {Boolean} true if anything has been changed
 */
export async function syncDirectory(srcDir, dstDir) {

    async function readdirExt(dir) {
        const files = await fs.promises.readdir(dir) // get filenames
        for(let i = 0; i < files.length; i++) {
            const fullName = path.join(dir, files[i])
            files[i] = {
                name: files[i],
                fullName,
                stat: await fs.promises.stat(fullName)
            }
        }
        return files
    }

    let changed = false
    await mkdirp(dstDir)
    const srcFiles = await readdirExt(srcDir).catch(err => {
        throw `Can't read ${srcDir}`
    })
    const dstFiles = await readdirExt(dstDir)
    const srcFilesByName = ArrayHelpers.toObject(srcFiles, (i, v) => v.name)
    const dstFilesByName = ArrayHelpers.toObject(dstFiles, (i, v) => v.name)

    // copy new and/or updated files and directories
    for(const srcFile of srcFiles) {
        if (srcFile.stat.isDirectory()) {
            // sync subfolder recursively
            const dstFullName = path.join(dstDir, srcFile.name)
            if (await syncDirectory(srcFile.fullName, dstFullName)) {
                changed = true
            }
        } else {
            // copy the file if the destination is older, or doesn't exist, or isn't a file
            let dstFile = dstFilesByName[srcFile.name]
            if (dstFile?.stat?.isDirectory()) {
                await fs.promises.rm(dstFile.fullName, { recursive: true })
                dstFile = null
                changed = true
            }
            if (!dstFile ||
                srcFile.stat.ctimeMs > dstFile.stat.ctimeMs ||
                srcFile.stat.mtimeMs > dstFile.stat.mtimeMs
            ) {
                const dstFullName = path.join(dstDir, srcFile.name)
                await fs.promises.copyFile(srcFile.fullName, dstFullName)
                changed = true
            }
        }
    }

    // delete dst files that don't exist in srcDir
    for(const dstFile of dstFiles) {
        if (!srcFilesByName[dstFile.name]) {
            await fs.promises.rm(dstFile.fullName, { recursive: true })
            changed = true
        }
    }

    return changed
}