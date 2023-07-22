import skiaCanvas from 'skia-canvas';
import type { BBModel_Model } from "@client/bbmodel/model.js";
import { unixTime, md5 } from "@client/helpers.js";
import type { PlayerSkin } from "@client/player.js";
import { Resources } from "@client/resources.js";
import type { DBGame } from "../game.js";

const SKIN_ROOT = '../www/media/models/player_skins/'
const UPLOAD_SKIN_DIR = 'u/'; // a dir in SKIN_ROOT for uploaded skins
const UPLOAD_SKINS_PER_DIR = 1000; // How many skins are placed in each sub-dir of UPLOAD_SKIN_DIR
export const UPLOAD_STARTING_ID = 10000;
export const DEFAULT_SKIN_ID = 1;

type DBSkin = PlayerSkin & {
    rights: int
}

type SkinFileNames = {
    file: string
    fullDir: string
    fullFileName: string
}

export declare type IBBModelSkin = {
    bbmodel: BBModel_Model
    skin: PlayerSkin
    texture_name: string
}

// const STATIC_SKINS_BY_ID: Map<int, DBSkin> = new Map(skins_json.player_skins.map(it => [it.id, it]))

export class DBGameSkins {
    db: DBGame;
    conn: DBConnection;
    list: PlayerSkin[] = []

    constructor(db: DBGame) {
        this.db = db;
        this.conn = db.conn;
    }

    async load() : Promise<PlayerSkin[]> {
        for(const bbmodel of (await Resources.loadBBModels()).values()) {
            if(bbmodel.name.startsWith('mob/')) {
                bbmodel.makeTexturePalette()
                for(const texture_name of bbmodel.all_textures.keys()) {
                    if(isNaN(Number(texture_name))) {
                        const id = md5(`${bbmodel.name}|${texture_name}`);
                        const skin = {
                            id,
                            can_select_by_player: bbmodel.name.startsWith('mob/humanoid'),
                            model_name: bbmodel.name,
                            texture_name,
                        } as PlayerSkin
                        this.list.push(skin)
                        console.log(bbmodel.name, texture_name)
                    }
                }
            }
        }
        return this.list
    }

    hashImage(img): string {
        const canvas = new skiaCanvas.Canvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imgData = ctx.getImageData(0, 0, img.width, img.width);
        return md5(imgData, 'base64url');
    }

    // adds static skins to the DB
    async updateStaticSkins(): Promise<{total: int, added: int, errors: string[]}> {
        const resp = {total: 0, added: 0, errors: []};
        // for(var skin of STATIC_SKINS_BY_ID.values()) {
        //     const fileName = SKIN_ROOT + skin.file + '.png';
        //     const img = await skiaCanvas.loadImage(fileName);
        //     const hash = this.hashImage(img);
        //     const result = await this.conn.run(`INSERT OR IGNORE INTO skin (id, dt, file, type, rights, hash)
        //         VALUES (:id, :dt, :file, :type, :rights, :hash)`, {
        //         ':id':          skin.id,
        //         ':dt':          unixTime(),
        //         ':file':        skin.file,
        //         ':type':        skin.type,
        //         ':rights':      skin.rights,
        //         ':hash':        hash
        //     });
        //     if (result.changes) {
        //         resp.added++;
        //     } else {
        //         const id = (await this.getSkinByHashType(hash, skin.type))?.id;
        //         if (id && id !== skin.id) {
        //             resp.errors.push(`Skin id=${skin.id} can't be added because skin id=${id} has the same hash and type.`);
        //         } else {
        //             // We can't insert it because it has the same id, or it's the same skin. Update it.
        //             await this.conn.run('UPDATE OR IGNORE skin SET hash = :hash, file = :file, type = :type WHERE id = :id', {
        //                 ':hash':        hash,
        //                 ':file':        skin.file,
        //                 ':type':        skin.type,
        //                 ':id':          skin.id
        //             });
        //         }
        //     }
        //     resp.total++;
        // }
        return resp;
    }

    async getSkinByHashType(hash: string, type: int): Promise<DBSkin | null> {
        return await this.conn.get("SELECT * FROM skin WHERE hash = ? AND type = ?", [hash, type]);
    }

    async addUserSkin(user_id: int, skin_id: int) {
        // We don't check if inserting fails, because that means it's already added, i.e. it's successful.
        await this.conn.run(`INSERT OR IGNORE INTO user_skin (user_id, skin_id, dt) VALUES (:user_id, :skin_id, :dt)`, {
            ':user_id':     user_id,
            ':skin_id':     skin_id,
            ':dt':          unixTime()
        });
    }

    calcSkinFileNames(skin_id: int): SkinFileNames {
        const dir = UPLOAD_SKIN_DIR + ((skin_id / UPLOAD_SKINS_PER_DIR) | 0) + '/';
        const file = dir + (skin_id | 0);
        return {
            file: file,
            fullDir: SKIN_ROOT + dir,
            fullFileName: SKIN_ROOT + file + '.png'
        };
    }

