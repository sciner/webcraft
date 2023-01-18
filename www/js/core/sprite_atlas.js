import { cropToImage } from "../helpers.js"

const atlases = new Map()

export class SpriteAtlas {

    constructor() {
        this.cache = new Map()
        this.map = null
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
                resolve(this)
            }
            image.onerror = (e) => {
                reject(e)
            }
            image.src = url
        })
    }

    static async fromJSON(image_url, map_json) {

        let atlas = atlases.get(image_url)
        if(atlas) {
            return atlas
        }

        atlas = new SpriteAtlas()
        await atlas.fromFile(image_url)
        atlas.map = map_json

        atlases.set(image_url, atlas)

        return atlas

    }

    async getSprite(x, y, width, height, dest_width, dest_height) {
        const key = `${x}, ${y}, ${width}, ${height}, ${dest_width}, ${dest_height}`
        let image = null
        if(this.cache.has(key)) {
            return this.cache.get(key)
        }
        image = await cropToImage(this.image, x, y, width, height, dest_width, dest_height)
        this.cache.set(key, image)
        return image
    }

    async getSpriteFromMap(name) {
        if(!this.map) throw 'error_atlas_map_empty' 
        const sprite = this.map[name]
        if(!sprite) throw `error_atlas_sprite_not_found|${name}`
        return await this.getSprite(sprite.frame.x, sprite.frame.y, sprite.frame.w, sprite.frame.h)
    }

}