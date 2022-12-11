import { unixTime, md5 } from "../../../www/js/helpers.js";
import { Buffer } from 'node:buffer';
import Jimp from 'jimp';
import mkdirp from 'mkdirp';

const SKIN_ROOT = '../www/media/models/player_skins/'
const UPLOAD_SKIN_DIR = 'u/'; // a dir in SKIN_ROOT for uploaded skins
const UPLOAD_SKINS_PER_DIR = 1000; // How many skins are placed in each sub-dir of UPLOAD_SKIN_DIR
export const UPLOAD_STARTING_ID = 10000;

export class DBGameSkins {

    constructor(db) {
        this.db = db;
        this.conn = db.conn;
    }

    async addUserSkin(user_id, skin_id) {
        // We don't check if inserting fails, because that means it's already added, i.e. it's successful.
        await this.conn.run(`INSERT OR IGNORE INTO user_skin (user_id, skin_id, dt) VALUES (:user_id, :skin_id, :dt)`, {
            ':user_id':     user_id,
            ':skin_id':     skin_id,
            ':dt':          unixTime()
        });
    }

    async upload(data, originalName, isSlim, user_id) {
        // check if it's a valid image
        var img;
        var dataBuffer;
        try {
            dataBuffer = Buffer.from(data, 'base64');
            img = await Jimp.read(dataBuffer);
        } catch {
            throw 'error_incorrect_image_format';
        }
        if (img.getWidth() != 64 || img.getHeight() != 64) {
            throw 'error_skin_size_must_be_64';
        }

        // searh for a skin with the same hash
        const hash = md5(img.bitmap.data, 'base64url');
        const existingSkin = await this.conn.get("SELECT * FROM skin WHERE hash = ?", [hash]);

        var skin_id;
        if (existingSkin) {
            // The same exact image was uploaded. TODO check ownership rights here
            this.addUserSkin(user_id, existingSkin.id);
            skin_id = existingSkin.id;
        } else {
            // add the skin to the db, with '' file name
            if (originalName.endsWith('.png')) {
                originalName = originalName.substring(0, originalName.length - 4);
            }
            const result = await this.conn.run(`INSERT OR IGNORE INTO skin
                        (dt, file, is_slim, hash, uploader_user_id, original_name) 
                VALUES (:dt, '', :is_slim, :hash, :uploader_user_id, :original_name)`, {
                ':dt':          unixTime(),
                ':is_slim':     isSlim,
                ':hash':        hash,
                ':uploader_user_id': user_id,
                ':original_name': originalName
            });
            if (!result.lastID) {
                // Maybe a duplicate skin was inserted at the same time. Let the usr try it later.
                throw 'server_error_try_later';
            }
            skin_id = result.lastID;

            // set the file name based on skin_id
            const dir = UPLOAD_SKIN_DIR + ((skin_id / UPLOAD_SKINS_PER_DIR) | 0) + '/'
            const file = dir + (skin_id | 0);
            await this.conn.run("UPDATE skin SET file = ? WHERE id = ?", [file, skin_id]);

            // Add the skin to the user
            this.addUserSkin(user_id, skin_id);

            // save the skin file
            await mkdirp(SKIN_ROOT + dir);
            const fullFileName = SKIN_ROOT + file + '.png';
            await fs.promises.writeFile(fullFileName, dataBuffer, 'binary');
        }
        return skin_id;
    }

    async getOwned(user_id) {
        return await this.conn.all("SELECT skin_id id, file FROM user_skin INER JOIN skin ON skin_id = skin.id WHERE user_id = ?", [user_id]);
    }
}