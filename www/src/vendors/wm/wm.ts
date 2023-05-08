/**
* Window Manager based on PIXI.js
*/
import { RuneStrings, deepAssign, isScalar, Mth, Vector } from "../../helpers.js";
import { getBlockImage } from "../../window/tools/blocks.js";
import { PIXI } from '../../../tools/gui/pixi.js';
import {Style} from "./styles.js";

import { msdf } from "../../../data/font.js";
import {MyText} from "./MySpriteRenderer.js";
import { BLOCK } from "../../blocks.js";
import { Lang } from "../../lang.js";
import { Resources } from "../../resources.js";
import { KEY } from "../../constant.js";
import type { SpriteAtlas } from "../../core/sprite_atlas.js";

/**
 * catchEvents = true
 */

globalThis.visible_change_count = 0

let current_drag_window : Window = null

export const BLINK_PERIOD = 500; // период моргания курсора ввода текста (мс)

export type TMouseEvent = {
    shiftKey    : boolean
    button_id   : int
    drag        : Pointer
    x           : number
    y           : number
}

export class Graphics extends PIXI.Graphics {
    [key: string]: any;

    constructor(id? : any) {
        super()
        this.catchEvents = false
        if(id) {
            this.id = id
        }
    }

}

export class GradientGraphics {

    /**
     * PIXI.Graphics
     * @param {*} from color
     * @param {*} to color
     * @param {int} height
     * @returns
     */
    static createVertical(from, to, height = 256) {
        const gradient = GradientGraphics._createVerticalGradient(from, to, height)
        const graphics = new PIXI.Graphics()
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
            texture: new PIXI.Texture(new PIXI.BaseTexture(c))
        }
    }

}

// Base window
export class Window extends PIXI.Container {
    [key: string]: any;

    #_tooltip:              any = null
    #_bgicon:               any = null
    #_wmclip:               any = null
    style:                  Style
    draggable:              boolean = false

    canBeOpenedWith = [] // allows this window to be opened even if some other windows are opened

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {

        super()

        this.zoom = UI_ZOOM * Qubatch.settings.window_size / 100

        const that = this

        this._w = 0
        this._h = 0
        this.interactiveChildren = true

        // List of childs
        this.list = {
            values: () => {
                const resp = []
                for(let w of this.children) {
                    if(w instanceof Window && w.auto_center) {
                        resp.push(w)
                    }
                }
                return resp
            },
            keys: () => this.children.map(c => c.id),
            has(id) {
                return !!this.get(id)
            },
            delete(id) {
                const window = this.get(id)
                if(window) {
                    that.removeChild(window)
                }
            },
            get: (id) => {
                for(let w of this.children) {
                    if(w.id == id) return w
                }
                return null
            },
            clear: () => {
                while(this.children[0]) {
                    this.removeChild(this.children[0])
                }
            }
        }

        this.x                  = x
        this.y                  = y
        this.z                  = 0 // z-index
        this.width              = w
        this.height             = h

        this.index              = 0
        this.id                 = id
        this.title              = title
        this.word_wrap          = false
        this.hover              = false
        this.catchEvents        = true
        this.scrollX            = 0
        this.scrollY            = 0
        this.autosize           = true
        this.enabled            = true
        this.max_chars_per_line = 0
        this.auto_center        = true
        this.create_time        = performance.now()

        this.style              = new Style()
        this.style.assign(this)

        this.w                  = w
        this.h                  = h

        if(text !== undefined) {
            this.text = text || null
        }

    }

    get w() : number {
        return this._w
    }

    /**
     * @params {float} value
     */
    set w(value) {
        if(this._w == value) return
        this._w = value
        this._resized()
    }

    get h() : number {
        return this._h
    }

    set h(value : number) {
        if(this._h == value) return
        this._h = value
        this._resized()
    }

    _resized() {
        if(this.style) {
            this.style.background.resize()
            if(this.text_container) {
                this.style.padding.resize()
            }
            // if(this.text_container) {
            //     this.style.border.resize()
            // }
            this.style.border.resize()
        }
    }

    /**
     * Return width with padding
     */
    get ww() : number {
        if(!this.style.padding) debugger
        return this.w + this.style.padding.left + this.style.padding.right
    }

    /**
     * Return height with padding
     * @return {float}
     */
    get hh() {
        return this.h + this.style.padding.top + this.style.padding.bottom
    }

    get name() {
        return this.id;
    }

    //
    typeChar(e, charCode, typedChar) {
        for(let w of this.list.values()) {
            if(w.visible) {
                let fired = false;
                for(let f of w.list.values()) {
                    if(f.focused) {
                        f.typeChar(e, charCode, typedChar);
                        fired = true;
                        break;
                    }
                }
                if(!fired) {
                    w.typeChar(e, charCode, typedChar);
                }
            }
        }
    }

    // Events
    onMouseLeave() {
        for(let w of this.list.values()) {
            if(w.hover) {
                w.hover = false
                w.onMouseLeave()
            }
        }
    }

    onMouseEnter(_e?) {}
    onMouseDown(_e?) {}
    onMouseUp(_e?) {}
    onMouseMove(_e?) {}
    onDrop(_e?) {}
    onWheel(_e?) {}
    onHide(_e?) {}

    onShow(_args) {
        for(let window of this.list.values()) {
            if(window instanceof TextEdit) {
                window.focused = true
                break
            }
        }
    }

    // onKeyEvent
    onKeyEvent(e) {
        let fired = false
        for(let w of this.list.values()) {
            if(w.visible && w.interactiveChildren) {
                for(let child of w.list.values()) {
                    if(child.focused || child.interactiveChildren) {
                        fired = child.onKeyEvent(e)
                        if(fired) {
                            return fired
                        }
                    }
                }
                if(!fired) {
                    fired = w.onKeyEvent(e)
                }
            }
        }
        return fired
    }

    get ax() : number {
        return this.transform.position._x
    }

    get ay() : number {
        return this.transform.position._y
    }

    set width(value : number) {
        if(value == undefined) return
        this.w = value
        super.width = value
    }

    set height(value : number) {
        if(value == undefined) return
        this.h = value
        super.height = value
    }

    get text() : string {
        return this.text_container?.text ?? null
    }

