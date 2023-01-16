import { PIXI } from "./pixi.js"

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
        alpha: 0x00
    }
    if(value === undefined) {
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

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.window = window
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

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.window = window
        // Create a Graphics object, set a fill color, draw a rectangle
        this._bg = new PIXI.Graphics()
        window.addChild(this._bg)
        this._image_size_mode = null
        // this._bg.beginFill(0xff000000)
        // this._bg.drawRect(0, 0, window.w, window.h)
    }

    /**
     * @param {string} value
     */
    set image(value) {
        this.window.setBackground(value)
    }

    /**
     * @param {string} value
     */
    set image_size_mode(value) {
        this._image_size_mode = value
        const background = this.window._background
        if(!background) {
            return
        }
        const window = this.window
        switch(value) {
            case 'none': {
                background.position.x = window.w / 2
                background.position.y = window.h / 2
                background.pivot.x = background._image.width / 2
                background.pivot.y = background._image.height / 2
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

    set color(value) {
        const {color, alpha} = parseColorAndAlpha(value)
        this._bg.beginFill(color)
        this._bg.drawRect(0, 0, this.window.w, this.window.h)
        this._bg.alpha = alpha
    }

}

// Border
export class BorderStyle {

    constructor(window) {
        this.window = window
    }

    /**
     * @param {boolean} value
     */
    set hidden(value) {
        // TODO:
    }

}

// Font
export class FontStyle {

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {

        this.window = window

        this._font_style = new PIXI.TextStyle({
            fontFamily: 'Tahoma',
            fontSize: 20 * window.zoom,
            fontWeight: 'normal'
        })

        /*
        font: {
            size: 20 * this.zoom,
            family: 'Ubuntu',
            shadow: {
                enable: false,
                x: 0,
                y: 0,
                blur: 0,
                color: 'rgba(0, 0, 0, 5)'
            }
        }
        */

    }

    /**
     * @param {int} value
     */
    set size(value) {
        this._font_style.fontSize = value * this.window.zoom
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
    }

    /**
     * @return {string}
     */
    get family() {
        return this._font_style.fontFamily
    }

}

// All styles
export class Style {

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.window = window
        this._background = new BackgroundStyle(window)
        this._border = new BorderStyle(window)
        this._font = new FontStyle(window)
        this._textAlign = new TextAlignStyle(window)
    }

    get background() {
        return this._background
    }

    get border() {
        return this._border
    }

    get font() {
        return this._font
    }

    /**
     * @param {string} value
     */
    set background(value) {
        for(let k in value) {
            this._background[k] = value[k]
        }
    }

    get textAlign() {
        return this._textAlign
    }

}