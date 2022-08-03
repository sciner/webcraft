/**
* Window Manager based ON 2D canvas 
*/

import {RuneStrings, deepAssign} from "../../js/helpers.js";

export const BLINK_PERIOD = 500; // период моргания курсора ввода текста (мс)

// Base window
export class Window {

    #_visible = true;
    #_tooltip = null;

    zoom = UI_ZOOM;

    constructor(x, y, w, h, id, title, text) {
        this.list           = new Map();
        this.index          = 0;
        this.x              = x;
        this.y              = y;
        this.z              = 0; // z-index
        this.width          = w;
        this.height         = h;
        this.title          = title;
        this.id             = id;
        this.text           = text || null;
        this.word_wrap      = false;
        this.hover          = false;
        this.catchEvents    = true;
        this.parent         = null;
        this.scrollX        = 0;
        this.scrollY        = 0;
        this.max_chars_per_line = 0;
        this.onHide         = function() {};
        this.onShow         = function() {};
        this.onMouseEnter   = function() {};
        this.create_time    = performance.now();
        this.onMouseLeave   = () => {
            for(let w of this.list.values()) {
                if(w.hover) {
                    w.hover = false;
                    w.onMouseLeave();
                }
            }
        };
        this.onMouseDown    = function() {};
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
        };
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
        };
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
            border: {
                color: '#3f3f3f',
                width: 4,
                hidden: false
            }
        };
    }
    //
    get visible() {return this.#_visible}
    set visible(value) {this.#_visible = value; globalThis.wmGlobal.visible_change_count++;}
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
    add(w) {
        if(!w.id) {
            throw 'Control does not have valid ID';
        }
        w.parent = this;
        w.root = this.root;
        this.list.set(w.id, w);
    }
    delete(id) {
        if(this.list.has(id)) {
            this.list.delete(id);
        }
    }
    getWindow(id) {
        if(!this.list.has(id)) {
            throw 'Window not found by ID ' + id;
        }
        return this.list.get(id);
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
        w.move(this.width / 2 - w.width / 2, this.height / 2 - w.height / 2);
        // this.redraw();
    }
    // Place all childs to center of this window
    centerChild() {
        let width_sum = 0;
        let height_sum = 0;
        let visible_windows = [];
        for(let w of this.list.values()) {
            if(w.visible) {
                width_sum += w.width;
                height_sum += w.height;
                visible_windows.push(w);
            }
        }
        //
        visible_windows.sort((a, b) => a.index - b.index);
        //
        if(width_sum < this.width) {
            // hor
            let x = Math.round(this.width / 2 - width_sum / 2);
            for(let w of visible_windows) {
                w.x = x;
                w.y = this.height / 2 - w.height / 2;
                x += w.width;
            }
        } else {
            // vert
            let y = Math.round(this.height / 2 - height_sum / 2);;
            for(let w of visible_windows) {
                w.y = y;
                w.x = this.width / 2 - w.width / 2;
                y += w.height;
            }
        }
    }
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    draw(ctx, ax, ay) {
        this.ctx = ctx;
        this.ax = ax;
        this.ay = ay;
        if(!this.visible) {
            return;
        }
        WindowManager.draw_calls++;

        let x = ax + this.x;
        let y = ay + this.y;
        let w = this.width;
        let h = this.height;

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

        // draw image
        if(this.style.background.image && (typeof this.style.background.image == 'object')) {
            const iw = this.style.background.image.width;
            const ih = this.style.background.image.height;
            // image_size_mode
            // img, sx, sy, swidth, sheight, x, y, width, height
            switch(this.style.background.image_size_mode) {
                case 'none': {
                    ctx.drawImage(this.style.background.image, x + w / 2 - iw / 2, y + h / 2 - ih / 2, iw, ih);
                    break;
                }
                case 'stretch': {
                    ctx.drawImage(this.style.background.image, 0, 0, iw, ih, x, y, w, h);
                    break;
                }
                case 'sprite': {
                    const opts = this.style.background.sprite;
                    if(opts.mode = 'stretch') {
                        ctx.drawImage(this.style.background.image, opts.x, opts.y, opts.width, opts.height, x, y, w, h);
                    }
                    break;
                }
            }

        }
        //if(this.title || this.text) {
        this.applyStyle(ctx, ax, ay);
        this.updateMeasure(ctx);
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

            ctx.lineJoin = 'round';
            ctx.lineWidth = this.style.border.width;
            ctx.beginPath(); // Start a new path

            ctx.strokeStyle = '#ffffff';
            ctx.moveTo(x, y + h);
            ctx.lineTo(x, y );
            ctx.lineTo(x + w, y);
            ctx.stroke();

            ctx.beginPath(); // Start a new path
            ctx.strokeStyle = this.style.border.color;
            ctx.moveTo(x + w, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.stroke();

            ctx.stroke(); // Render the path
        }
        // Restore the default state
        ctx.restore();
        for(let w of this.list.values()) {
            if(w.visible) {
                w.draw(ctx, ax+this.x, ay+this.y+this.scrollY);
            }
        }
    }
    updateMeasure(ctx) {
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
            this.applyStyle(ctx, 0, 0);
            let mt = ctx.measureText(this.text);
            mtxt.value = this.text;
            //
            if(this.word_wrap) {
                const lineHeight = this.style.font.size * 1.05;
                const lines = this.calcPrintLines(this.text || '');
                mtxt.height = lines.length * lineHeight;
            } else {
                mtxt.width = mt.width;
                mtxt.height = mt.actualBoundingBoxDescent;
            }
        }
    }
    calcMaxHeight() {
        let mh = 0;
        for(let w of this.list.values()) {
            if(w.y + w.height > mh) {
                mh = w.y + w.height;
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
    getVisibleWindows() {
        let list = [];
        for(let w of this.list.values()) {
            if(w.visible) {
                list.push(w);
            }
        }
        return list;
    }
    redraw() {
        if(!this.ctx) {
            return;
        }
        this.draw(this.ctx, this.ax, this.ay);
    }
    setText(text) {
        this.text = text;
    }
    applyStyle(ctx, ax, ay) {
        this.ctx            = ctx;
        this.ax             = ax;
        this.ay             = ay;
        ctx.font            = this.style.font.size + 'px ' + this.style.font.family;
        ctx.fillStyle       = this.style.color;
        ctx.textAlign       = this.style.textAlign.horizontal || 'left';
        ctx.textBaseline    = this.style.textAlign.vertical || 'top';
    }
    setBackground(url, image_size_mode) {
        let that = this;
        let bg = new Image();
        bg.onload = function(e) {
            that.style.background.image = bg;
            that.style.background.image_size_mode = image_size_mode ? image_size_mode : that.style.background.image_size_mode;
            that.redraw();
        }
        bg.src = url;
    }
    show(args) {
        this.visible = true;
        this.resetHover();
        this.onShow(args);
    }
    hide() {
        this.visible = false;
        this.resetHover();
        this.onHide();
        if(typeof Qubatch !== 'undefined' && Qubatch.hud) {
            Qubatch.hud.prevDrawTime = 0;
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
            return this.hide();
        }
        return this.show();
    }
    _mousemove(e) {
        this.hover = true;
        this.onMouseMove(e);
        let entered = [];
        let leaved = [];
        // let fire_mousemove = [];
        for(let w of this.list.values()) {
            if(!w.catchEvents) {
                continue;
            }
            let old_hover = w.hover;
            w.hover = false;
            if(w.visible) {
                let e2 = {...e};
                let x = e2.x - w.x;
                let y = e2.y - w.y;
                if(x >= 0 && y >= 0 && x <= w.width && y <= w.height) {
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
            // console.log(entered.length, leaved.length, entered[0]);
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
        for(let w of this.list.values()) {
            if(w.visible) {
                let e2 = {...e};
                let x = e2.x - (this.ax + w.x);
                let y = e2.y - (this.ay + w.y);
                if(x >= 0 && y >= 0 && x < w.width && y < w.height) {
                    e2.x = x + this.x;
                    e2.y = y + this.y - w.scrollY;
                    e2.target = w;
                    w._mousedown(e2);
                    return;
                }
            }
        }
        this.onMouseDown(e);
    }
    _drop(e) {
        for(let w of this.list.values()) {
            if(w.visible) {
                let e2 = {...e};
                let x = e2.x - (this.ax + w.x);
                let y = e2.y - (this.ay + w.y);
                if(x >= 0 && y >= 0 && x < w.width && y < w.height) {
                    e2.x = x + this.x;
                    e2.y = y + this.y - w.scrollY;
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
                e2.x -= (this.ax + w.x);
                e2.y -= (this.ay + w.y);
                if(e2.x >= 0 && e2.y >= 0 && e2.x < w.width && e2.y < w.height)  {
                    e2.target = w;
                    w._wheel(e2);
                    return;
                }
            }
        }
        this.onWheel(e);
    }
    calcPrintLines(original_text) {
        if(!this.word_wrap || !this.ctx) {
            return [original_text];
        }
        let currentLine = 0;
        const lines = [''];
        //
        this.applyStyle(this.ctx, 0, 0);
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
                    if(w > this.width - this.style.padding.left - this.style.padding.right) {
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
            const line = lines[i].trim();
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
            }
            if(control) {
                if(cl.style) {
                    control.assignStyles(cl.style);
                }
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
    }

}

// Label
export class Label extends Window {

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
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

        // Backspace pressed
        this.backspace = () => {
            if(!this.focused) {
                return;
            }
            if(this.buffer.length > 0) {
                this.buffer.pop();
            }
        }

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ENTER: {
                    if(down) {
                        this.buffer.push(String.fromCharCode(13));
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
            }
        }

    }

    // Draw
    draw(ctx, ax, ay) {
        this.text = this.buffer.join('');
        //
        this.style.background.color = this.focused ? '#ffffff77' : '#00000000';
        super.draw(ctx, ax, ay);
    }

}

class Tooltip extends Label {

    constructor(text) {
        super(0, 0, 100, 20, '_tooltip', null, text);
        this.style.background.color = '#000000cc';
        this.style.border.hidden = true;
        this.style.color = '#ffffff';
        this.style.font.size = 20;
        this.style.font.family = 'Ubuntu';
        this.style.padding = {
            left: 16,
            right: 16,
            top: 12,
            bottom: 10
        };
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
        if(this.need_update_size) {
            this.need_update_size = false;
            let mt = ctx.measureText(this.text);
            this.width = mt.width + this.style.padding.left + this.style.padding.right;
            this.height = mt.actualBoundingBoxDescent + this.style.padding.top + this.style.padding.bottom + 2;
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
    
    static draw_calls = 0;
    
    constructor(canvas, ctx, x, y, w, h) {
        super(x, y, w, h, '_wm', null);
        globalThis.wmGlobal = this;
        let that = this;
        this.root = this;
        this.list = new Map();
        this.canvas = canvas;
        this.ctx = ctx;
        this.visible_change_count = 0;
        //
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
        };
        this.pointer.load();
        this.drag = {
            item: null,
            setItem: function(item) {
                this.item = item;
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
        };
    }

    closeAll() {
        let list = this.getVisibleWindows();
        for(let w of list) {
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
                let evt = {
                    shiftKey:   e.shiftKey,
                    button:     e.button,
                    x:          e.offsetX - this.x,
                    y:          e.offsetY - this.y
                };
                this.pointer.x = e.offsetX;
                this.pointer.y = e.offsetY;
                // Calculate tooltip position
                let pos = {x: this.pointer.x, y: this.pointer.y};
                if(pos.x + this._wm_tooltip.width > this.width) {
                    pos.x -= this._wm_tooltip.width;
                }
                if(pos.y + this._wm_tooltip.height > this.height) {
                    pos.y -= this._wm_tooltip.height;
                }
                this._wm_tooltip.move(pos.x, pos.y);
                this._mousemove(evt);
                break;
            }
            case 'mousedown': {
                let evt = {
                    shiftKey:   e.shiftKey,
                    button:     e.button,
                    drag:       this.drag,
                    x:          e.offsetX - this.x,
                    y:          e.offsetY - this.y
                };
                if(this.drag.getItem()) {
                    this._drop(evt);
                } else {
                    this._mousedown(evt);
                }
                break;
            }
            case 'wheel': {
                if(!this.drag.getItem()) {
                    let evt = {
                        shiftKey:       e.shiftKey,
                        button:         e.button,
                        original_event: e.original_event,
                        x:              e.offsetX - this.x,
                        y:              e.offsetY - this.y
                    };
                    this._wheel(evt);
                    // Хак, чтобы обновились ховер элементы
                    e.type = 'mousemove';
                    this.mouseEventDispatcher(e);
                }
                break;
            }
            default: {
                break;
            }
        }
    }

    _wm_setTooltipText(text) {
        this._wm_tooltip.setText(text);
    }

}

export class VerticalLayout extends Window {

    constructor(x, y, w, id) {
        super(x, y, w, 0, id, null, null);
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
    }

    refresh() {
        let y = 0;
        for(let w of this.list.values()) {
            w.x = 0;
            w.y = y;
            w.width = this.width;
            w.updateMeasure(this.getRoot().ctx);
            if(w.__measure.text?.height) {
                w.height = w.__measure.text?.height + (w.style.padding.top + w.style.padding.bottom);
            }
            y += w.height;
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