    set text(value : string) {
        //
        if(!isScalar(value)) {
            throw 'error_invalid_text_value'
        }
        //
        if(value) {
            value = '' + value
            if(value.startsWith('Lang.')) {
                value = Lang.getOrDefault(value.substring(5), value)
            }
            value = value.replaceAll('\r\n', '\r')
        }
        //
        if(!this.text_container) {
            if (value === undefined) {
                return
            }
            if (this.style._font.useBitmapFont) {
                this.text_container = new PIXI.BitmapText(value, this.style.font._bitmap_font_style)
            } else {
                this.text_container = new MyText(value, this.style.font._font_style)
            }
            this.addChild(this.text_container)
        }
        //
        if(this.text_container.text != value) {
            this.text_container.text = value
        }
    }

    //
    get tooltip() : string {
        return this.#_tooltip
    }

    set tooltip(value : string) {
        this.#_tooltip = value
    }

    get _wmicon() : Label {
        if(!this.#_bgicon) {
            this.#_bgicon = new Label(0, 0, this.w, this.h, `${this.id}_bgicon`)
            this.#_bgicon.catchEvents = false
            this.addChild(this.#_bgicon)
        }
        return this.#_bgicon
    }

    //
    get visible() : boolean {
        return super.visible
    }

    set visible(value : boolean) {
        if (super.visible != value) {
            globalThis.visible_change_count++
        }
        super.visible = value
    }

    getRoot() : Window {
        return globalThis.wmGlobal
    }

    add(w : Window) {
        if(!w.id) {
            throw 'Control does not have valid ID';
        }
        return this.addChild(w)
    }

    delete(id : string) {
        if(this.list.has(id)) {
            this.list.delete(id)
        }
    }

    getWindow(id : string, throw_exception : boolean = true) : Window | null {
        if(!this.list.has(id)) {
            if(throw_exception) throw `error_window_not_found_by_id|${id}`
            return null
        }
        return this.list.get(id)
    }

    getVisibleWindowOrNull(id : string) : Window | null {
        const w = this.list.get(id);
        return w && w.visible ? w : null;
    }

    move(x : number, y : number) {
        this.x = x
        this.y = y
    }

    resize(width : number, height : number) {
        this.getRoot()._wm_setTooltipText(null);
        this.width = width
        this.height = height
        this._resized()
    }

    center(w : Window) {
        w.move(this.w / 2 - w.w / 2, this.h / 2 - w.h / 2)
    }

    // Place all childs to center of this window
    centerChild() {
        let width_sum = 0;
        let height_sum = 0;
        let visible_windows = [];
        for(let window of this.list.values()) {
            if(window.visible && window.auto_center) {
                width_sum += window.w;
                height_sum += window.h;
                visible_windows.push(window);
            }
        }
        //
        visible_windows.sort((a, b) => a.index - b.index);
        //
        if(width_sum < this.w) {
            // hor
            let x = Math.round(this.w / 2 - width_sum / 2);
            for(let w of visible_windows) {
                w.x = x;
                w.y = this.h / 2 - w.h / 2;
                x += w.w;
            }
        } else {
            // vert
            let y = Math.round(this.h / 2 - height_sum / 2);;
            for(let w of visible_windows) {
                w.y = y;
                w.x = this.w / 2 - w.w / 2;
                y += w.h;
            }
        }
    }

    /**
     * @deprecated
     */
    clear() {}

    draw(_ctx, _ax, _ay) {
    }

    /**
     * @deprecated
     */
    updateMeasure(_ctx, _ax, _ay) {}

    calcMaxHeight() {
        let mh = 0;
        for(let w of this.list.values()) {
            if(!w.visible) continue;
            if(w.y + w.h > mh) {
                mh = w.y + w.h;
            }
        }
        this.max_height = mh + this.style.padding.top + this.style.padding.bottom
    }

    hasVisibleWindow() {

        for(let w of this.getRoot().children) {
            if(w && w.id && w.visible && !(w instanceof Label) && w.catchEvents) return true
        }

        return false

        /*
        console.log(this._has_visible_window_cng, visible_change_count)
        if(this._has_visible_window_cng == visible_change_count) {
            return this._has_visible_window;
        }
        let resp = false;
        for(let w of this.list.values()) {
            if(w.visible) {
                resp = true;
                break;
            }
        }
        this._has_visible_window = resp;
        this._has_visible_window_cng = visible_change_count;
        return resp;
        */
    }

    *visibleWindows(): IterableIterator<Window> {
        for(let w of this.list.values()) {
            if(w.visible) {
                yield w
                // if the window itself has nested visible windows, e.g. InGameMain
                if (w.visibleSubWindows) {
                    yield *w.visibleSubWindows()
                }
            }
        }
    }

    /**
     * @deprecated
     */
    redraw() {
        if(!this.ctx) {
            return;
        }
        this.draw(this.ctx, this.ax, this.ay);
    }

    setText(text) {
        this.text = text
    }

    /**
     * Return current text metrics
     * @param {boolean} ignore_bitmap_font_metrics
     * @returns {PIXI.TextMetrics}
     */
    getTextMetrics(ignore_bitmap_font_metrics) {
        const tc = this.text_container;
        if (tc._activePagesMeshData && !ignore_bitmap_font_metrics) {
            // TODO: возвращает неверный размер, если в конце строки пробел
            if (tc.dirty) {
                tc.updateText();
            }
            return {
                width: tc._textWidth,
                height: tc._textHeight
            }
        }

        return PIXI.TextMetrics.measureText(this.text_container.text, this.style.font._font_style)
    }

    /**
     * @deprecated
     */
    applyStyle(ctx, ax, ay) {}

    /**
     * Set window background and size mode
     * @param {?string|Image} urlOrImage
     * @param {?string} image_size_mode
     * @param {?float} scale
     */
    async setBackground(urlOrImage, image_size_mode? : string, scale? : float, tintMode : int = 0) {
        //if(!isScalar(urlOrImage)) {
        //    if(urlOrImage instanceof Promise) {
        //        urlOrImage = await urlOrImage
        //    }
        //}
        this.style.background.image = urlOrImage
        if(scale) this.style.background.scale = scale
        if(image_size_mode) this.style.background.image_size_mode = image_size_mode
        this.style.background.sprite.tintMode = tintMode;
    }

    /**
     * @param {?string|Image} urlOrImage
     * @param {?string} image_size_mode
     * @param {?float} scale
     */
    async setIcon(urlOrImage, image_size_mode : string = 'none', scale? : float, tintMode : int = 0) {
        //if(!isScalar(urlOrImage)) {
        //    if(urlOrImage instanceof Promise) {
        //        urlOrImage = await urlOrImage
        //    }
        //}
        if(urlOrImage) {
            this._wmicon.setBackground(urlOrImage, image_size_mode, scale, tintMode)
        }
        this._wmicon.visible = !!urlOrImage
    }

    show(args?) {
        // for(let w of wmGlobal.visibleWindows()) {
        //     if (!this.canBeOpenedWith.includes(w.id) && !(w?.canBeOpenedWith?.includes(this.id) ?? false)) {
        //         return
        //     }
        // }
        this.visible = true
        this.resetHover()
        this.onShow(args)
    }

    hide() {
        const wasVisible = this.visible;
        this.visible = false;
        this.resetHover();
        this.onHide(wasVisible);
        if(typeof Qubatch !== 'undefined' && Qubatch.hud) {
            Qubatch.hud.prevDrawTime = 0
        }
    }

    hideAndSetupMousePointer() {
        this.hide();
        try {
            Qubatch.setupMousePointer(true);
        } catch(e) {
            console.error(e);
        }
    }

    resetHover() {
        this.getRoot()._wmoverlay.resetTooltip()
        this.hover = false;
        for(let w of this.list.values()) {
            w.hover = false;
        }
    }

    toggleVisibility() {
        if(this.visible) {
            return this.hide()
        }
        return this.show()
    }

    /**
     * По событию мыши на контексте определяет и возвращает точное окно,
     * к которому относится событие, а также создает и возвращает новое событие для него
     * @param {*} e
     * @returns {object}
     */
    _clarifyMouseEvent(e) {
        // список окон отсортированный по Z координате
        const visible_windows = []
        if(this.interactiveChildren) {
            for(let window of this.list.values()) {
                if(window.visible) {
                    if(window.catchEvents) {
                        visible_windows.push(window)
                    }
                }
            }
        }
        visible_windows.sort((a, b) => b.z - a.z)
        const resp = {window: null, event: null, visible_windows}
        for(let window of visible_windows) {
            if(window.visible) {
                const e2 = {...e}
                const x = e2.x - (this.ax + window.x)
                const y = e2.y - (this.ay + window.y)
                if(x >= 0 && y >= 0 && x < window.w && y < window.h) {
                    e2.x = window.ax + x
                    e2.y = window.ay + y // - window.scrollY
                    resp.window = window
                    e2.target = window
                    resp.event = e2
                    break
                }
            }
        }
        return resp
    }

    _drop(e) {
        const {window, event} = this._clarifyMouseEvent(e)
        if(window) {
            return window._drop(event)
        }
        this.onDrop(e);
    }

    _wheel(e) {
        const {window, event} = this._clarifyMouseEvent(e)
        if(window) {
            return window._wheel(event)
        }
        this.onWheel(e)
    }

    _mousedown(e) {
        let {window, event} = this._clarifyMouseEvent(e)
        if(window) {
            if(window.draggable) {
                const e2 = {...e}
                e2.x = e2.x - (this.ax + window.x)
                e2.y = e2.y - (this.ay + window.y)
                event = e2
                current_drag_window = window
            }
            return window._mousedown(event)
        }
        if(this instanceof Button) {
            this.onMouseLeave()
        }
        this.onMouseDown(e)
    }

    _mouseup(e) {
        let window = null
        let event = e
        if(current_drag_window) {
            window = current_drag_window
            current_drag_window = null
        } else {
            const resp = this._clarifyMouseEvent(e)
            window = resp.window
            event = resp.event
        }
        if(window) {
            return window._mouseup(event)
        }
        if(this instanceof Button) {
            this.onMouseLeave()
        }
        this.onMouseUp(e)
    }

    _mousemove(e) {

        this.hover = true
        this.onMouseMove(e)
        let entered = []
        let leaved = []

        if(current_drag_window && this != current_drag_window) {
            const window = current_drag_window
            const e2 = {...e}
            e2.x = e.x - window.worldTransform.tx
            e2.y = e.y - window.worldTransform.ty
            // window._mousemove(e2)
            window.onMouseMove(e2)
            return
        }

        const {window, event, visible_windows} = this._clarifyMouseEvent(e)

        for(let w of visible_windows) {
            let old_hover = w.hover
            w.hover = false
            if(w === window) {
                w._mousemove(event)
                w.hover = true
            }
            if(w.hover != old_hover) {
                if(w.hover) {
                    entered.push(w)
                } else {
                    leaved.push(w)
                }
            }
        }

        if(entered.length + leaved.length > 0) {
            if(entered.length > 0) {
                this.getRoot()._wm_setTooltipText(entered[0].tooltip)
                entered[0].onMouseEnter();
                this.getRoot().rootMouseEnter(entered[0])
            } else {
                this.getRoot()._wm_setTooltipText(null);
            }
            if(leaved.length > 0) {
                leaved[0].onMouseLeave();
                this.getRoot().rootMouseLeave(leaved[0])
            }
        }

    }

    // measureMultilineText(ctx, text, lineHeightMultiply = 1.05, lineHeightAdd = 2) {
    //     const lines = text.split("\r");
    //     let width = 0;
    //     let actualBoundingBoxDescent = 0;
    //     for(const line of lines) {
    //         const mt = ctx.measureText(line);
    //         width = Math.max(width, mt.w);
    //         actualBoundingBoxDescent += mt.actualBoundingBoxDescent * lineHeightMultiply + lineHeightAdd;
    //     }
    //     return { width, actualBoundingBoxDescent };
    // }

    calcPrintLines(original_text, ax? : number, ay? : number) {
        if(!this.word_wrap || !this.ctx) {
            return [original_text];
        }
        let currentLine = 0;
        const lines = [''];
        //
        this.applyStyle(this.ctx, ax, ay);
        if(this.max_chars_per_line > 0) {
            original_text = RuneStrings.splitLongWords(original_text, this.max_chars_per_line);
        }
        //
        function addLine() {
            currentLine++;
            if(lines.length < currentLine + 1) {
                lines.push('');
            }
        }
        let texts = original_text.split("\r");
        for(let text of texts) {
            let words = (text + '').split(' ');
            let idx = 1;
            if(words.length > 1) {
                while(words.length > 0 && idx <= words.length) {
                    let str = words.slice(0, idx).join(' ');
                    let w = this.ctx.measureText(str).width;
                    // Wrap to next line if current is full
                    if(w > this.w - this.style.padding.left - this.style.padding.right) {
                        if(idx == 1) {
                            idx = 2;
                        }
                        let print_word = words.slice(0, idx - 1).join(' ');
                        lines[currentLine] += print_word;
                        addLine();
                        words = words.splice(idx - 1);
                        idx = 1;
                    } else {
                        idx++;
                    }
                }
            }
            if(idx > 0) {
                lines[currentLine] += words.join(' ');
            }
            addLine();
        }
        lines.pop();
        return lines;
    }

    print(original_text) {
        if(!this.ctx) {
            console.error('Empty context');
            return;
        }
        const x             = this.x + this.ax + this.style.padding.left;
        const y             = this.y + this.ay + this.style.padding.top;
        const lineHeight    = this.style.font.size * 1.05
        const lines         = this.calcPrintLines(original_text || '');
        // Draw cariage symbol
        if(this.draw_cariage) {
            const now = performance.now();
            let how_long_open = Math.round(now - this.create_time);
            if(how_long_open % BLINK_PERIOD < BLINK_PERIOD * 0.5) {
                lines[lines.length - 1] += '_';
            }
        }
        // Print lines
        for(let i = 0; i < lines.length; i++) {
            const line = lines[i];
            this.ctx.fillText(line, x, y + (lineHeight * i));
        }
    }

    loadCloseButtonImage(callback) {
        if(this._loadCloseButtonImage) {
            callback(this._loadCloseButtonImage);
        }
        // Load buttons background image
        const image = new Image();
        const that = this;
        image.onload = function() {
            that._loadCloseButtonImage = this
            callback(that._loadCloseButtonImage)
        }
        image.src = '../../media/gui/close.png'
    }

    assignStyles(style) {
        const deep_assign_options = {nonEnum: false, symbols: false, descriptors: false, proto: false}
        for(let param in style) {
            let v = style[param]
            switch(param) {
                case 'padding': {
                    if(!isNaN(v)) {
                        v = {left: v, top: v, right: v, bottom: v};
                    }
                    this.style[param] = v
                    break
                }
                default: {
                    deepAssign(deep_assign_options)(this.style[param], v)
                    break
                }
            }
        }
    }

    // Draw image
    drawImage(val, x, y, w, h) {
        // draw image
        if(val.image && (typeof val.image == 'object')) {
            const iw = val.image.width;
            const ih = val.image.height;
            // image_size_mode
            // img, sx, sy, swidth, sheight, x, y, width, height
            switch(val.image_size_mode) {
                case 'none': {
                    this.ctx.drawImage(val.image, x + w / 2 - iw / 2, y + h / 2 - ih / 2, iw, ih);
                    break;
                }
                case 'stretch': {
                    this.ctx.drawImage(val.image, 0, 0, iw, ih, x, y, w, h);
                    break;
                }
                case 'cover': {
                    /**
                     * By Ken Fyrstenberg Nilsen
                     * drawImageProp(context, image [, x, y, width, height [,offsetX, offsetY]])
                     * If image and context are only arguments rectangle will equal canvas
                    */
                    function drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY) {
                        if (arguments.length === 2) {
                            x = y = 0;
                            w = ctx.canvas.width;
                            h = ctx.canvas.height;
                        }
                        // default offset is center
                        offsetX = typeof offsetX === "number" ? offsetX : 0.5;
                        offsetY = typeof offsetY === "number" ? offsetY : 0.5;
                        // keep bounds [0.0, 1.0]
                        if (offsetX < 0) offsetX = 0;
                        if (offsetY < 0) offsetY = 0;
                        if (offsetX > 1) offsetX = 1;
                        if (offsetY > 1) offsetY = 1;
                        var iw = img.width,
                            ih = img.height,
                            r = Math.min(w / iw, h / ih),
                            nw = iw * r,   // new prop. width
                            nh = ih * r,   // new prop. height
                            cx, cy, cw, ch, ar = 1;
                        // decide which gap to fill
                        if (nw < w) ar = w / nw;
                        if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
                        nw *= ar;
                        nh *= ar;
                        // calc source rectangle
                        cw = iw / (nw / w);
                        ch = ih / (nh / h);
                        cx = (iw - cw) * offsetX;
                        cy = (ih - ch) * offsetY;
                        // make sure source rectangle is valid
                        if (cx < 0) cx = 0;
                        if (cy < 0) cy = 0;
                        if (cw > iw) cw = iw;
                        if (ch > ih) ch = ih;
                        // fill image in dest. rectangle
                        ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
                    }
                    drawImageProp(this.ctx, val.image, x, y, w, h, 0.5, 0.5);
                    break;
                }
                case 'sprite': {
                    const opts = val.sprite;
                    if(opts.mode == 'stretch') {
                        this.ctx.drawImage(val.image, opts.x, opts.y, opts.width, opts.height, x, y, w, h);
                    } else if(opts.mode == 'none') {
                        const offset = 30;
                        this.ctx.drawImage(val.image, opts.x, opts.y, opts.width, opts.height, x + offset / 2, y + offset / 2, w - offset, h - offset);
                    }
                    break;
                }
            }

        }
    }

