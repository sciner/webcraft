import { PIXI } from "./pixi.js"
import {MySprite} from "./MySpriteRenderer.js";

export const USE_BITMAP_FONT = false;

const colors = {
    list: [0xff00ff, 0xffff00, 0x00ff00, 0xff0000, 0x0000ff, 0x00fffff],
    index: 0
}

// Return random integer color
export function getRandomColor() {
    return colors.list[colors.index++ % colors.list.length]
}

// Parse HEX color to integer
export function parseColorAndAlpha(value) {
    const resp = {
        color: 0x0,
        alpha: 0xff
    }
    if(value === undefined) {
        resp.alpha = 0
        return resp
    }
    if(isNaN) {
        const has_alpha = value.length == 9
        resp.color = parseInt(`0x${value.substring(1, 7)}`, 16)
        if(has_alpha) {
            resp.alpha = parseInt(`0x${value.substring(7, 9)}`, 16) / 255.0
        }
    }
    return resp
}

// Text align
export class TextAlignStyle {

    #window

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.#window = window
        this._horizontal = null
        this._vertical = null
    }

    get horizontal() {
        return this._horizontal
    }

    set horizontal(value) {
        this._horizontal = value
    }

    get vertical() {
        return this._vertical
    }

    set vertical(value) {
        this._vertical = value
    }

}

// Background
export class BackgroundStyle {

    #window
    #_bgimage
    #_bgcolor

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.#window = window
        // Background image
        this.#_bgimage = new MySprite(PIXI.Texture.EMPTY)
        window._bgimage = this.#_bgimage
        // this.#_bgimage.anchor.x = 0
        // this.#_bgimage.anchor.y = 0
        // this.#_bgimage.position.x = 0
        // this.#_bgimage.position.y = 0
        window.addChildAt(this.#_bgimage, 0)
        // Create a Graphics object, set a fill color, draw a rectangle
        this.#_bgcolor = new PIXI.Graphics()
        window.addChildAt(this.#_bgcolor, 1)
        //
        this.scale = undefined // window.zoom / 2.0
        this._image_size_mode = null
        this.color = '#00000000'
    }

    /**
     * @type {PIXI.Sprite}
     */
    get sprite() {
        return this.#_bgimage
    }

    /**
     * @param {string|Image} urlOrImage
     */
    set image(urlOrImage) {

        if (!urlOrImage) {
            return;
        }
        const window = this.#window
        const scale = this.scale

        const background = this.#_bgimage
        if (urlOrImage.baseTexture) {
            background.texture = urlOrImage;
        } else {
            background.texture = PIXI.Texture.from(urlOrImage)
        }
        if (isNaN(scale)) {
            background.width = window.w
            background.height = window.h
        } else {
            background.scale.set(scale);
        }
        // Set image
        /*const setImage = (image) => {
            const background = this.#_bgimage;
            this.#_bgimage.texture.destroy()
            this.#_bgimage.texture = new PIXI.Texture(new PIXI.BaseTexture(image))

            // scale
            if(isNaN(scale)) {
                background.scale.set(window.w / image.width, window.h / image.height)
            } else {
                background.scale.set(scale, scale)
            }

            this.image_size_mode = this.image_size_mode

        }

        new Promise((resolve, reject) => {

            if (typeof urlOrImage == 'string') {

                const image = new Image()
                image.onload = (e) => {
                    resolve(setImage(image))
                }
                image.onError = reject
                image.src = urlOrImage

            } else if(urlOrImage instanceof Image) {

                resolve(setImage(urlOrImage))

            }

        })*/
    }

    /**
     * @param {string} value
     */
    set image_size_mode(value) {
        this._image_size_mode = value
        const background = this.#window._bgimage
        if(!background) {
            return
        }
        const window = this.#window
        switch(value) {
            case 'none': {
                // background.position.x = window.w / 2
                // background.position.y = window.h / 2
                // background.pivot.x = background._image.width / 2
                // background.pivot.y = background._image.height / 2
                break
            }
            case 'center': {
                background.position.x = window.w / 2
                background.position.y = window.h / 2
                background.anchor.set(.5, .5)
                break
            }
        }
    }

    /**
     * @type {string}
     */
    get image_size_mode() {
        return this._image_size_mode
    }

    set sprite(value) {}

    get color() {
        return this._color
    }

    set color(value) {
        const {color, alpha} = parseColorAndAlpha(value)
        this._color = value
        this.#_bgcolor.clear()
        this.#_bgcolor.beginFill(color)
        this.#_bgcolor.drawRect(0, 0, this.#window.w, this.#window.h)
        this.#_bgcolor.alpha = alpha
    }

}

// Border
export class BorderStyle {

