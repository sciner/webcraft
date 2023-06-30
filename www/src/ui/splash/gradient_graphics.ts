import {MyGraphics} from "../../vendors/wm/MySpriteRenderer.js";
import * as VAUX from "vauxcel";

export class GradientGraphics {

    /**
     * VAUX.Graphics
     * @param {*} from color
     * @param {*} to color
     * @param {int} height
     * @returns
     */
    static createVertical(from, to, height = 256) {
        const gradient = GradientGraphics._createVerticalGradient(from, to, height)
        const graphics = new MyGraphics()
        graphics.clear()
        graphics.beginTextureFill(gradient)
        // hud_graphics.beginFill(0x00ffff)
        graphics.drawRect(0, 0, 1, height)
        return graphics
    }

    static _createVerticalGradient(from, to, size = 256) {
        const c = document.createElement('canvas')
        c.width = 1
        c.height = size
        const ctx = c.getContext('2d')
        const grd = ctx.createLinearGradient(0, 0, 1, size)
        grd.addColorStop(0, from)
        grd.addColorStop(1, to)
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, 1, size)
        return {
            texture: new VAUX.Texture(new VAUX.BaseTexture(c))
        }
    }

}
