import { ArrayHelpers, StringHelpers } from "@client/helpers.js";

const SQLITE_MAX_VARIABLE_NUMBER = 999; // used for bulk queries with (?,?,?), see https://www.sqlite.org/limits.html

/** Хэндлер, позволяющий окончить транзакию и одновременно выполнить promise (чтобы следующий ждущий мог начать транзакию) */
export class Transaction {

    private conn: DBConnection
    private resolve: Function

    constructor(conn: DBConnection, resolve: Function) {
        this.conn = conn
        this.resolve = resolve
    }

    async commit() {
        await this.conn.run('commit')
        this.resolve()
    }

    async rollback() {
        await this.conn.run('rollback')
        this.resolve()
    }
}

/** Обеспечивает безопасное поочередное выполнение транзакций. */
export class TransactionMutex {

    private conn: DBConnection
    private promise = Promise.resolve()

    constructor(conn: DBConnection) {
        this.conn = conn
    }

    /**
     * Ждет когда предыдщая транзакция завершится. Потом начинает транзакцию.
     * Несколько вызовом могут ожидать в очереди. Они будут выполнены в порядке создания.
     * @returns хенлер транзакции. Обязательно(!) надоб вызвать один из его методов чтобы закрыть транзакции
     *   (обязательно поместить закрытите в catch или finally блок, чтобы не пропустить)
     */
    async beginTransaction(): Promise<Transaction> {
        const prevPromise = this.promise
        let transaction: Transaction
        this.promise = new Promise( resolve => {
            transaction = new Transaction(this.conn, resolve)
        })
        // Wait for the completion of the previous transaction (successful or not).
        // Rollback of a failed transaction is responsibility of the caller.
        try {
            await prevPromise
        } catch(e) {
            console.error('Awaiting transaction promise', e)
            // проглотить исключение, чтобы передать управление следующему ждущему
        }
        await this.conn.run('begin transaction')
        return transaction
    }

    /**
     * Ждет когда предыдщая транзакция завершится. Потом запрещает создание новых транзакций пока
     * вызывющий не сообщит что уже можно (через коллбэк).
     * @returns коллбэк, который нужно обязательно вызывать когда разрешено начинать новые транзакции.
     *   Не забывать про catch или finally, см. {@link begin}
     */
    async noTransaction(): Promise<() => void> {
        const prevPromise = this.promise
        let resolve: () => void
        this.promise = new Promise( r => resolve = r)
        try {
            await prevPromise
        } catch(e) {
            console.error('Awaiting transaction promise', e)
            // проглотить исключение, чтобы передать управление следующему ждущему
        }
        return resolve
    }
}

/**
 * It helps write bulk queries with JSON parameters.
 * Replaces:
 *   %N => json_extract(value, '$[N]')
 *     where N is an index in the JSON array: 0, 1, 2, ...
 *   line breaks, sequenes of multiple space => a single space
 *
 * An example:
 *   `UPDATE user
 *   SET inventory = %1      -- this is a comment
 *   FROM      json_each(?)  -- this line has extra spaces
 *   WHERE user.id = %0`
 * is turned into
 *  "UPDATE user SET inventory = json_extract(value, '$[1]') FROM json_each(?) WHERE user.id = json_extract(value, '$[0]')"
 */