    async saveSkinFile(skinFileNames: SkinFileNames, dataBuffer: Buffer) {
        await mkdirp(skinFileNames.fullDir);
        await fs.promises.writeFile(skinFileNames.fullFileName, dataBuffer, 'binary');
    }

    /**
     * @param {string} data base64-encoded image
     * @returns skin_id
     */
    async upload(data: string, originalName: string, type: int, user_id: int): Promise<int> {
        return -1
        // if (!PLAYER_SKIN_TYPES[type]) {
        //     throw "error"; // this is not expected to happen
        // }
        // // check if it's a valid image
        // var img;
        // var dataBuffer: Buffer
        // try {
        //     dataBuffer = Buffer.from(data, 'base64');
        //     img = await skiaCanvas.loadImage(dataBuffer);
        // } catch {
        //     throw 'error_incorrect_image_format';
        // }
        // if (img.width != 64 || img.height != 64) {
        //     throw 'error_skin_size_must_be_64';
        // }

        // // searh for a skin with the same hash
        // const hash = this.hashImage(img);
        // const existingSkin = await this.getSkinByHashType(hash, type);

        // let skin_id: int
        // if (existingSkin) {
        //     // Deal with an abnormal situation: the skin exists in DB, but its image
        //     // doesn't exist on the disk. Allow the image to be re-uploaded.
        //     const skinFileNames = this.calcSkinFileNames(existingSkin.id);
        //     const fileExists = await fs.promises.stat(skinFileNames.fullFileName).then(
        //         () => true, () => false);
        //     if (!fileExists) {
        //         await this.saveSkinFile(skinFileNames, dataBuffer);
        //     }

        //     // The same exact image was uploaded. TODO check ownership rights here
        //     if (existingSkin.rights !== SKIN_RIGHTS_UPLOADED) {
        //         throw 'error_this_skin_already_exists';
        //     }
        //     this.addUserSkin(user_id, existingSkin.id);
        //     skin_id = existingSkin.id;
        // } else {
        //     // add the skin to the db, with '' file name
        //     if (originalName.endsWith('.png')) {
        //         originalName = originalName.substring(0, originalName.length - 4);
        //     }
        //     const result = await this.conn.run(`INSERT OR IGNORE INTO skin
        //                 (dt, file, type, rights, hash, uploader_user_id, original_name)
        //         VALUES (:dt, '', :type, ${SKIN_RIGHTS_UPLOADED}, :hash, :uploader_user_id, :original_name)`, {
        //         ':dt':          unixTime(),
        //         ':type':        type,
        //         ':hash':        hash,
        //         ':uploader_user_id': user_id,
        //         ':original_name': originalName
        //     });
        //     if (!result.changes) {
        //         const row = await this.conn.get('SELECT id FROM skin WHERE hash = ?', [hash]);
        //         if (!row) {
        //             // Maybe a duplicate skin was inserted at the same time. Let the usr try it later.
        //             throw 'server_error_try_later';
        //         }
        //         result.lastID = row.id;
        //     }
        //     skin_id = result.lastID;

        //     const skinFileNames = this.calcSkinFileNames(skin_id);
        //     await this.saveSkinFile(skinFileNames, dataBuffer);

        //     await this.conn.run("UPDATE skin SET file = ? WHERE id = ?", [skinFileNames.file, skin_id]);

        //     // Add the skin to the user
        //     await this.addUserSkin(user_id, skin_id);
        // }
        // return skin_id;
    }

    async getOwned(user_id: int): Promise<DBSkin[]> {
        return await this.conn.all("SELECT skin_id id, file, type FROM user_skin INER JOIN skin ON skin_id = skin.id WHERE user_id = ?", [user_id]);
    }

    async deleteFromUser(user_id: int, skin_id: int) {
        await this.conn.run("DELETE FROM user_skin WHERE user_id = ? AND skin_id = ?", [user_id, skin_id]);
    }

    async getUserSkin(user_id: int, skin_id: string): Promise<PlayerSkin | null> {
        for(let item of this.list) {
            if(item.id == skin_id) {
                return {...item}
            }
        }
        for(const skin of this.list) {
            if(skin.can_select_by_player) {
                return {...skin}
            }
        }
        // const skin = STATIC_SKINS_BY_ID.get(skin_id);
        // if (skin && skin.rights === SKIN_RIGHTS_FREE) {
        //     if (!skin.file.endsWith('.png')) {
        //         skin.file = CLIENT_SKIN_ROOT + skin.file + '.png';
        //     }
        //     return skin;
        // }
        // let row = await this.conn.get("SELECT id, file, type FROM user_skin INER JOIN skin ON skin_id = skin.id WHERE user_id = ? AND skin_id = ?", [user_id, skin_id]);
        // row = row || STATIC_SKINS_BY_ID.get(DEFAULT_SKIN_ID);
        // if (!row.file.endsWith('.png')) {
        //     row.file = CLIENT_SKIN_ROOT + row.file + '.png';
        // }
        // return row;
    }

}