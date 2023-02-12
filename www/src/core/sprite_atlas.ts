import { PIXI } from "../../tools/gui/pixi.js";
import { isScalar } from "../helpers.js";

const atlases = new Map()

export class SpriteAtlas {

    constructor() {
        this.sheet = null;
        this.cache = new Map();
        this.baseTex = null;
    }

    /**
     * @param {string} url
     * @returns {SpriteAtlas}
     */
    async fromFile(url) {
        return new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => {
                this.image = image
                this.baseTex = new PIXI.BaseTexture(this.image);
                resolve(this)
            }
            image.onerror = (e) => {
                reject(e)
            }
            image.src = url
        })
    }

    /**
     * @param {Image|string} image_or_url
     * @param {object} map_json
     * @returns {SpriteAtlas}
     */
    static async fromJSON(image_or_url, map_json) {
        let atlas = atlases.get(image_or_url)
        if(atlas) {
            return atlas
        }
        atlas = new SpriteAtlas()
        if(isScalar(image_or_url)) {
            await atlas.fromFile(image_or_url)
        } else {
            atlas.baseTex = new PIXI.BaseTexture(image_or_url, {
                resourceOptions: { alphaMode: image_or_url instanceof ImageBitmap ? 0 : 1 }
            })
        }
        atlas.sheet = new PIXI.Spritesheet(atlas.baseTex, map_json);
        await atlas.sheet.parse();

        return atlas

    }

    async getSprite(x, y, width, height, dest_width, dest_height) {
        const key = `${x}, ${y}, ${width}, ${height}, ${dest_width}, ${dest_height}`
        let tex = null
        if(this.cache.has(key)) {
            return this.cache.get(key)
        }
        tex = new PIXI.Texture(this.baseTex, new PIXI.Rectangle(x, y, width, height))
        this.cache.set(key, tex)
        return tex
    }

    getSpriteFromMap(name) {
        if(!this.sheet) throw 'error_atlas_map_empty'
        const tex = this.sheet.textures[name]
        if(!tex) throw `error_atlas_sprite_not_found|${name}`
        return tex
    }

}