import { unixTime, md5 } from "../../../www/js/helpers.js";
import { PLAYER_SKIN_TYPES, SKIN_RIGHTS_FREE, SKIN_RIGHTS_UPLOADED, CLIENT_SKIN_ROOT } from "../../../www/js/constant.js";
import { Buffer } from 'node:buffer';
import skiaCanvas from 'skia-canvas';
import mkdirp from 'mkdirp';
import skins_json from "../../../www/media/models/database.json" assert { type: "json" };

const SKIN_ROOT = '../www/media/models/player_skins/'
const UPLOAD_SKIN_DIR = 'u/'; // a dir in SKIN_ROOT for uploaded skins
const UPLOAD_SKINS_PER_DIR = 1000; // How many skins are placed in each sub-dir of UPLOAD_SKIN_DIR
export const UPLOAD_STARTING_ID = 10000;
export const DEFAULT_SKIN_ID = 1;

export class DBGameSkins {

    constructor(db) {
        this.db = db;
        this.conn = db.conn;
        this.loadStaticSkins();
    }

    /**
     * static list loads once, then we access it instantly when needed
     */
    loadStaticSkins() {
        this.staticSkinsPromise = new Promise((resolve) => {
            resolve(new Map(skins_json.player_skins.map(it => [it.id, it])))
        })
    }

    hashImage(img) {
        const canvas = new skiaCanvas.Canvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imgData = ctx.getImageData(0, 0, img.width, img.width);
        return md5(imgData, 'base64url');
    }

    // reloads the list, and adds misssing files to the DB
    async updateStaticSkins() {
        this.loadStaticSkins();
        const staticSkinsById = await this.staticSkinsPromise;
        const resp = {"total": 0, "added": 0, "errors": []};
        for(var skin of staticSkinsById.values()) {
            const fileName = SKIN_ROOT + skin.file + '.png';
            const img = await skiaCanvas.loadImage(fileName);
            const hash = this.hashImage(img);
            const result = await this.conn.run(`INSERT OR IGNORE INTO skin (id, dt, file, type, rights, hash) 
                VALUES (:id, :dt, :file, :type, :rights, :hash)`, {
                ':id':          skin.id,
                ':dt':          unixTime(),
                ':file':        skin.file,
                ':type':        skin.type,
                ':rights':      skin.rights,
                ':hash':        hash
            });
            if (result.changes) {
                resp.added++;
            } else {
                const id = (await this.getSkinByHashType(hash, skin.type))?.id;
                if (id && id !== skin.id) {
                    resp.errors.push(`Skin id=${skin.id} can't be added because skin id=${id} has the same hash and type.`);
                } else {
                    // We can't insert it because it has the same id, or it's the same skin. Update it.
                    await this.conn.run('UPDATE OR IGNORE skin SET hash = :hash, file = :file, type = :type WHERE id = :id', {
                        ':hash':        hash,
                        ':file':        skin.file,
                        ':type':        skin.type,
                        ':id':          skin.id
                    });
                }
            }
            resp.total++;
        }
        return resp;
    }

    async getSkinByHashType(hash, type) {
        return await this.conn.get("SELECT * FROM skin WHERE hash = ? AND type = ?", [hash, type]);
    }

    async addUserSkin(user_id, skin_id) {
        // We don't check if inserting fails, because that means it's already added, i.e. it's successful.
        await this.conn.run(`INSERT OR IGNORE INTO user_skin (user_id, skin_id, dt) VALUES (:user_id, :skin_id, :dt)`, {
            ':user_id':     user_id,
            ':skin_id':     skin_id,
            ':dt':          unixTime()
        });
    }

    calcSkinFileNames(skin_id) {
        const dir = UPLOAD_SKIN_DIR + ((skin_id / UPLOAD_SKINS_PER_DIR) | 0) + '/';
        const file = dir + (skin_id | 0);
        return {
            file: file,
            fullDir: SKIN_ROOT + dir,
            fullFileName: SKIN_ROOT + file + '.png'
        };
    }

    async saveSkinFile(skinFileNames, dataBuffer) {
        await mkdirp(skinFileNames.fullDir);
        await fs.promises.writeFile(skinFileNames.fullFileName, dataBuffer, 'binary');
    }