    onUpdate() {
        // It's called every interation of the game loop for visible windows. Override it in the subclasses.
    }

    get focused() {
        return this.getRoot().getFocusedControl() === this
    }

    set focused(value) {
        if(value) {
            this.getRoot().setFocusedControl(this)
        } else {
            this.getRoot().removeFocusFromControl(this)
        }
    }

    clip(x? : float, y? : float, w? : float, h? : float) {

        x = x ?? 0
        y = y ?? 0
        w = w ?? this.w
        h = h ?? this.h

        let clip_mask = this.#_wmclip
        if(!clip_mask) {
            clip_mask = new Graphics()
            clip_mask.id = `${this.id}_clip_mask`
            clip_mask.width = w
            clip_mask.height = h
            clip_mask.clear()
            clip_mask.beginFill(0x00ff0055)
            clip_mask.drawRect(0, 0, w, h)
            this.add(clip_mask)
            this.#_wmclip = clip_mask
            this.mask = clip_mask
        } else {
            clip_mask.width = w
            clip_mask.height = h
            clip_mask.clear()
            clip_mask.beginFill(0x00ff0055)
            clip_mask.drawRect(0, 0, w, h)
        }

        clip_mask.transform.position.set(x, y)

    }

}

export class Icon extends Window {

    constructor(x, y, w, h, id, zoom) {
        super(x * zoom, y * zoom, w * zoom / 2, h * zoom / 2, id + '' + w, '', '')
        this.sprite_w = w
        this.sprite_h = h
        this.axis_x = true
    }

