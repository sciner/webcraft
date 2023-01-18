import { cropToImage } from "../helpers.js"

export class SpriteAtlas {

    constructor() {
        this.cache = new Map()
    }

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

}