    #window
    #_wmborder
    #_style = 'normal'

    constructor(window) {

        this.#window = window

        // Border
        const border = this.#_wmborder = new PIXI.Graphics()
        border.visible = false
        border.w = window.w
        border.h = window.h
        this._redraw()
        window.addChild(border)

    }

    /**
     * @returns {string}
     */
    get style() {
        return this.#_style
    }

    /**
     * @param {string} value
     */
    set style(value) {
        this.#_style = value
        this._redraw()
    }

    /**
     * @type {boolean}
     */
    get hidden() {
        return this.#_wmborder ? !this.#_wmborder.visible : false
    }

    /**
     * @param {boolean} value
     */
    set hidden(value) {
        if(this.#_wmborder) {
            this.#_wmborder.visible = !value
        }
    }

    _redraw() {

        const {w, h} = this.#window
        const border = this.#_wmborder

        const inset = this.style == 'inset'
        const color1 = inset ? 0x888888 : 0xffffff
        const color2 = inset ? 0xffffff : 0x888888
        const border_width = 3
        const border_alpha = .9

        border.lineStyle(border_width, color2, border_alpha)
        border.moveTo(w, h)
            .lineTo(0, h)
            .lineTo(0, 0)

        border.lineStyle(border_width, color1, border_alpha)
        border.moveTo(0, 0)
            .lineTo(w, 0)
            .lineTo(w, h)

    }

}

// Font
export class FontStyle {

    #window

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {

        this.#window = window

        this.useBitmapFont = false;
        this._bitmap_font_style = {
            fontName: 'UbuntuMono-Regular',
            fontSize: 20 * window.zoom,
        }
        this._font_style = new PIXI.TextStyle({
            fontFamily: 'Tahoma',
            fontSize: 20 * window.zoom,
            fontWeight: 'normal'
        })
        this._color = '#000000'

        this.shadow = {
            x: 1,
            y: 1,
            enable: false
        }

    }

    get anchor() {
        return this.#window.text_container.anchor
    }

    /**
     * @type {string}
     */
    get align() {
        const tc = this.#window.text_container;
        return tc.align || tc.style.align
    }

    /**
     * @param {string} value
     */
    set align(value) {
        const tc = this.#window.text_container;
        if (tc.align) {
            tc.align = value
        } else {
            tc.style.align = value;
        }
    }

    /**
     * @param {int} value
     */
    set size(value) {
        this._font_style.fontSize = value * this.#window.zoom
        this._bitmap_font_style.fontSize = value * this.#window.zoom
    }

    /**
     * @return {int}
     */
    get size() {
        return this._font_style.fontSize
    }

    /**
     * @param {string} value
     */
    set family(value) {
        this._font_style.fontFamily = value
        this._bitmap_font_style.fontFamily = value
        this.useBitmapFont = (value === 'UbuntuMono-Regular');
    }

    /**
     * @return {string}
     */
    get family() {
        return this._font_style.fontFamily
    }

    get color() {
        return this._color
    }

    set color(value) {
        const {color, alpha} = parseColorAndAlpha(value)
        this._color = value
        if(this.#window.text_container?.style) {
            this.#window.text_container.style.fill = color
        }
    }

}

// All styles
export class Style {

    #window

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.#window = window
        this._background = new BackgroundStyle(window)
        this._border = new BorderStyle(window)
        this._font = new FontStyle(window)
        this._textAlign = new TextAlignStyle(window)
        this.padding = {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0
        }
    }

    /**
     * @return {BackgroundStyle}
     */
    get background() {
        return this._background
    }

    /**
     * @return {BorderStyle}
     */
    get border() {
        return this._border
    }

    /**
     * @return {FontStyle}
     */
    get font() {
        return this._font
    }

    /**
     * @param {BackgroundStyle} value
     */
    set background(value) {
        let image = null
        for(let k in value) {
            if(k == 'image') {
                image = value[k]
                continue
            }
            this._background[k] = value[k]
        }
        if(image) {
            this._background.image = image
        }
    }

    /**
     * @returns {TextAlignStyle}
     */
    get textAlign() {
        return this._textAlign
    }

}