    scroll(val) {
        const spite =  this.style.background.sprite
        if (this.axis_x){
            spite.texture.frame.width = this.sprite_w * val
        } else {
            spite.y = spite._height * (1 - val)
            spite.texture.frame.y = this.sprite_h * (1 - val)
            spite.texture.frame.height = this.sprite_h * val
        }
        spite.texture.updateUvs()
    }

}

// Button
export class Button extends Window {

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {

        super(x, y, w, h, id, title, title)
        this.style.border.hidden = false
        this.style.padding.set(10)

        this.interactiveChildren = false
        // this.buttonMode = true

        if(this.text_container) {
            this.style.textAlign.horizontal = 'center'
            this.style.textAlign.vertical = 'middle'
            // this.text_container.anchor.set(.5, .5)
            // this.text_container.position.set(this.w / 2, this.h / 2)
        }

        this.swapChildren(this.children[0], this.children[1])

        this.style.textAlign.horizontal = 'center';
        this.style.textAlign.vertical = 'middle';

    }

    onMouseEnter() {
        if(!this.style.background.color_save) {
            this.style.background.color_save = this.style.background.color
            this.style.color_save = this.style.font.color
        }
        this.style.background.color = '#8892c9'
        this.style.font.color = '#ffffff'
        super.onMouseEnter()
    }

