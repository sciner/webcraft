import { PIXI } from "./pixi.js"
import { MySprite } from "./MySpriteRenderer.js";
import { Vector } from "../../js/helpers.js";

export const USE_BITMAP_FONT = false;

//
const HALIGNS = {left: 0, center: .5, right: 1}
const VALIGNS = {top: 0, middle: .5, bottom: 1}
const VALID_XA = ['left', 'center', 'right']
const VALID_YA = ['top', 'middle', 'bottom']
const SIGN_XA = {left: 1, center: 0, right: -1}
const SIGN_YA = {top: 1, middle: 0, bottom: -1}

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
    if(isNaN(value)) {
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
        this.#window.style.padding._changed()
    }

    get vertical() {
        return this._vertical
    }

    set vertical(value) {
        this._vertical = value
        this.#window.style.padding._changed()
    }

}

// Background
export class BackgroundStyle {

    #window
    #_wmbgimage
    #_bgcolor

    /**
     * @param { import("./wm.js").Window } window
     */
    constructor(window) {
        this.#window = window
        // Background image
        this.#_wmbgimage = new MySprite(PIXI.Texture.EMPTY)
        window._wmbgimage = this.#_wmbgimage
        window._wmbgimage.catchEvents = false
        // this.#_wmbgimage.anchor.x = 0
        // this.#_wmbgimage.anchor.y = 0
        // this.#_wmbgimage.position.x = 0
        // this.#_wmbgimage.position.y = 0
        window.addChildAt(this.#_wmbgimage, 0)
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
        return this.#_wmbgimage
    }

    /**
     * @param {string|Image} urlOrImage
     */
    set image(urlOrImage) {

        const background = this.#_wmbgimage
        const window = this.#window
        const scale = this.scale

        window._wmbgimage.visible = !!urlOrImage

        if (!urlOrImage) {
            return;
        }

        if (urlOrImage.baseTexture) {
            background.texture = urlOrImage
        } else {
            background.texture = PIXI.Texture.from(urlOrImage)
        }

        if (isNaN(scale)) {
            background.width = window.w
            background.height = window.h
        } else {
            background.scale.set(scale);
        }

    }

    /**
     * @param {string} value
     */
    set image_size_mode(value) {
        this._image_size_mode = value
        const background = this.#window._wmbgimage
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
            case 'cover': {
                const bgSize = new Vector(window.w, window.h, 0)
                background.width = background._texture.orig.width
                background.height = background._texture.orig.height
                const sp = new Vector(background.width, background.height, 0)
                const winratio = bgSize.x / bgSize.y
                const spratio = sp.x / sp.y
                const pos = new PIXI.Point(0, 0)
                let scale = 1
                // if(type == 'cover' ? (winratio > spratio) : (winratio < spratio)) {
                if(winratio > spratio) {
                    // photo is wider than background
                    scale = bgSize.x / sp.x
                    pos.y = -((sp.y * scale) - bgSize.y) / 2
                } else {
                    // photo is taller than background
                    scale = bgSize.y / sp.y
                    pos.x = -((sp.x * scale) - bgSize.x) / 2
                }
                background.anchor.set(0, 0)
                background.scale = new PIXI.Point(scale, scale)
                background.position.x = pos.x
                background.position.y = pos.y
                break
            }
            case 'stretchcenter':
            case 'centerstretch': {
                background.position.x = window.w / 2
                background.position.y = window.h / 2
                background.anchor.set(.5, .5)
                // debugger
                // let scale = 0.9 * this.#window.w / background.width
                background.width = this.scale * this.#window.w
                background.height = this.scale * this.#window.h
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
        const window = this.#window
        const {color, alpha} = parseColorAndAlpha(value)
        this._color = value
        this.#_bgcolor.clear()
        this.#_bgcolor.beginFill(color)
        this.#_bgcolor.drawRect(0, 0, window.w, window.h)
        this.#_bgcolor.alpha = alpha
    }

    resize() {
        this.color = this.color
    }

}

// Border
export class BorderStyle {

    #window
    #_wmborder
    #_style = 'normal' // | normal | inset | fixed_single
    #_color = '#ffffffff'
    #_shadow_color = '#888888ff'

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
    get shadow_color() {
        return this.#_shadow_color
    }

    /**
     * @param {string} value
     */
    set shadow_color(value) {
        this.#_shadow_color = value
        this._redraw()
    }

    /**
     * @returns {string}
     */
    get color() {
        return this.#_color
    }

    /**
     * @param {string} value
     */
    set color(value) {
        this.#_color = value
        // TODO: need to calc this.#_shadow_color
        this._redraw()
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

    resize() {
        this._redraw()
    }

    _redraw() {

        const {w, h} = this.#window
        const border = this.#_wmborder

        let color1 = null
        let color2 = null

        switch(this.style) {
            case 'normal': {
                color1 = this.#_shadow_color
                color2 = this.#_color
                break
            }
            case 'inset': {
                color1 = this.#_color
                color2 = this.#_shadow_color
                break
            }
            case 'fixed_single': {
                color1 = this.#_color
                color2 = this.#_color
                break
            }
        }

        const border_width = 1 * this.#window.zoom

        color1 = parseColorAndAlpha(color1)
        color2 = parseColorAndAlpha(color2)

        border.clear()
        border.lineStyle(border_width, color1.color, color1.alpha)
        border.moveTo(w, h)
            .lineTo(0, h)
            .lineTo(0, 0)

        border.lineStyle(border_width, color2.color, color2.alpha)
        border.moveTo(0, 0)
            .lineTo(w, 0)
            .lineTo(w, h)

    }

}

export class PaddingStyle {

    /**
     * @type { import("./wm.js").Window }
     */
    #window

    #_values = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
    }

    /**
     * @type { import("./wm.js").Window } window
     */
    constructor(window) {
        this.#window = window
    }

    /**
     * @returns {float}
     */
    get left() {return this.#_values.left}

    /**
     * @param {float} value
     */
    set left(value) {
        this.#_values.left = value
        this._changed()
    }

    /**
     * @returns {float}
     */
    get top() {return this.#_values.top}

    /**
     * @param {float} value
     */
    set top(value) {
        this.#_values.top = value
        this._changed()
    }

    /**
     * @returns {float}
     */
    get right() {return this.#_values.right}

    /**
     * @param {float} value
     */
    set right(value) {
        this.#_values.right = value
        this._changed()
    }

    /**
     * @returns {float}
     */
    get bottom() {return this.#_values.bottom}

    /**
     * @param {float} value
     */
    set bottom(value) {
        this.#_values.bottom = value
        this._changed()
    }

    /**
     * Smart set padding
     * @param {float} left 
     * @param {float} top 
     * @param {float} right 
     * @param {float} bottom 
     */
    set(left, top, right, bottom) {
        if(left != undefined && top == undefined && right == undefined && bottom == undefined) {
            top = right = bottom = left
        } else if (left != undefined && top != undefined && right == undefined && bottom == undefined) {
            right = left
            bottom = top
        }
        if(left == undefined || top == undefined || right == undefined || bottom == undefined) {
            throw 'error_invalid_style_padding'
        }
        this.#_values.left = left
        this.#_values.top = top
        this.#_values.right = right
        this.#_values.bottom = bottom
        this._changed()
    }

    resize() {
        this._changed()
    }

    _changed() {
        const w = this.#window
        if(w.text_container) {
            let xa = w.style.textAlign.horizontal
            let ya = w.style.textAlign.vertical
            if(!VALID_XA.includes(xa)) xa = VALID_XA[0]
            if(!VALID_YA.includes(ya)) ya = VALID_YA[0]
            const xpos = {left: 0, center: w.w / 2, right: w.w - this.#_values.right}
            const ypos = {top: 0, middle: w.h / 2, bottom: w.h - this.#_values.bottom}
            const x = xpos[xa] + this.#_values.left * SIGN_XA[xa]
            const y = ypos[ya] + this.#_values.top * SIGN_YA[ya]
            w.text_container.transform.position.set(x, y)
            w.text_container.anchor.set(HALIGNS[xa] ?? 0, VALIGNS[ya] ?? 0)
        }
    }

}

export class TextShadowStyle {

    #window
    
    constructor(window) {
        this.#window = window
    }

    _getTextContainer() {
        if(!this.#window.text_container) {
            this.#window.text = ''
        }
        return this.#window.text_container
    }

    /**
     * @returns {float}
     */
    get alpha() {
        return this._getTextContainer()._style.dropShadowAlpha
    }

    /**
     * @param {float} value
     */
    set alpha(value) {
        this._getTextContainer()._style.dropShadowAlpha = value
    }

    /**
     * @returns {boolean}
     */
    get enable() {
        this._getTextContainer()._style.dropShadow
    }

    /**
     * @param {boolean} value
     */
    set enable(value) {
        this._getTextContainer()._style.dropShadow = !!value
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
            fontSize: 16 * window.zoom,
            fontWeight: 'normal'
        })
        this._color = '#000000'

        this.shadow = new TextShadowStyle(window)

    }

    get weight() {
        return this._font_style.fontWeight
    }

    /**
     * @type {string}
     */
    set weight(value) {
        this._font_style.fontWeight = value
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
            this.#window.text_container.alpha = alpha
        }
    }

    get word_wrap() {
        return this.#window.text_container.style.wordWrap
    }

    set word_wrap(value) {
        value = !!value
        this.#window.text_container.style.wordWrap = value
        if(value) {
            this.#window.text_container.style.wordWrapWidth = this.#window.w
        }
    }

}

// All styles
export class Style {

    #window

    constructor() {}

    /**
     * @param { import("./wm.js").Window } window
     */
    assign(window) {
        this.#window        = window
        this._padding       = new PaddingStyle(window)
        this._background    = new BackgroundStyle(window)
        this._border        = new BorderStyle(window)
        this._font          = new FontStyle(window)
        this._textAlign     = new TextAlignStyle(window)
    }

    /**
     * @returns {PaddingStyle}
     */
    get padding() {
        return this._padding
    }

    /**
     * @param {PaddingStyle} value
     */
    set padding(value) {
        if(isNaN(value)) {
            for(let k in value) {
                this._padding[k] = value[k]
            }
        } else {
            this._padding.set(value)
        }
        this._padding._changed()
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