export function preprocessSQL(query: string): string {
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
export class BulkSelectQuery<T = any> {
    conn: DBConnection;
    query: string;
    rowKeyName: string;
    filterFn: (row: T) => boolean | null;
    jsonHostParameterName: string;
    data: (DBJsonParam[] | DBJsonParam)[];
    handlers: Function[];
    modeAll: boolean | null;

    /**
     * @param {?String} rowKeyName - if it's specified, each returnd row is expected to have a
     *   field equal to the index of the corresponding row of source data.
     *   See the types of queries where it's needed in {@link BulkSelectQuery}
     *   Note: from_json() provides "key" field with such semantics, use it (or rename it if there is a naming conflict).
     * @param {Function} filterFn - called for each result row. Only rows where it returns true are returned.
     * @param {String} jsonHostParameterName - the name of the host parameter for the source array of the rows.
     */
    constructor(conn: DBConnection, query: string, rowKeyName: string = null, filterFn: (row: T) => boolean | null = null, jsonHostParameterName: string = ':jsonRows') {
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
     * Similar to {@link DBConnection.get}. Quesries one row.
     *
     * In its implementstion, it adds one row of arguments to the queue to be queird when {@link flush} is called.
     * @param srcRow - the parametrs to query one row
     */
    async get(srcRow: DBJsonParam[] | DBJsonParam): Promise<T | null> {
        if (this.modeAll === true) {
            throw new Error("all() and get() can't be mixed");
        }
        this.modeAll = false;
        return this._add(srcRow) as Promise<T | null>;
    }

    /**
     * Similar to {@link DBConnection.all}. Quesries a set of rows.
     *
     * In its implementstion, it adds one row of arguments to the queue to be queird when {@link flush} is called.
     * @param srcRow - the parametrs to query a set of rows
     */
    async all(srcRow: DBJsonParam[] | DBJsonParam) : Promise<T[]> {
        if (!this.rowKeyName) {
            throw Error("all() can't be called without rowKeyName parameter");
        }
        if (this.modeAll === false) {
            throw new Error("all() and get() can't be mixed");
        }
        this.modeAll = true;
        return this._add(srcRow) as Promise<T[]>;
    }

    /**
     * Queries all the data previously passed to {@link get} and {@link get}, which will allow their promises to resolve.
     * @param { object } uniformHostParameters - additional parameters that are not included in
     *   each row of data. The data itself is added to these parameters as a field.
     */
    flush(uniformHostParameters: DBQueryNamedParams = {}): void {
        if (typeof uniformHostParameters !== 'object') {
            throw new Error(`The host parameters ${uniformHostParameters} should be in an Object in: ${this.query}`);
        }
        if (!this.data.length) {
            return;
        }
        uniformHostParameters[this.jsonHostParameterName] = JSON.stringify(this.data);
        const handlers = this.handlers;
        const onRows = this.modeAll
            ? (rows: T[]) => { // a handler for "all" mode
                // results for each request
                const results = ArrayHelpers.create(handlers.length / 2, i => []);
                // group rows by request
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (this.filterFn && !this.filterFn(row)) {
                        continue;
                    }
                    const key = row[this.rowKeyName] as number;
                    if (!(key >= 0 && key < results.length)) {
                        throw Error(`Invalid key field "${this.rowKeyName}"=${key} in: ${this.query}`);
                    }
                    results[key].push(row);
                }
                // resolve promises
                for(let i = 0; i < results.length; i++) {
                    handlers[2 * i](results[i]);
                }
            } : (rows: T[]) => { // a handler for "get" mode
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
                        key = row[this.rowKeyName] as number;
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
        this.conn.all(this.query, uniformHostParameters).then(
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
    }

    private async _add(srcRow: DBJsonParam[] | DBJsonParam): Promise<T | null | T[]> {
        this.data.push(srcRow);
        const promise: Promise<T | null | T[]> = new Promise( (resolve, reject) => {
            this.handlers.push(resolve, reject);
        });
        return promise;
    }

}

/**
 * It constructs and runs a query with host parameters passed as (?,?,?).
 * It's slower than passing parameters in JSON, but it can pass BLOB.
 * It automatically splits a query into multiple batches to not exceed {@link SQLITE_MAX_VARIABLE_NUMBER}
 *
 * @param {string} sqlPrefix - the first part of the query string, ending with "VALUES"
 * @param {string} sqlValues - a part of the query string containing (?,?,?,...)
 * @param {string} sqlSuffix - the second part of the query string
 * @param {DBQueryParams[]} rows - the rows with data. The lenth of each row must be the same as
 *   the number of '?' in sqlValues.
 *
 * An exmaple. There is a table foo_bar with 3 filelds: {id: number, foo: string, bar: string}
 * We need to update 3 rows with known ids: 10, 11, 15.
 * {@link sqlPrefix} = 'WITH cte (_id, _foo, _bar) AS (VALUES'
 * {@link sqlValues} = '(?,?,?)'
 * {@link sqlSuffix} =
 *      `)UPDATE foo_bar
 *      SET foo = _foo, bar = _bar
 *      FROM cte WHERE id = _id`
 * {@link sqlSuffix} rows = [[10, 'a', 'b'], [11, 'q', 'w'], [15, 'a', 's']]
 * It'll generate a query like this:
 *   `WITH cte (_id, _foo, _bar) AS (VALUES
 *   (?,?,?),(?,?,?),(?,?,?)
 *   )UPDATE foo_bar
 *   SET foo = _foo, bar = _bar
 *   FROM cte WHERE id = _id`
 * and run it with parameters = [10, 'a', 'b', 11, 'q', 'w', 15, 'a', 's']
 */
export async function runBulkQuery(conn: DBConnection, sqlPrefix: string, sqlValues: string, sqlSuffix: string, rows: DBQueryParams[]) {

    function runQuery() {
        if (queryDataCount !== dataCount) {
            query = sqlPrefix + sqlValues.repeat(dataCount - 1) + sqlSuffix;
            queryDataCount = dataCount;
        }
        const promise = run(conn, query, data);
        promises.push(promise);
        data = [];
        dataCount = 0;
    }

    if (!rows.length) {
        return;
    }
    const promises = [];
    let data = [];
    let dataCount = 0;
    let query: string;
    let queryDataCount = -1;

    const valuesCount = StringHelpers.count(sqlValues, '?');
    sqlPrefix += sqlValues;
    sqlValues = ',' + sqlValues;

    for(const row of rows) {
        if (!Array.isArray(row) || row.length !== valuesCount) {
            throw new Error(`Incorrect host parameters row length: ${sqlValues} ${JSON.stringify(row)}`);
        }
        if (data.length + row.length > SQLITE_MAX_VARIABLE_NUMBER) {
            runQuery();
        }
        data.push(...row);
        dataCount++;
    }
    if (dataCount) {
        runQuery();
    }
    return Promise.all(promises);
}

/**
 * It runs a query like connection.all(), but in addition it prints the query if it throws an exception.
 * It helps identify in which of multiple queries running in parallel the error occured.
 */
export async function all(conn: DBConnection, sql: string, params?: DBQueryParams): Promise<any[]> {
    return conn.all(sql, params).catch( err => {
        console.error('Error in: ' + sql);
        throw err;
    });
}

/** Analogous to {@link all}, but return a single row or null */
export async function get(conn: DBConnection, sql: string, params?: DBQueryParams): Promise<any> {
    return conn.get(sql, params).catch( err => {
        console.error('Error in: ' + sql);
        throw err;
    });
}

/** Analogous to {@link all} */
export async function run(conn: DBConnection, sql: string, params?: DBQueryParams): Promise<DBRunQueryResult> {
    return conn.run(sql, params).catch( err => {
        console.error('Error in: ' + sql);
        throw err;
    });
}