    onMouseLeave() {
        this.style.background.color = this.style.background.color_save
        this.style.font.color = this.style.color_save
        super.onMouseLeave()
    }

}

// Label
export class Label extends Window {

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, title)
        this.style.background.color = '#00000000'
        this.style.border.hidden = true
        this.setText(text)
        this.interactiveChildren = false
    }

}

// TextEdit
export class TextEdit extends Window {

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {

        super(x, y, w, h, id, title, text)

        this.max_length             = 0;
        this.max_lines              = 1;
        this.max_chars_per_line     = 0;
        this.draw_cariage           = true

        this.interactiveChildren    = false

        // Styles
        this.style.background.color = '#ffffff77'
        this.style.border.hidden = true
        this.style.border.style = 'inset'
        this.style.font.size = 19
        this.style.font.family = 'Ubuntu'
        // this.style.padding = {
        //     left: 5,
        //     right: 5,
        //     top: 5,
        //     bottom: 5
        // }

        this.text_container.x = 5 * this.zoom

        // Properties
        this.focused = false
        this.buffer = []

        // Backspace pressed
        this.backspace = () => {
            if(!this.focused) {
                return;
            }
            if(this.buffer.length > 0) {
                this.buffer.pop();
                this._changed();
            }
        }

    }

    typeChar(e, charCode, ch) {
        if(!this.focused) {
            return;
        }
        if(charCode == 13 && this.max_lines < 2) {
            return false
        }
        if(this.buffer.length < this.max_length || this.max_length == 0) {
            if(this.max_lines > 1) {
                const ot = this.buffer.join('') + ch;
                const lines = this.calcPrintLines(ot);
                if(lines.length > this.max_lines) {
                    return
                }
            }
            this.buffer.push(ch);
            this._changed();
        }
    }

    /**
     * @returns {string}
     */
    get text() {
        return this.buffer.join('');
    }

    /**
     * @param {string} value
     */
    set text(value) {
        this.buffer = RuneStrings.toArray(value || '')
        this._changed()
    }

    /**
     * @param {string} value
     */
    setIndirectText(value) {
        super.text = value
    }

    //
    _changed() {
        const text = this.buffer.join('')
        super.text = text
        // this.text_container.text = text
        this.onChange(text)
    }

    onChange(text) {
        // do nothing
    }

    paste(str) {
        for(let i in str) {
            this.typeChar(null, str.charCodeAt(i), str[i]);
        }
    }

    // Hook for keyboard input
    onKeyEvent(e) {
        const {keyCode, down, first} = e;
        switch(keyCode) {
            case KEY.ENTER: {
                if(down) {
                    if(this.max_lines > 1) {
                        this.buffer.push(String.fromCharCode(13));
                        this._changed()
                    }
                }
                return true
            }
            case KEY.BACKSPACE: {
                if(down) {
                    this.backspace()
                }
                return true
            }
        }
        return false
    }

}

class Tooltip extends Label {

    /**
     * @param {?string} text
     */
    constructor(text = null) {

        super(0, 0, 100, 20, '_tooltip', null, text)

        this.style.font.color = '#ffffff'
        this.style.padding.set(7 * this.zoom, 4 * this.zoom)
        this.style.font.word_wrap = true

        this.text_container.style.wordWrapWidth = this.getRoot().w / 2

        this.setText(text)
    }

    setText(text) {

        this.visible = !!text
        this.text = text

        if(this.visible) {
            this.w = this.text_container.width + this.style.padding.left + this.style.padding.right
            this.h = this.text_container.height + this.style.padding.top + this.style.padding.bottom
            this.style.background.color = '#000000c0'
        }

    }

}

export class SimpleBlockSlot extends Window {

    bar :       Label           = null
    bar_value : Label           = null
    hud_atlas : SpriteAtlas     = null

