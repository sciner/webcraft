import initSqlJs from "sql.js";

// import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm";
// import sqlWasm from "sql.js/dist/sql-wasm.wasm";
// import sqlWasm from "sql.js/dist/sql-asm.js";
// import sqlWasm from "sql.js/dist/sql-asm-memory-growth.js";
import sqlWasm from "sql.js/dist/sql-wasm.js";

// SQLite webkit client
export class SQLiteWebkitConnector {

    // Open database and return provider
    static async openDB(dir, filename, template_db_filename) {

        console.log('-----');
        const SQL = await initSqlJs({ locateFile: () => sqlWasm });
        console.log('---->');
        console.log('DB', new SQL.Database());

        /*
        filename = path.resolve(filename);
        // Check directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        // Recheck directory exists
        if (!fs.existsSync(dir)) {
            throw 'Game directory not found: ' + dir;
        }
        // If DB file not exists, then create it from template
        if (!fs.existsSync(filename)) {
            // create db from template
            await copyFile(path.resolve(template_db_filename), filename);
        }
        // Open SQLIte3 fdatabase file
        const conn = await open({
            filename: filename,
            driver: sqlite3.Database
        }).then(async (conn) => {
            return conn;
        });
        return conn;
        */
    }

}