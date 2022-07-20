import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'
import { copyFile } from 'fs/promises';

// SQLite server client
export class SQLiteServerConnector {

    // Open database and return provider
    static async openDB(dir, filename) {
        filename = path.resolve(filename);
        // Check directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        // Recheck directory exists
        if (!fs.existsSync(dir)) {
            throw 'Game directory not found: ' + dir;
        }
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