    slot_empty  = 'window_slot' // 'slot_empty'
    slot_full   = 'window_slot' // 'slot_full'
    slot_locked = 'window_slot_locked' // 'slot_full'

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text)
        this.style.font.color = '#ffffff'
        this.style.font.shadow.enable = true
        this.style.font.shadow.alpha = .5
        this.style.font.size = 14

        this.interactiveChildren = false

        this.text_container.anchor.set(1, 1)
        this.text_container.transform.position.set(this.w - 2 * this.zoom, this.h - 2 * this.zoom)

        const padding = 0
        const bar_height = 3 * this.zoom

        this.bar = new Label(padding, h - bar_height - padding, this.w - padding * 2, bar_height, 'lblBar')
        this.bar.style.background.color = '#00000000'
        this.bar.visible = false
        this.bar.catchEvents = false
        this.bar_value = new Label(0, 0, this.bar.w, this.bar.h, 'lblBar')
        this.bar.addChild(this.bar_value)
        this.addChild(this.bar)

        // this.swapChildren(this._wmicon, this._wmbgimage)
        this.swapChildren(this._wmicon, this.text_container)

        this.item = null

    }

    initAndReturnAtlas() {
        if(this.hud_atlas) {
            return this.hud_atlas
        }
        this.hud_atlas = Resources.atlas.get('hud')
        if(this.hud_atlas) {
            this.setBackground(this.hud_atlas.getSpriteFromMap(this.slot_empty))
            const bar_sprite = this.hud_atlas.getSpriteFromMap('tooldmg_0')
            this.bar.style.background.color = '#00000000'
            const zoom = this.bar.w / bar_sprite.width
            this.bar.y = this.bar.y - (bar_sprite.height * zoom * .7)
            this.bar_value.h = this.bar.h = bar_sprite.height * zoom
            this.bar.setBackground(bar_sprite)
        }
        return this.hud_atlas
    }

    getItem() {
        return this.item
    }

    setItem(item : any, slot? : any): boolean {
        this.item = item
        this.slot = slot
        return this.refresh()
    }

    clear() {
        this.setItem(null)
    }

    /**
     * Redraw
     * @returns {boolean}
     */
    refresh() {

        const hud_atlas = this.initAndReturnAtlas()

        if(!hud_atlas) {
            console.error('error_atlas_not_found')
            return false
        }

        const item = this.getItem()

        this._wmicon.visible = !!item
        this.bar.visible = !!item

        let label = null

        // draw count && instrument livebar
        if(item) {

            const mat = BLOCK.fromId(item.id)
            const tintMode = item.extra_data?.enchantments ? 1 : 0

            this.setBackground(hud_atlas.getSpriteFromMap(this.slot_full))
            this.setIcon(getBlockImage(item), 'centerstretch', 1.0, tintMode)

            const power_in_percent = mat?.item?.indicator == 'bar'
            label = item.count > 1 ? item.count : null
            if(!label && 'power' in item) {
                if(power_in_percent) {
                    label = (Math.round((item.power / mat.power * 100) * 100) / 100) + '%'
                } else {
                    label = null
                }
            }

            // draw instrument life
            this.bar.visible = (mat.item?.instrument_id && item.power < mat.power) || power_in_percent
            if(this.bar.visible) {
                const percent = Math.max(Math.min(item.power / mat.power, 1), 0)
                const sprites = ['tooldmg_3', 'tooldmg_2', 'tooldmg_1']
                const index = Math.round(Math.min(sprites.length * percent, .999))
                const bar_value_sprite = hud_atlas.getSpriteFromMap(sprites[index])
                this.bar_value.setBackground(bar_value_sprite)
                this.bar_value.clip(0, 0, this.bar.w * percent)
            }

        } else {
            this.setBackground(hud_atlas.getSpriteFromMap(this.slot_empty))
        }

        this.text = label

        return true

    }

}

//
export class Pointer extends SimpleBlockSlot {

    constructor() {
        super(0, 0, 40 * UI_ZOOM, 40 * UI_ZOOM, '_wmpointer', null, null)
        this._wmbgimage.alpha = 0
    }

}

// Overlay
class WindowManagerOverlay extends Window {

    constructor(x, y, w, h, id) {
        super(x, y, w, h, id)
        this._wmpointer = new Pointer()
        this._wmtooltip = new Tooltip()
        this.addChild(this._wmpointer, this._wmtooltip)
    }

    resetTooltip() {
        this._wmtooltip.setText('')
    }

}

// WindowManager
export class WindowManager extends Window {

    static draw_calls = 0

    constructor(canvas, x, y, w, h, create_mouse_listeners : boolean = false) {

        super(x, y, w, h, '_wm', null)

        globalThis.wmGlobal = this
        this._focused_control = null
        this._cariage_speed = 200

        this.preloadFont();

        this.parent = new PIXI.Container()
        this.parent.addChild(this)

        this.rootMouseEnter = (_el) => {}
        this.rootMouseLeave = (_el) => {}

        // Все манипуляции мышью не будут работать без передачи менеджеру окон событий мыши
        if(create_mouse_listeners) {
            if(!canvas) throw 'error_canvas_undefined'
            canvas.addEventListener('mousemove', this.mouseEventDispatcher.bind(this))
            canvas.addEventListener('mousedown', this.mouseEventDispatcher.bind(this))
            canvas.addEventListener('mouseup', this.mouseEventDispatcher.bind(this))
            canvas.addEventListener('mousewheel', this.mouseEventDispatcher.bind(this))
            canvas.addEventListener('wheel', this.mouseEventDispatcher.bind(this))
        }

        const that = this

        this.root = this
        this.canvas = canvas
        this.qubatchRender = null;
        this.ctx = null

        // // Add pointer and tooltip controls
        this._wmoverlay = new WindowManagerOverlay(0, 0, w, h, '_wmoverlay')
        this.parent.addChild(this._wmoverlay)

        this.cariageTimer = setInterval(() => {
            const fc = this._focused_control
            if(fc && fc instanceof TextEdit && fc.parent.visible) {
                if(fc.draw_cariage) {
                    const vis = (performance.now() % (this._cariage_speed * 2)) < this._cariage_speed
                    if(vis) {
                        fc.setIndirectText(fc.text + '_')
                    } else {
                        fc.setIndirectText(fc.text)
                    }
                }
            }
        }, this._cariage_speed)

        /**
         * @type { Pointer }
         */
        this.drag = that._wmoverlay._wmpointer

    }

    getFocusedControl() {
        return this._focused_control
    }

    setFocusedControl(window) {
        this._focused_control = window
    }

    removeFocusFromControl(window) {
        if(this._focused_control == window) {
            this._focused_control = null
        }
    }

