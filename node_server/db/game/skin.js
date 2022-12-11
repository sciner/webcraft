import { unixTime, md5 } from "../../../www/js/helpers.js";
import { Buffer } from 'node:buffer';
import Jimp from 'jimp';
import mkdirp from 'mkdirp';

const UPLOAD_SKIN_DIR = '../www/media/models/player_skins/u/'; // a root folder for all uploaded skins
const UPLOAD_SKIN_URL_PREFIX = 'u/';
const UPLOAD_SKIN_DIR_NAME_LENGTH = 2;
const UPLOAD_SKIN_FILE_NAME_LENGTH = 3; // only hash symbols, not counting .png extension

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

        if (existingSkin) {
            // The same exact image was uploaded. TODO check ownership rights here
            this.addUserSkin(user_id, existingSkin.id);
        } else {
            // Generate a unique "dir/filename"
            const hashDir = hash.substring(0, UPLOAD_SKIN_DIR_NAME_LENGTH) + '/';
            const hashFileNameBase = hash.substring(UPLOAD_SKIN_DIR_NAME_LENGTH, UPLOAD_SKIN_DIR_NAME_LENGTH + UPLOAD_SKIN_FILE_NAME_LENGTH);
            const hashFileName = hashFileNameBase;
            var url;
            var tryN = 2;
            while(true) {
                url = UPLOAD_SKIN_URL_PREFIX + hashDir + hashFileName;
                var row = await this.conn.get("SELECT id FROM skin WHERE url = ?", [url]);
                if (!row) {
                    break;
                }
                hashFileName = hashFileNameBase + '_' + tryN;
                tryN++;
            }

            // add the skin to the db
            if (originalName.endsWith('.png')) {
                originalName = originalName.substring(0, originalName.length - 4);
            }
            const result = await this.conn.run(`INSERT OR IGNORE INTO skin
                       (dt, url, is_slim, hash, uploader_user_id, original_name) 
                VALUES (:dt, :url, :is_slim, :hash, :uploader_user_id, :original_name)`, {
                ':dt':          unixTime(),
                ':url':         url,
                ':is_slim':     isSlim,
                ':hash':        hash,
                ':uploader_user_id': user_id,
                ':original_name': originalName
            });
            if (!result.lastID) {
                // Maybe a duplicate skin was inserted at the same time. Let the usr try it later.
                throw 'server_error_try_later';
            }
            const skin_id = result.lastID;

            // Add the skin to the user
            this.addUserSkin(user_id, skin_id);

            // save the skin file
            const dir = UPLOAD_SKIN_DIR + hashDir;
            await mkdirp(dir);
            const fileName = dir + hashFileName + '.png';
            await fs.promises.writeFile(fileName, dataBuffer, 'binary');
        }
    }
}