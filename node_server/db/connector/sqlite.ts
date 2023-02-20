import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'

// SQLite server client
export class SQLiteServerConnector {

    // Connect to database and return provider
    static async connect(filename) {
        const dir = path.dirname(filename);
        console.log(dir);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        filename = path.resolve(filename);
        // Open SQLite3 database file
        const conn = await open({
            filename: filename,
            driver: sqlite3.Database
        }).then(async (conn) => {
            return conn;
        }).catch(error => {
            throw error;
        });
        return conn;
    }

}