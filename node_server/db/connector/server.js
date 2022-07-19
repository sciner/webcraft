import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'
import { copyFile } from 'fs/promises';

// SQLite server client
export class SQLiteServerConnector {

    // Open database and return provider
    static async openDB(dir, filename, template_db_filename) {
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
    }

}