    preloadFont() {
        if (this.bfTextures) {
            return;
        }
        this.bfTextures = [
            new PIXI.Texture(new PIXI.BaseTexture())
        ];
        const bfData = new PIXI.BitmapFontData();
        bfData.char = msdf.chars
        bfData.page = [{id: 0, file: "UbuntuMono-Regular.png"}]
        bfData.info = [msdf.info]
        bfData.common = [msdf.common]
        bfData.distanceField = [msdf.distanceField]
        PIXI.BitmapFont.install(bfData, this.bfTextures);
    }

    loadFont() {
        const baseRp = Qubatch.world.block_manager.resource_pack_manager.list.get('base');
        const res = new PIXI.ImageBitmapResource(baseRp.textures.get('alphabet').texture.source);
        this.bfTextures[0].baseTexture.setResource(res);
    }

    draw() {

        this.centerChild()

        if (!this.qubatchRender) {
            return;
        }
        // reset pixi state
        this.pixiRender.shader.program = null;
        this.pixiRender.shader.bind(this.pixiRender.plugins.batch._shader, true);
        this.pixiRender.reset();
        this.pixiRender.texture.bind(null, 3);
        this.pixiRender.texture.bind(null, 6);
        this.pixiRender.texture.bind(null, 7);
        this.pixiRender.texture.bind(null, 8);

        this.pixiRender.render(this.parent);
    }

    initRender(qubatchRender) {
        if (qubatchRender) {
            this.qubatchRender = qubatchRender;
            this.canvas = qubatchRender.canvas;
            this.pixiRender = new PIXI.Renderer({
                context: qubatchRender.renderBackend.gl,
                view: this.canvas,
                width: this.canvas.width,
                height: this.canvas.height,
                clearBeforeRender: false
            })
        } else {
            this.pixiRender = new PIXI.Renderer({
                view: this.canvas,
                width: this.canvas.width,
                height: this.canvas.height,
                backgroundAlpha: 0,
                background: 'transparent',
                transparent: true
            })
            const ticker = new PIXI.Ticker();
            ticker.add(() => {
                this.pixiRender.render(this.parent);
            }, PIXI.UPDATE_PRIORITY.LOW)
            ticker.start();
        }
        // this.loadFont();
    }

    closeAll() {
        this._wmoverlay.resetTooltip()
        for(let w of this.visibleWindows()) {
            w.hide()
        }
    }

    mouseEventDispatcher(e) {

        switch(e.type) {
            case 'mousemove': {
                const evt = {
                    shiftKey:   e.shiftKey,
                    button_id:  e.button_id,
                    x:          e.offsetX - this.x,
                    y:          e.offsetY - this.y
                };

                const pointer = this._wmoverlay._wmpointer
                const tooltip = this._wmoverlay._wmtooltip

                pointer.x = e.offsetX - pointer.w / 2
                pointer.y = e.offsetY - pointer.h / 2

                // Calculate tooltip position
                const pos = {x: pointer.x + pointer.w / 2, y: pointer.y + pointer.h / 2};
                if(pos.x + tooltip.w > this.w) {
                    pos.x -= tooltip.w
                }
                if(pos.y + tooltip.h > this.h) {
                    pos.y -= tooltip.h
                }
                tooltip.move(pos.x, pos.y)

                this._mousemove(evt)
                break
            }
            case 'mousedown': {
                const evt = {
                    shiftKey:   e.shiftKey,
                    button_id:  e.button_id,
                    drag:       this.drag,
                    x:          e.offsetX - this.x,
                    y:          e.offsetY - this.y
                };
                this.drag.slot = null // if a slot previously remembered itself in this.darg when clicked, forget it
                if(this.drag.getItem()) {
                     // this._drop(evt)
                } else {
                    this._mousedown(evt)
                }
                break
            }
            case 'mouseup': {
                const evt = {
                    shiftKey:   e.shiftKey,
                    button_id:  e.button_id,
                    drag:       this.drag,
                    x:          e.offsetX - this.x,
                    y:          e.offsetY - this.y
                };
                if(this.drag.getItem()) {
                    this._drop(evt)
                } else {
                    this._mouseup(evt)
                }
                break
            }
            case 'mousewheel':
            case 'wheel': {
                if(!this.drag.getItem()) {
                    const evt = {
                        shiftKey:       e.shiftKey,
                        button_id:      e.button_id,
                        original_event: e.original_event,
                        x:              e.offsetX - this.x,
                        y:              e.offsetY - this.y
                    }
                    this._wheel(evt)
                    // Хак, чтобы обновились ховер элементы
                    this.mouseEventDispatcher({...e, type: 'mousemove'})
                }
                break;
            }
            default: {
                break
            }
        }
    }

    _wm_setTooltipText(text) {
        this._wmoverlay._wmtooltip.setText(text)
    }

    // calls Window.onUpdate() for each visible window
    updateVisibleWindows() {
        for(let w of this.visibleWindows()) {
            w.onUpdate();
        }
    }
}

export class VerticalLayout extends Window {

    constructor(x : number, y : number, w : number, id : string) {
        super(x, y, w, 0, id, null, null);
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        this.gap = 0
    }

    refresh() {
        let y = 0
        for(const w of this.list.values()) {
            if(!w.visible) continue
            w.x = 0
            w.y = y
            if(w.autosize) {
                w.w = this.w
                w.text_container.style.wordWrapWidth = w.w - w.style.padding.left - w.style.padding.right
                const tm = w.getTextMetrics()
                if(tm.height && w.autosize) {
                    w.h = tm.height + ((w.style.padding.top + w.style.padding.bottom) | 0)
                }
            }
            y += w.h + this.gap
        }
        this.calcMaxHeight();
        this.h = this.max_height;
    }

}

// ToggleButton
export class ToggleButton extends Button {

    toggled_font_color = '#ffffff'
    untoggled_font_color = '#3f3f3f'

    toggled_bgcolor = '#7882b9'
    untoggled_bgcolor = '#00000000'

