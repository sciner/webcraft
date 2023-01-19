import { ArrayHelpers } from "../../www/js/helpers.js";

/**
 * Helps write bulk queries with JSON parameters.
 * Replaces:
 *   %N => json_extract(value, '$[N]')
 *     where N is an index in the JSON array: 0, 1, 2, ...
 *   line breaks, sequenes of multiple space => a single space
 */
export function preprocessSQL(query) {
    return query
        .replaceAll(/%(\d+)/g, "json_extract(value,'\$[$1]')")
        .replaceAll(/--[^\n]*\n/g, '\n') // remove single-line comments (it'll break SQL if it's inside a string literal)
        .replaceAll(/\s+/g, ' ')  // multiline => single line, reduce sequences of spaces (again, we assume it's not inside a string literal)
        .trim();
}

/**
 * A wrapper around a bulk select query.
 * It collects multiple requests and selects them together, but provides API like
 * connection.get() and connection.all(), where only rows requested by each caller are
 * are returned to them.
 * 
 * Host parameters for each row are passed as JSON array of arrays.
 * Additional uniform host parameters can be passed.
 * "key" field in JSON may be used to index the result rows.
 * 
 * 3 type of queries are supported:
 * 1. one-to-one - returns the same number of rows as JSON, doesn't use "key" field, can be queried with get()
 *   FROM json INNER JOIN table (when we are certain that the rows exist, and ready to get an Error thrown otherwise)
 *   FROM json LEFT JOIN table
 * 2. one-to-(0 or 1) - returns the same or smaller number of rows, uses "key" field, can be queried with get().
 *   FROM json INNER JOIN table
 *   FROM json, table WHERE table.*** = json.***
 *   FROM table WHERE table.*** IN (SELECT *** FROM json)
 * 3. many-to-many - returns any number of rows, uses "key" field, can be queried with all().
 *   FROM json *** JOIN table
 *   FROM json, table WHERE ***
 * 
 * Warning: get() and all() don't resolve unil flush() is called. If they are awaited,
 * ensure that flush() is called before that, or in another chain of promises, so it 
 * doesn't cause deadlock.
 */
export class BulkSelectQuery {

    /**
     * @param conn
     * @param {String} query
     * @param {?String} rowKeyName - if it's specified, each returnd row is expected to have a
     *   field equal to the index of the corresponding row of source data.
     *   See the types of queries where it's needed in {@link BulkSelectQuery}
     *   Note: from_json() provides "key" field with such semantics, use it (or rename it if there is a naming conflict).
     * @param {Function} filterFn - called for each result row. Only rows where it returns true are returned.
     * @param {String} jsonHostParameterName - the name of the host parameter for the source array of the rows.
     */
    constructor(conn, query, rowKeyName = null, filterFn = null, jsonHostParameterName = ':jsonRows') {
        this.conn = conn;
        this.query = preprocessSQL(query);
        this.rowKeyName = rowKeyName;
        this.filterFn = filterFn;
        this.jsonHostParameterName = jsonHostParameterName;
        this.data = [];
        this.handlers = [];
        this.modeAll = null; // false - used get, true - used all, null - not used yet
    }

    /**
     * Adds one row of arguments to the queue to be queird when {@link flush} is called.
     * @param {Array of Any} srcRow - the parametrs to query one row
     * @return {Promise of ?Object} - a promise of (one row or null)
     */
    async get(srcRow) {
        if (this.modeAll === true) {
            throw new Error("all() and get() can't be mixed");
        }
        this.modeAll = false;
        return this._add(srcRow);
    }

    async all(srcRow) {
        if (!this.rowKeyName) {
            throw Error("all() can't be called without rowKeyName parameter");
        }
        if (this.modeAll === false) {
            throw new Error("all() and get() can't be mixed");
        }
        this.modeAll = true;
        return this._add(srcRow);
    }

    /**
     * Queries all the data previously passed to {@link get}.
     * @param {Object} uniformHostParameters - additional parameters that are not included in
     *   each row of data. The data itself is added to these parameters as a field.
     */
    async flush(uniformHostParameters = {}) {
        if (typeof uniformHostParameters !== 'object') {
            throw new Error(`The host parameters ${uniformHostParameters} should be in an Object in: ${this.query}`);
        }
        if (!this.data.length) {
            return;
        }
        uniformHostParameters[this.jsonHostParameterName] = JSON.stringify(this.data);
        const handlers = this.handlers;
        const onRows = this.modeAll
            ? rows => { // a handler for "all" mode
                // results for each request
                const results = ArrayHelpers.create(handlers.length / 2, i => []);
                // group rows by request
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (this.filterFn && !this.filterFn(row)) {
                        continue;
                    }
                    const key = row[this.rowKeyName];
                    if (!(key >= 0 && key < results.length)) {
                        throw Error(`Invalid key field "${this.rowKeyName}"=${key} in: ${this.query}`);
                    }
                    results[key].push(row);
                }
                // resolve promises
                for(let i = 0; i < results.length; i++) {
                    handlers[2 * i](results[i]);
                }
            } : rows => { // a handler for "get" mode
                const dataLength = handlers.length / 2; // can't use mutable this.data.length here
                if (!this.rowKeyName && rows.length !== dataLength) {
                    throw Error('Without rowKeyName parameter, a query must return the same number of rows as the JSON: ' + this.query);
                }
                // resolve promises for rows
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (this.filterFn && !this.filterFn(row)) {
                        continue;
                    }
                    let key = i;
                    if (this.rowKeyName) {
                        key = row[this.rowKeyName];
                        if (!(key >= 0 && key < dataLength)) {
                            throw Error(`Invalid key "${this.rowKeyName}"=${key} field in: ${this.query}`);
                        }
                    }
                    const handlerInd = key * 2;
                    const handler = handlers[handlerInd];
                    if (!handler) {
                        throw new Error(`Invalid or duplicate key field "${this.rowKeyName}"=${key} in: ${this.query}`);
                    }
                    handler(row);
                    handlers[handlerInd] = null;
                }
                // resolve promises for non-existing rows
                if (this.filterFn || rows.length !== dataLength) {
                    for(let i = 0; i < handlers.length; i += 2) {
                        const handler = handlers[i];
                        handler && handler(null);
                    }
                }
            };
        const promise = this.conn.all(this.query, uniformHostParameters).then(
            onRows,
            err => {
                console.error('Error in: ' + this.query);
                // reject all requests
                for(let i = 1; i < handlers.length; i += 2) {
                    handlers[i](err);
                }
                throw err;
            }
        );
        this.data = []; // make a new object, don't clear the exitong array
        this.handlers = [];
        this.modeAll = null;
        return promise;
    }

    async _add(srcRow) {
        this.data.push(srcRow);
        const promise = new Promise( (resolve, reject) => {
            this.handlers.push(resolve, reject);
        });
        return promise;
    }

}