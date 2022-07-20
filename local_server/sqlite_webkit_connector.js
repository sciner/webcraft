import initSqlJs from "sql.js";

// SQLite webkit client
export class SQLiteWebkitConnector {

    // Connect to database and return provider
    static async connect(filename) {
        return new Promise((resolve, reject) => {
            caches.open('game-cache').then(async (cache) => {
                try {
                    const response = await cache.match(filename);
                    const SQL = await initSqlJs({});
                    const conn = new SQL.Database(response ? new Uint8Array(await response.arrayBuffer()) : null);
                    //
                    conn._exec = conn.exec;
                    conn._each = conn.each;
                    conn._run = conn.run;
                    conn._run_count = 0;
                    //
                    conn.all = async function(a, b, c, d, e, f) {
                        const resp = await conn._exec(a, b, c, d, e, f)[0];
                        if(!resp) {
                            return [];
                        }
                        const result = [];
                        for(let i = 0; i < resp.values.length; i++) {
                            const item = {};
                            for(let j = 0; j < resp.columns.length; j++) {
                                item[resp.columns[j]] = resp.values[i][j];
                            }
                            result.push(item);
                        }
                        return result;
                    };
                    //
                    conn.run = async function(a, b, c, d, e, f) {
                        conn._run_count++;
                        return await conn._run(a, b, c, d, e, f);
                    };
                    //
                    conn.get = async function(a, b, c, d, e, f) {
                        const resp = conn.exec(a, b, c, d, e, f);
                        if(!resp || !resp.length) {
                            return null;
                        }
                        const row = resp[0];
                        const result = {};
                        for(let i = 0; i < row.columns.length; i++) {
                            result[row.columns[i]] = row.values[0][i];
                        }
                        return result;
                    };
                    //
                    conn.each = async function(a, b, c, d, e, f) {
                        await conn._each(a, b, (row) => {
                            c(null, row);
                        }, d, e, f);
                    };
                    //
                    conn.save = async () => {
                        // Export the database to an Uint8Array containing the SQLite database file
                        const p = performance.now();
                        const exp = conn.export();
                        await cache.put(filename, new Response(exp));
                        const time_took = Math.round((performance.now() - p) * 1000) / 1000;
                        const exp_size = Math.round(exp.length / 1024);
                        console.debug(`Db ${filename} saved ${exp_size}Kb for ${time_took}ms`);
                    };
                    //
                    conn._saveTimeout = setInterval(() => {
                        if(conn._run_count > 0) {
                            conn._run_count = 0;
                            conn.save();
                        }
                    }, 1000);
                    //
                    resolve(conn);
                } catch(err) {
                    console.error(err);
                    reject(err);
                }
            });
        });
    }

}