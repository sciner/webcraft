/**
 * Helper methods for working with an Object, Array or Map in the same way - like a map.
 *
 * There are 2 modes when working with arrays:
 * 1. By default, undefined vallues are used to mark empty elements. All other values can be stored and read.
 * 2. If emptyValue parameter in methods is set to null, then:
 *  - neither undefined, nor null can be put into the collection on purpose.
 *  - both undefined and null are skipped during iteration.
 *  - nulls are used to mark empty array elements.
 * It assumes the user doesn't put undefined or emptyValue into a Map or an Object.
 *
 * It can be optimized at the expense of code size.
 */
export class ArrayOrMap {

    static get(collection, key) {
        return collection instanceof Map ? collection.get(key) : collection[key];
    }

    static set(collection, key, value) {
        if (value === undefined) {
            throw new Error("value === undefined");
        }
        if (collection instanceof Map) {
            collection.set(key, value);
        } else {
            collection[key] = value;
        }
    }

    static delete(collection, key, emptyValue = undefined) {
        if (collection instanceof Map) {
            collection.delete(key);
        } else if (Array.isArray(collection)) {
            if (collection.length > key) {
                collection[key] = emptyValue;
            }
        } else {
            delete collection[key];
        }
    }

    /** Yields values expet undefined and {@link emptyValue}. */
    static *values(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.values();
        } else {
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield v;
                }
            }
        }
    }

    static *keys(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.keys();
        } else if (collection.length != null && Array.isArray(collection)) {
            for(let key = 0; key < collection.length; key++) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield key;
                }
            }
        } else {
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield key;
                }
            }
        }
    }

    /** The only difference with {@link keys} is that it returns Object's keys as numbers. */
    static *numericKeys(collection, emptyValue = undefined): IterableIterator<number> {
        if (collection instanceof Map) {
            yield *collection.keys();
        } else if (collection.length != null && Array.isArray(collection)) {
            for(let key = 0; key < collection.length; key++) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield key;
                }
            }
        } else {
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield parseFloat(key);
                }
            }
        }
    }

    /**
     * Yields [key, value], except those with values undefined and {@link emptyValue}.
     * Note: the same muatble entry is reused.
     */
    static *entries(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.entries();
        } else {
            const entry = [null, null];
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    entry[0] = key;
                    entry[1] = v;
                    yield entry;
                }
            }
        }
    }

    /** The only difference with {@link entries} is that it retuens Object's keys as numbers. */
    static *numericEntries(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.entries();
        } else {
            const entry = [null, null];
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    entry[0] = parseFloat(key);
                    entry[1] = v;
                    yield entry;
                }
            }
        }
    }
}
