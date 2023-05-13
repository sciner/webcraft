import * as PIXI from "../../tools/gui/pixi.js";
import { isScalar } from "../helpers.js";

const atlases = new Map()

export class SpriteAtlas {
    sheet: PIXI.Spritesheet;
    cache: Map<any, any>;
    baseTex: PIXI.BaseTexture;
    image: HTMLImageElement;

    constructor() {
        this.sheet = null;
        this.cache = new Map();
        this.baseTex = null;
    }

    async fromFile(url : string) : Promise<SpriteAtlas> {
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

    static async fromJSON(image_or_url : HTMLImageElement | ImageBitmap | string, map_json : object) : Promise<SpriteAtlas> {
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

    async getSprite(x : int, y : int, width : int, height : int, dest_width? : int, dest_height? : int) : PIXI.Texture {
        const key = `${x}, ${y}, ${width}, ${height}, ${dest_width}, ${dest_height}`
        let tex = null
        if(this.cache.has(key)) {
            return this.cache.get(key)
        }
        tex = new PIXI.Texture(this.baseTex, new PIXI.Rectangle(x, y, width, height))
        this.cache.set(key, tex)
        return tex
    }

    getSpriteFromMap(name : string) {
        if(!this.sheet) throw 'error_atlas_map_empty'
        const tex = this.sheet.textures[name]
        if(!tex) throw `error_atlas_sprite_not_found|${name}`
        return tex
    }

}