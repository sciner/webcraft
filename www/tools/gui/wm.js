/**
* Window Manager based on PIXI.js 
*/

import {RuneStrings, deepAssign} from "../../js/helpers.js";
import { PIXI } from './pixi.js';
import { getRandomColor, parseColorAndAlpha, Style } from "./routines.js";

// Base window
export class Window extends PIXI.Container {

    #_tooltip = null

    zoom = UI_ZOOM
    canBeOpenedWith = [] // allows this window to be opened even if some other windows are opened

    constructor(x, y, w, h, id, title, text) {
        
        super()

        const that = this

        // List of childs
        this.list = {
            values: () => {
                let resp = []
                for(let w of this.children) {
                    if(w instanceof Window) {
                        resp.push(w)
                    }
                }
                return resp
            },
            has(id) {
                return !!this.get(id)
            },
            delete(id) {
                const window = this.get(id)
                that.removeChild([window])
            },
            get: (id) => {
                for(let w of this.children) {
                    if(w.id == id) return w
                }
                return null
            }
        }

        this.index              = 0
        this.x                  = x
        this.y                  = y
        this.z                  = 0 // z-index
        this.width              = w
        this.height             = h
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
        this.create_time        = performance.now()

        // all props
        this.style              = new Style(this)

        this.text               = text || null

        /*
        this.style = {
            color: '#3f3f3f',
            textAlign: {
                horizontal: 'left',
                vertical: 'top' // "top" || "hanging" || "middle" || "alphabetic" || "ideographic" || "bottom";
            },
            padding: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            },
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
            },
            background: {
                color: '#c6c6c6',
                image_size_mode: 'none', // none | stretch | cover
                image: null
            },
            icon: {
                color: '#c6c6c6',
                image_size_mode: 'none', // none | stretch | cover
                image: null
            },
            border: {
                color: '#3f3f3f',
                color_light: '#ffffff',
                width: 4,
                hidden: false
            }
        }
        */

        // Events
        this.onMouseLeave   = () => {
            for(let w of this.list.values()) {
                if(w.hover) {
                    w.hover = false;
                    w.onMouseLeave();
                }
            }
        };
        this.onHide         = function() {};
        this.onShow         = function() {};
        this.onMouseEnter   = function() {};
        this.onMouseDown    = function(e) {};
        this.onMouseMove    = function(e) {};
        this.onDrop         = function(e) {};
        this.onWheel        = function(e) {};

        // onKeyEvent
        this.onKeyEvent     = function(e) {
            for(let w of this.list.values()) {
                if(w.visible) {
                    let fired = false;
                    for(let f of w.list.values()) {
                        if(f.focused) {
                            fired = f.onKeyEvent(e);
                            if(fired) {
                                break;
                            }
                        }
                    }
                    if(!fired) {
                        w.onKeyEvent(e);
                    }
                }
            }
        }

        // typeChar
        this.typeChar = function(e, charCode, typedChar) {
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

    }

    /**
     * @type {int}
     */
    get ax() {
        return this.transform.position._x
    }

    /**
     * @type {int}
     */
    get ay() {
        return this.transform.position._y
    }

    /**
     * @param {int} value
     */
    set width(value) {
        if(value == undefined) return
        this.w = value
        super.width = value
    }

    /**
     * @param {int} value
     */
    set height(value) {
        if(value == undefined) return
        this.h = value
        super.height = value
    }

    get text() {
        return this.text_container?.text ?? null
    }

    /**
     * @param {?string} value
     */
    set text(value) {
        if(!this.text_container) {
            // this.text_container = new Label(0, 0, undefined, undefined, randomUUID(), undefined, value)
            this.text_container = new PIXI.Text(value, this.style.font._font_style)
            // this.text_container.x = 0
            // this.text_container.y = 0
            // this.text_container.width = this.w
            // this.text_container.height = this.h
            this.addChild(this.text_container)
        }
        this.text_container.text = value
    }

    //
    get tooltip() {return this.#_tooltip}
    set tooltip(value) {this.#_tooltip = value;}

    getRoot() {
        return globalThis.wmGlobal;
        // if(this.parent) {
        //     return this.parent.getRoot();
        // }
        // return this;
    }

    /**
     * @param {Window} w 
     */
    add(w) {
        if(!w.id) {
            throw 'Control does not have valid ID';
        }
        // w.parent = this
        // w.root = this.root
        this.addChild(w)
        // this.list.set(w.id, w)
    }

    delete(id) {
        if(this.list.has(id)) {
            this.list.delete(id)
        }
    }

    /**
     * @param {string} id 
     * @returns {Window}
     */
    getWindow(id, throw_exception = true) {
        if(!this.list.has(id)) {
            if(throw_exception) throw `error_window_not_found_by_id|${id}`
            return null
        }
        return this.list.get(id)
    }

    getVisibleWindowOrNull(id) {
        const w = this.list.get(id);
        return w && w.visible ? w : null;
    }

    move(x, y) {
        this.x = x;
        this.y = y;
    }

    resize(w, h) {
        this.getRoot()._wm_setTooltipText(null);
        this.width = w;
        this.height = h;
    }

    center(w) {
        w.move(this.w / 2 - w.w / 2, this.h / 2 - w.h / 2)
        // this.redraw();
    }

    // Place all childs to center of this window
    centerChild() {
        let width_sum = 0;
        let height_sum = 0;
        let visible_windows = [];
        for(let window of this.list.values()) {
            if(window.visible) {
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

    /**
     * @deprecated
     */
    draw(ctx, ax, ay) {
        // TODO:
        /*
        this.ctx = ctx;
        this.ax = ax;
        this.ay = ay;
        if(!this.visible) {
            return;
        }
        WindowManager.draw_calls++;

        let x = ax + this.x;
        let y = ay + this.y;
        let w = this.w;
        let h = this.h;

        // Save the default state
        ctx.save();

        // Clipping
        const p = this.parent;
        if(p) {
            const miny = Math.max(y, p.ay + p.y);
            // Create clipping path
            let region = new Path2D();
            region.rect(x, miny, w, Math.min(h, p.height));
            ctx.clip(region, 'nonzero');
        }

        // fill background color
        ctx.fillStyle = this.style.background.color;
        ctx.fillRect(x, y, w, h);

        // draw background
        this.drawImage(this.style.background, x, y, w, h);
        
        // draw icon
        this.drawImage(this.style.icon, x, y, w, h);
        
        //if(this.title || this.text) {
        this.applyStyle(ctx, ax, ay);
        this.updateMeasure(ctx, ax, ay);
        //}
        // Draw title
        if(this.title) {
            ctx.fillStyle = this.style.color;
            const pos = {
                x: x + (this.style.textAlign.horizontal == 'center' ? w / 2 : this.style.padding.left + (this.style.textAlign.horizontal == 'right' ? this.width : 0)),
                y: y + (this.style.textAlign.vertical == 'middle' ? h / 2 : this.style.padding.top + (this.style.textAlign.vertical == 'bottom' ? this.height : 0))
            };
            ctx.fillText(this.title, pos.x, pos.y);
        }
        // print text
        this.print(this.text);
        // draw border
        if(!this.style.border.hidden) {

            // colors
            const colors = [
                this.style.border.color_light,
                this.style.border.color
            ];
            if(this.style.border?.style == 'inset') {
                colors.push(colors.shift());
            }

            ctx.lineJoin = 'round';
            ctx.lineWidth = this.style.border.width;
            ctx.beginPath(); // Start a new path

            ctx.strokeStyle = colors[0];
            ctx.moveTo(x, y + h);
            ctx.lineTo(x, y );
            ctx.lineTo(x + w, y);
            ctx.stroke();

            ctx.beginPath(); // Start a new path
            ctx.strokeStyle = colors[1];
            ctx.moveTo(x + w, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.stroke();

            ctx.stroke(); // Render the path
        }
        // Restore the default state
        ctx.restore();
        //
        const visible_windows = [];
        for(let w of this.list.values()) {
            if(w.visible) {
                visible_windows.push(w);
            }
        }
        visible_windows.sort((a, b) => b.z - a.z);
        for(let w of visible_windows) {
            w.draw(ctx, ax+this.x, ay+this.y+this.scrollY);
        }
        */
    }

    /**
     * @deprecated
     */
    updateMeasure(ctx, ax, ay) {
        /*
        if(!this.__measure) {
            this.__measure = {
                title: {
                    value: null,
                    width: null,
                    height: null
                },
                text: {
                    value: null,
                    width: null,
                    height: null
                }
            }
        }
        // title
        const mtl = this.__measure.title;
        if(mtl.value != this.title) {
            let mt = ctx.measureText(this.title);
            mtl.value = this.title;
            mtl.width = mt.width;
            mtl.height = mt.actualBoundingBoxDescent;
        }
        // text
        const mtxt = this.__measure.text;
        if(mtxt.value != this.text) {
            this.applyStyle(ctx, ax, ay);
            let mt = ctx.measureText(this.text);
            mtxt.value = this.text;
            //
            if(this.word_wrap) {
                const lineHeight = this.style.font.size * 1.05;
                const lines = this.calcPrintLines(this.text || '', ax, ay);
                mtxt.height = lines.length * lineHeight;
            } else {
                mtxt.width = mt.width;
                mtxt.height = mt.actualBoundingBoxDescent;
            }
        }
        */
    }

    calcMaxHeight() {
        let mh = 0;
        for(let w of this.list.values()) {
            if(!w.visible) continue;
            if(w.y + w.h > mh) {
                mh = w.y + w.h;
            }
        }
        this.max_height = mh + this.style.padding.bottom;
    }

    hasVisibleWindow() {
        if(this._has_visible_window_cng == globalThis.wmGlobal.visible_change_count) {
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
        this._has_visible_window_cng = globalThis.wmGlobal.visible_change_count;
        return resp;
    }

    *visibleWindows() {
        for(let w of this.list.values()) {
            if(w.visible) {
                yield w;
            }
        }
    }

    redraw() {
        if(!this.ctx) {
            return;
        }
        this.draw(this.ctx, this.ax, this.ay);
    }

    setText(text) {
        this.text = text
    }

    applyStyle(ctx, ax, ay) {
        // TODO:
        /*
        this.ctx            = ctx;
        this.ax             = ax|0;
        this.ay             = ay|0;
        ctx.font            = this.style.font.size + 'px ' + this.style.font.family;
        ctx.fillStyle       = this.style.color;
        ctx.textAlign       = this.style.textAlign.horizontal || 'left';
        ctx.textBaseline    = this.style.textAlign.vertical || 'top';
        */
    }

    /**
     * Set wnidow background and size mode
     * @param {?string|Image} urlOrImage 
     * @param {?string} image_size_mode 
     */
    setBackground(urlOrImage, image_size_mode, scale) {

        this.style.background.image_size_mode = image_size_mode ? image_size_mode : this.style.background.image_size_mode

        // Set image
        const setImage = (image) => {

            // TODO: remove previous sprite
            const background = PIXI.Sprite.from(image)
            background._image = image
            this._bgimage = background
            // const background = new PIXI.Sprite(PIXI.Texture.WHITE)
            // background.tint = getRandomColor()

            background.anchor.x = 0
            background.anchor.y = 0
            background.position.x = 0
            background.position.y = 0

            // scale
            if(isNaN(scale)) {
                background.scale.set(this._width / image.width, this._height / image.height)
            } else {
                background.scale.set(scale, scale)
                // background.position.x = this.w / 2
                // background.position.y = this.h / 2
            }

            this.style.background.image_size_mode = image_size_mode ?? this.style.background.image_size_mode
    
            this.addChildAt(background, 1)

        }

        if (typeof urlOrImage == 'string') {

            const image = new Image()
            image.onload = (e) => {
                setImage(image)
            }
            image.src = urlOrImage

        } else {

            setImage(urlOrImage)

        }
        
    }

    setIconImage(url, image_size_mode) {
        const that = this;
        const icon = new Image();
        icon.onload = function(e) {
            that.style.icon.image = icon;
            that.style.icon.image_size_mode = image_size_mode ? image_size_mode : that.style.icon.image_size_mode;
            that.redraw();
        }
        icon.src = url;
    }

    show(args) {
        for(let w of wmGlobal.visibleWindows()) {
            if (!this.canBeOpenedWith.includes(w.id) && !(w?.canBeOpenedWith?.includes(this.id) ?? false)) {
                return
            }
        }
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
            Qubatch.hud.prevDrawTime = 0;
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

    _mousemove(e) {
        this.hover = true;
        this.onMouseMove(e);
        let entered = [];
        let leaved = [];
        // let fire_mousemove = [];
        //
        const visible_windows = [];
        for(let w of this.list.values()) {
            if(!w.catchEvents) {
                continue;
            }
            if(w.visible) {
                visible_windows.push(w);
            }
        }
        visible_windows.sort((a, b) => a.z - b.z);
        for(let w of visible_windows) {
            let old_hover = w.hover;
            w.hover = false;
            if(w.visible) {
                let e2 = {...e};
                let x = e2.x - w.x;
                let y = e2.y - w.y;
                if(x >= 0 && y >= 0 && x <= w.w && y <= w.h) {
                    e2.x = x;
                    e2.y = y - w.scrollY;
                    w._mousemove(e2);
                    w.hover = true;
                }
            }
            if(w.hover != old_hover) {
                if(w.hover) {
                    // w.onMouseEnter();
                    entered.push(w);
                } else {
                    // w.onMouseLeave();
                    leaved.push(w);
                }
            }
        }
        if(entered.length + leaved.length > 0) {
             //console.log(entered.length, leaved.length, entered[0]);
            if(entered.length > 0) {
                //if(entered[0]?.tooltip) {
                    // @todo possible bug
                    this.getRoot()._wm_setTooltipText(entered[0].tooltip);
                //}
                entered[0].onMouseEnter();
            } else {
                this.getRoot()._wm_setTooltipText(null);
            }
            //
            if(leaved.length > 0) {
                leaved[0].onMouseLeave();
            }
        }
        //
        /*for(let item of fire_mousemove) {
            item.w._mousemove(item.event);
        }*/
    }

    _mousedown(e) {
        //
        const visible_windows = [];
        for(let w of this.list.values()) {
            if(w.visible) {
                visible_windows.push(w);
            }
        }
        visible_windows.sort((a, b) => b.z - a.z)
        for(let window of visible_windows) {
            const e2 = {...e}
            const x = e2.x - (this.ax + window.x)
            const y = e2.y - (this.ay + window.y)
            if(x >= 0 && y >= 0 && x < window.w && y < window.h) {
                e2.x = window.ax + x
                e2.y = window.ay + y - window.scrollY
                // e2.x = x + this.x;
                // e2.y = y + this.y - w.scrollY;
                e2.target = window
                window._mousedown(e2)
                return
            }
        }
        this.onMouseDown(e)
    }

    _drop(e) {
        for(let w of this.list.values()) {
            if(w.visible) {
                let e2 = {...e};
                let x = e2.x - (this.ax + w.x);
                let y = e2.y - (this.ay + w.y);
                if(x >= 0 && y >= 0 && x < w.w && y < w.h) {
                    e2.x = w.ax + x;
                    e2.y = w.ay + y - w.scrollY;
                    // e2.x = x + this.x;
                    // e2.y = y + this.y - w.scrollY;
                    w._drop(e2);
                    return;
                }
            }
        }
        this.onDrop(e);
    }

    _wheel(e) {
        for(let w of this.list.values()) {
            if(w.visible) {
                let e2 = {...e};
                //e2.x -= (this.ax + w.x);
                //e2.y -= (this.ay + w.y);
                let x = e2.x - (this.ax + w.x);
                let y = e2.y - (this.ay + w.y);
                if(x >= 0 && y >= 0 && x < w.w && y < w.h)  {
                    e2.x = w.ax + x;
                    e2.y = w.ay + y - w.scrollY;
                    e2.target = w;
                    w._wheel(e2);
                    return;
                }
            }
        }
        this.onWheel(e);
    }

    measureMultilineText(ctx, text, lineHeightMultiply = 1.05, lineHeightAdd = 2) {
        const lines = text.split("\r");
        let width = 0;
        let actualBoundingBoxDescent = 0;
        for(const line of lines) {
            const mt = ctx.measureText(line);
            width = Math.max(width, mt.w);
            actualBoundingBoxDescent += mt.actualBoundingBoxDescent * lineHeightMultiply + lineHeightAdd;
        }
        return { width, actualBoundingBoxDescent };
    }

    calcPrintLines(original_text, ax, ay) {
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
        const lineHeight    = this.style.font.size * 1.05;
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
        for(let i in lines) {
            const line = lines[i];
            this.ctx.fillText(line, x, y + (lineHeight * i));
        }
    }

    loadCloseButtonImage(callback) {
        if(this._loadCloseButtonImage) {
            callback(this._loadCloseButtonImage);
        }
        // Load buttons background image
        let image = new Image();
        let that = this;
        image.onload = function() {
            this._loadCloseButtonImage = this;
            callback(this._loadCloseButtonImage);
        }
        image.src = '../../media/gui/close.png';
    }

    assignStyles(style) {
        for(let param in style) {
            let v = style[param];
            switch(param) {
                case 'padding': {
                    if(!isNaN(v)) {
                        v = {left: v, top: v, right: v, bottom: v};
                    }
                    this.style[param] = v;
                    break;
                }
                default: {
                    const options = {nonEnum: true, symbols: true, descriptors: true, proto: true};
                    deepAssign(options)(this.style[param], v);
                    break;
                }
            }
        }
    }

    appendLayout(layout) {
        let ignored_props = [
            'x', 'y', 'width', 'height', 'childs', 'style', 'type'
        ];
        for(let id in layout) {
            const cl = layout[id];
            let control = null;
            if(cl instanceof Window) {
                control = cl;
            } else {
                switch(cl.type) {
                    case 'VerticalLayout': {
                        control = new VerticalLayout(cl.x, cl.y, cl.width, id);
                        if(cl.childs) {
                            control.appendLayout(cl.childs);
                        }
                        break;
                    }
                    case 'Label': {
                        control = new Label(cl.x, cl.y, cl.width | 0, cl.height | 0, id, cl?.title, cl?.text);
                        break;
                    }
                    case 'Button': {
                        control = new Button(cl.x, cl.y, cl.width | 0, cl.height | 0, id, cl?.title, cl?.text);
                        break;
                    }
                }
            }
            if(control) {
                if(cl.style) {
                    control.assignStyles(cl.style);
                }
                // set other props
                for(let prop in cl) {
                    if(ignored_props.indexOf(prop) < 0) {
                        control[prop] = cl[prop];
                    }
                }
                this.add(control);
                if('refresh' in control) {
                    control.refresh();
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

    // fill background color
    fillBackground(ctx, ax, ay, color) {
        ctx.fillStyle = color
        let x = ax + this.x;
        let y = ay + this.y;
        let w = this.width;
        let h = this.height;
        ctx.fillRect(x, y, w, h);
    }

    onUpdate() {
        // It's called every interation of the game loop for visible windows. Override it in the subclasses.
    }

}

// Button
export class Button extends Window {

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);

        this.style.textAlign.horizontal = 'center';
        this.style.textAlign.vertical = 'middle';

        this.onMouseEnter = function() {
            this.style.background.color_save = this.style.background.color;
            this.style.color_save = this.style.color;
            //
            this.style.background.color = '#8892c9';
            this.style.color = '#ffffff';
        }

        this.onMouseLeave = function() {
            this.style.background.color = this.style.background.color_save;
            this.style.color = this.style.color_save;
            //
            this.style.background.color_save = null; 
            this.style.color_save = null; 
        }

        // Border
        this._border = new PIXI.Graphics()
        this.addChild(this._border)
        this._border.lineStyle(1, 0xffffff, 0.6) // .lineStyle(thickness, 0xffffff)
        // this._border.position.set(0, 0)
        this._border
            .moveTo(0, 0)
            .lineTo(this.w, 0)
            .lineTo(this.w, this.h)

        this._border.lineStyle(1, 0x000000, 0.6) // .lineStyle(thickness, 0xffffff)
        this._border.moveTo(this.w, this.h)
            .lineTo(0, this.h)
            .lineTo(0, 0)

    }

}

// Label
export class Label extends Window {

    /**
     * @param {int} x 
     * @param {int} y 
     * @param {?int} w 
     * @param {?int} h 
     * @param {string} id 
     * @param {?string} title 
     * @param {?string} text 
     */
    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text)
        this.style.background.color = '#00000000'
        this.style.border.hidden = true
        this.setText(text)
    }

}

// TextEdit
export class TextEdit extends Window {

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);

        this.max_length         = 0;
        this.max_lines          = 0;
        this.max_chars_per_line = 0;
        this.draw_cariage       = true;

        // Styles
        this.style.background.color = '#ffffff77';
        this.style.border.hidden = true;
        this.style.font.size = 19;
        this.style.font.family = 'UbuntuMono-Regular';
        this.style.padding = {
            left: 5,
            right: 5,
            top: 5,
            bottom: 5
        };

        // Properties
        this.focused = false;
        this.buffer = [];

        this.onChange = (text) => {
            // do nothing
        };

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

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ENTER: {
                    if(down) {
                        this.buffer.push(String.fromCharCode(13));
                        this._changed();
                    }
                    return true;
                }
                case KEY.BACKSPACE: {
                    if(down) {
                        this.backspace();
                        break;
                    }
                    return true;
                }
            }
        }

        // typeChar
        this.typeChar = (e, charCode, ch) => {
            if(!this.focused) {
                return;
            }
            if(charCode == 13) {
                return false;
            }
            if(this.buffer.length < this.max_length || this.max_length == 0) {
                if(this.max_lines > 0) {
                    const ot = this.buffer.join('') + ch;
                    const lines = this.calcPrintLines(ot);
                    if(lines.length > this.max_lines) {
                        return;
                    }
                }
                this.buffer.push(ch);
                this._changed();
            }
        }

    }

    //
    _changed() {
        this.onChange(this.buffer.join(''));
    }
    
    setEditText(text) {
        this.buffer = text.split('');
    }

    // Draw
    draw(ctx, ax, ay) {
        this.setText(this.buffer.join(''));
        //
        // this.style.background.color = this.focused ? '#ffffff77' : '#00000000';
        super.draw(ctx, ax, ay);
    }

    paste(str) {
        for(let i in str) {
            this.typeChar(null, str.charCodeAt(i), str[i]);
        }
    }

    getEditText() {
        return this.buffer.join('');
    }
}

class Tooltip extends Label {

    constructor(text) {
        super(0, 0, 100, 20, '_tooltip', null, text);
        this.style.background.color = '#000000cc';
        this.style.border.hidden = true;
        this.style.color = '#ffffff';
        this.style.font.size = 20 * this.zoom;
        this.style.font.family = 'Ubuntu';
        this.style.padding = {
            left: 16,
            right: 16,
            top: 12,
            bottom: 10
        };
        this.word_wrap = true;
        //
        this.need_update_size = false;
        this.setText(text);
    }

    draw(ctx, ax, ay) {
        if(this.text === null || typeof this.text === undefined || this.text === '') {
            return;
        }
        this.applyStyle(ctx, ax, ay);
        //
        if(this.need_update_size && this.autosize) {
            this.need_update_size = false
            /*
            TODO:
            // The line hegit is imprecise here, TODO: make calculations the same as when drawing
            let mt = this.measureMultilineText(ctx, this.text, 1.07, 2);
            this.width = mt.width + this.style.padding.left + this.style.padding.right;
            this.height = mt.actualBoundingBoxDescent + this.style.padding.top + this.style.padding.bottom;
            */
        }
        super.draw(ctx, ax, ay);
    }

    setText(text) {
        this.text = text;
        this.need_update_size = true;
    }

}

// WindowManager
export class WindowManager extends Window {
    
    static draw_calls = 0

    constructor(canvas, x, y, w, h) {

        super(x, y, w, h, '_wm', null)
        globalThis.wmGlobal = this

        this.pixiapp = new PIXI.Application({
            view: canvas,
            background: '#1099bb',
            transparent: true
        })

        this.parent = this.pixiapp.stage

        this.parent.addChild(this)

        const ctx = null

        let that = this;
        this.root = this;
        this.canvas = null
        this.ctx = null
        this.visible_change_count = 0;
        this._wm_tooltip = new Tooltip(null);

        //
        this.pointer = {
            x: w / 2,
            y: h / 2,
            image: null,
            parent: that,
            visible: true,
            load: function() {
                /*
                let image = new Image();
                let that = this;
                image.onload = function() {
                    that.image = image;
                };
                image.src = '../media/pointer.png';
                */
            },
            draw: function() {
                that.drag.draw({
                    ctx: this.parent.ctx,
                    x: this.x - 18 * UI_ZOOM,
                    y: this.y - 18 * UI_ZOOM
                });
                if(this.image && this.visible) {
                    ctx.imageSmoothingEnabled = true;
                    this.parent.ctx.drawImage(
                        this.image,
                        0,
                        0,
                        this.image.width,
                        this.image.height,
                        this.x,
                        this.y,
                        this.image.width / 2,
                        this.image.width / 2
                    );
                }
            }
        }

        this.pointer.load()

        this.drag = {
            item: null,
            setItem: function(item) {
                this.item = item
            },
            getItem: function() {
                return this.item;
            },
            clear: function() {
                this.setItem(null);
            },
            draw: function(e) {
                if(this.item) {
                    if(typeof this.item.draw === 'function') {
                        this.item.draw(e, true);
                    }
                }
            }
        }

    }

    closeAll() {
        for(let w of this.visibleWindows) {
            w.hide();
        }
    }

    draw(drawPointer) {
        this.applyStyle(this.ctx, this.x, this.y);
        super.draw(this.ctx, this.x, this.y);
        if(drawPointer && drawPointer === true) {
            this.pointer.draw();
        }
        if(this.hasVisibleWindow()) {
            this._wm_tooltip.draw(this.ctx, this.x, this.y);
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
                this.pointer.x = e.offsetX
                this.pointer.y = e.offsetY
                // Calculate tooltip position
                let pos = {x: this.pointer.x, y: this.pointer.y};
                if(pos.x + this._wm_tooltip.width > this.width) {
                    pos.x -= this._wm_tooltip.width
                }
                if(pos.y + this._wm_tooltip.height > this.height) {
                    pos.y -= this._wm_tooltip.height
                }
                this._wm_tooltip.move(pos.x, pos.y)
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
                if(this.drag.getItem()) {
                    this._drop(evt)
                } else {
                    this._mousedown(evt)
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
                    e.type = 'mousemove'
                    this.mouseEventDispatcher(e)
                }
                break;
            }
            default: {
                break
            }
        }
    }

    _wm_setTooltipText(text) {
        this._wm_tooltip.setText(text);
    }

    // calls Window.onUpdate() for each visible window
    updateVisibleWindows() {
        for(let w of this.visibleWindows()) {
            w.onUpdate();
        }
    }
}

export class VerticalLayout extends Window {

    constructor(x, y, w, id) {
        super(x, y, w, 0, id, null, null);
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        this.gap = 0;
    }

    refresh() {
        let y = 0;
        for(let w of this.list.values()) {
            if(!w.visible) continue;
            w.x = 0;
            w.y = y;
            w.updateMeasure(this.getRoot().ctx);
            if(w.autosize) {
                w.width = this.width;
                if(w.__measure.text?.height && w.autosize) {
                    w.height = w.__measure.text?.height + (w.style.padding.top + w.style.padding.bottom);
                }
            }
            y += w.height + this.gap;
        }
        this.calcMaxHeight();
        this.height = this.max_height;
    }

}

// ToggleButton
export class ToggleButton extends Button {

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        this.toggled = false;
        this.style.textAlign.horizontal = 'left';
        this.style.padding.left = 10;
        //
        this.onMouseEnter = function() {
            this.style.background.color = '#8892c9';
            this.style.color = '#ffffff';
        }
        //
        this.onMouseLeave = function() {
            this.style.background.color = this.toggled ? '#7882b9' : '#00000000';
            this.style.color = this.toggled ? '#ffffff' : '#3f3f3f';
        }
    }

    //
    toggle() {
        if(this.parent.__toggledButton) {
            this.parent.__toggledButton.toggled = false;
            this.parent.__toggledButton.onMouseLeave();
        }
        this.toggled = !this.toggled;
        this.parent.__toggledButton = this;
        this.style.background.color = this.toggled ? '#8892c9' : '#00000000';
        this.style.color = this.toggled ? '#ffffff' : '#3f3f3f';
    }

}