    async upload(data, originalName, type, user_id) {
        if (!PLAYER_SKIN_TYPES[type]) {
            throw "error"; // this is not expected to happen
        }
        // check if it's a valid image
        var img;
        var dataBuffer;
        try {
            dataBuffer = Buffer.from(data, 'base64');
            img = await skiaCanvas.loadImage(dataBuffer);
        } catch {
            throw 'error_incorrect_image_format';
        }
        if (img.width != 64 || img.height != 64) {
            throw 'error_skin_size_must_be_64';
        }

        // searh for a skin with the same hash
        const hash = this.hashImage(img);
        const existingSkin = await this.getSkinByHashType(hash, type);

        var skin_id;
        if (existingSkin) {
            // Deal with an abnormal situation: the skin exists in DB, but its image 
            // doesn't exist on the disk. Allow the image to be re-uploaded.
            const skinFileNames = this.calcSkinFileNames(existingSkin.id);
            const fileExists = await fs.promises.stat(skinFileNames.fullFileName).then(
                () => true, () => false);
            if (!fileExists) {
                await this.saveSkinFile(skinFileNames, dataBuffer);
            }

            // The same exact image was uploaded. TODO check ownership rights here
            if (existingSkin.rights !== SKIN_RIGHTS_UPLOADED) {
                throw 'error_this_skin_already_exists';
            }
            this.addUserSkin(user_id, existingSkin.id);
            skin_id = existingSkin.id;
        } else {
            // add the skin to the db, with '' file name
            if (originalName.endsWith('.png')) {
                originalName = originalName.substring(0, originalName.length - 4);
            }
            const result = await this.conn.run(`INSERT OR IGNORE INTO skin
                        (dt, file, type, rights, hash, uploader_user_id, original_name) 
                VALUES (:dt, '', :type, ${SKIN_RIGHTS_UPLOADED}, :hash, :uploader_user_id, :original_name)`, {
                ':dt':          unixTime(),
                ':type':        type,
                ':hash':        hash,
                ':uploader_user_id': user_id,
                ':original_name': originalName
            });
            if (!result.changes) {
                const row = await this.conn.get('SELECT id FROM skin WHERE hash = ?', [hash]);
                if (!row) {
                    // Maybe a duplicate skin was inserted at the same time. Let the usr try it later.
                    throw 'server_error_try_later';
                }
                result.lastID = row.id;
            }
            skin_id = result.lastID;

            const skinFileNames = this.calcSkinFileNames(skin_id);
            await this.saveSkinFile(skinFileNames, dataBuffer);

            await this.conn.run("UPDATE skin SET file = ? WHERE id = ?", [skinFileNames.file, skin_id]);

            // Add the skin to the user
            await this.addUserSkin(user_id, skin_id);
        }
        return skin_id;
    }

    async getOwned(user_id) {
        return await this.conn.all("SELECT skin_id id, file, type FROM user_skin INER JOIN skin ON skin_id = skin.id WHERE user_id = ?", [user_id]);
    }

    async deleteFromUser(user_id, skin_id) {
        await this.conn.run("DELETE FROM user_skin WHERE user_id = ? AND skin_id = ?", [user_id, skin_id]);
    }

    async getUserSkin(user_id, skin_id) {
        const staticSkinsById = await this.staticSkinsPromise;
        const skin = staticSkinsById.get(skin_id);
        if (skin && skin.rights === SKIN_RIGHTS_FREE) {
            if (!skin.file.endsWith('.png')) {
                skin.file = CLIENT_SKIN_ROOT + skin.file + '.png';
            }
            return skin;
        }
        let row = await this.conn.get("SELECT id, file, type FROM user_skin INER JOIN skin ON skin_id = skin.id WHERE user_id = ? AND skin_id = ?", [user_id, skin_id]);
        row = row || staticSkinsById.get(DEFAULT_SKIN_ID);
        if (!row.file.endsWith('.png')) {
            row.file = CLIENT_SKIN_ROOT + row.file + '.png';
        }
        return row;
    }

}