    mouse_enter_bgcolor = '#8892c9'
    mouse_enter_font_color = '#ffffff'

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        this.toggled = false;
        this.style.textAlign.horizontal = 'left'
        this.style.padding.left = 15
    }

    onMouseEnter() {
        super.onMouseEnter()
        this.style.background.color = this.mouse_enter_bgcolor
        this.style.font.color = this.mouse_enter_font_color
    }

    onMouseLeave() {
        super.onMouseEnter()
        this.style.background.color = this.toggled ? this.toggled_bgcolor : this.untoggled_bgcolor
        this.style.font.color = this.toggled ? this.toggled_font_color : this.untoggled_font_color
    }

    //
    toggle() {
        if(this.parent.__toggledButton) {
            this.parent.__toggledButton.toggled = false;
            this.parent.__toggledButton.onMouseLeave();
        }
        this.toggled = !this.toggled;
        this.parent.__toggledButton = this;
        this.style.background.color = this.toggled ? this.toggled_bgcolor : this.untoggled_bgcolor
        this.style.font.color = this.toggled ? this.toggled_font_color : this.untoggled_font_color
    }

}

export class Slider extends Window {

    min_size_scroll:    number = 50
    grab:               boolean = false
    horizontal:         boolean = false
    _min:               number = 0
    _max:               number = 0
    _value:             number = 0
    wScrollTrack:       Label = null
    wScrollThumb:       Label = null
    start_drag_pos:     Vector = new Vector(0, 0, 0)
    thumb_start_pos:    Vector = new Vector(0, 0, 0)

    constructor(x : number, y : number, w : number, h : number, id : string) {
        super(x, y, w, h, id, null, null)
        // Thumb
        this.wScrollThumb = new Label(0, 0, this.w, this.h / 2, 'lblScrollbarThumb')
        this.wScrollThumb.style.background.color = '#000000'
        this.wScrollThumb.interactiveChildren = false
        this.add(this.wScrollThumb)
        // Track
        this.wScrollTrack = new Label(0, 0, this.w, this.h / 2, 'lblScrollbarTrack')
        this.wScrollTrack.style.background.color = '#00000033'
        this.wScrollTrack.w = this.w * .15
        const track_margin = (this.w - this.wScrollTrack.w) / 2
        this.wScrollTrack.h = this.h - track_margin * 2
        this.wScrollTrack.x = this.w / 2 - this.wScrollTrack.w / 2
        this.wScrollTrack.y = track_margin
        this.wScrollTrack.interactiveChildren = false
        this.add(this.wScrollTrack)
        //
        this.interactiveChildren = false
        this.draggable = true
        this.horizontal = w > h
    }

    set value(value : number) {
        if (value > this._max) {
            this._value = this._max
        } else if (value < this._min) {
            this._value = this._min
        } else {
            this._value = value
        }
        const thumb = this.wScrollThumb
        const size = ((this.horizontal) ? thumb.w : thumb.h)
        const pr = this._value / (this._max - this._min)
        if (this.horizontal) {
            thumb.x = Math.ceil(pr * (this.w - size))
        } else {
            thumb.y = Math.ceil(pr * (this.h - size))
        }
    }

    set max(value : number) {
        this._max = value > 0 ? Math.ceil(value) : 0
        if (this.horizontal) {
            const size = this.w / (2 *(this._max - this._min))
            this.wScrollThumb.w = Math.max(size, this.min_size_scroll)
        } else {
            const size = (this.h / (this.h + value)) * this.h
            this.wScrollThumb.h = Math.max(size, this.min_size_scroll)
        }
        this.value = 0
        this.style.background.resize()
    }

    set min(value : number) {
        this._min = value
        if (this.horizontal) {
            const size = this.w / (this._max - this._min)
            this.wScrollThumb.w = (size > this.min_size_scroll) ? size : this.min_size_scroll
        } else {
            const size = this.h / (this._max - this._min)
            this.wScrollThumb.h = (size > this.min_size_scroll) ? size : this.min_size_scroll
        }
    }

    onMouseDown(event) {
        this.grab = true
        const x = event.x
        const y = event.y
        this.start_drag_pos.set(x, y, 0)
        const thumb = this.wScrollThumb
        if(this.horizontal) {
            if(x < thumb.x || x > thumb.x + thumb.w) {
                thumb.x = x - thumb.w / 2
            }
        } else {
            if(y < thumb.y || y > thumb.y + thumb.h) {
                thumb.y = y - thumb.h / 2
            }
        }
        this.applyThumbPosition()
        this.thumb_start_pos.set(thumb.x, thumb.y, 0)
    }

    applyThumbPosition() {
        const thumb = this.wScrollThumb
        const size = ((this.horizontal) ? thumb.w : thumb.h)
        const max_pos = ((this.horizontal) ? this.w : this.h) - size
        if(this.horizontal) {
            thumb.x = Mth.clamp(thumb.x, 0, max_pos)
            this._value = Math.floor(((thumb.x * (this._max - this._min)) / max_pos) + this._min) || 0
        } else {
            thumb.y = Mth.clamp(thumb.y, 0, max_pos)
            this._value = Math.floor(((thumb.y * (this._max - this._min)) / max_pos) + this._min) || 0
        }
        this.onScroll(this._value)
    }

    onMouseUp(e) {
        this.grab = false
    }

    onMouseMove(event) {
        if (this.grab) {
            const thumb = this.wScrollThumb
            if(this.horizontal) {
                thumb.x = this.thumb_start_pos.x + (event.x - this.start_drag_pos.x)
            } else {
                thumb.y = this.thumb_start_pos.y + (event.y - this.start_drag_pos.y)
            }
            this.applyThumbPosition()
        }
    }

    onScroll(value : float) {}

}

export class HTMLText extends Window {

    #_wmhtmltext : PIXI.HTMLText

    constructor(x : number, y : number, w : number, h : number, id : string, title? : string, text? : string) {
        super(x, y, w, h, id, title, text)
        this.#_wmhtmltext = new PIXI.HTMLText("Hello <b>World</b>", {
            fontSize: 14 * this.zoom,
            wordWrap: true,
            breakWords: true,
            whiteSpace: 'pre-line',
            wordWrapWidth: this.w,
            fill: '#ffffff'
        });
        this.addChild(this.#_wmhtmltext)
    }

    get htmlStyle() {
        return this.#_wmhtmltext.style
    }

    set text(value : string) {
        this.#_wmhtmltext.text = value
    }

    set w(value : float) {
        // this.#_wmhtmltext.style.wordWrapWidth = this.w
        super.w = value
    }

    // set h(value : float) {
    //     // this.#_wmhtmltext
    //     super.h = value
    // }

}