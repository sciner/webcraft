/**
* Window Manager based ON 2D canvas 
*/

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
        this.hover          = false;
        this.catchEvents    = true;
        this.parent         = null;
        this.scrollX        = 0;
        this.scrollY        = 0;
        this.onHide         = function() {};
        this.onShow         = function() {};
        this.onMouseEnter   = function() {};
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
        this.style          = {
            color: '#3f3f3f',
            textAlign: {
                horizonal: 'left',
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

        // let region = new Path2D();
        // region.rect(x, y, w, h);

        // Save the default state
        ctx.save();
        // ctx.clip(region, 'evenodd');

        // this.applyStyle(ctx, ax, ay);
        // fill background color
        ctx.fillStyle = this.style.background.color;
        ctx.fillRect(x, y, w, h);
        // draw image
        if(this.style.background.image) {
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
            }

        }
        if(this.title || this.text) {
            this.applyStyle(ctx, ax, ay);
        }
        // Draw title
        if(this.title) {
            ctx.fillStyle = this.style.color;
            if(this.style.font.shadow) {
                ctx.save();
                ctx.shadowOffsetX = this.style.font.shadow.x;
                ctx.shadowOffsetY = this.style.font.shadow.y;
                ctx.shadowBlur = this.style.font.shadow.blur;
                ctx.shadowColor = this.style.font.shadow.color;
                ctx.fillText(this.title, x + w / 2 + 1, y + h / 2 + 1);
                ctx.restore();
            }
            ctx.fillText(this.title, x + w / 2 + 1, y + h / 2 + 1);
        }
        // print text
        if(this.text) {
            this.print(this.text);
        }
        // draw border
        if(!this.style.border.hidden) {
            ctx.beginPath(); // Start a new path
            ctx.fillStyle = 'this.style.border.color';
            ctx.moveTo(x + 2, y);
            ctx.lineTo(x + w - 2, y);
            ctx.lineTo(x + w, y + 2);
            ctx.lineTo(x + w, y + h - 2);
            ctx.lineTo(x + w - 2, y + h);
            ctx.lineTo(x + 2, y + h);
            ctx.lineTo(x, y + h - 2);
            ctx.lineTo(x, y + 2);
            ctx.lineTo(x + 2, y);
            ctx.stroke(); // Render the path
        }
        // Restore the default state
        ctx.restore();
        for(let w of this.list.values()) {
            if(w.visible) {
                w.draw(ctx, ax+this.x, ay+this.y);
            }
        }
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
        ctx.textAlign       = 'left';
        ctx.textBaseline    = 'top';
        ctx.fillStyle       = this.style.color;
        ctx.textAlign       = this.style.textAlign.horizontal;
        ctx.textBaseline    = this.style.textAlign.vertical;
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
    show() {
        this.visible = true;
        this.resetHover();
        this.onShow();
    }
    hide() {
        this.visible = false;
        this.resetHover();
        this.onHide();
        if(typeof Game !== 'undefined' && Game.hud) {
            Game.hud.prevDrawTime = 0;
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
                let x = e2.x - (this.ax + w.x);
                let y = e2.y - (this.ay + w.y);
                if(x >= 0 && y >= 0 && x < w.width && y < w.height) {
                    e2.x = x + this.x;
                    e2.y = y + this.y - w.scrollY;
                    w._mousemove(e2);
                    // fire_mousemove.push({w: w, event: e2});
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
                if(entered[0]?.tooltip) {
                    this.getRoot()._wm_setTooltipText(entered[0].tooltip);
                }
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
    print(text) {
        if(!this.ctx) {
            console.error('Empty context');
            return;
        }
        if(!text) {
            return;
        }
        const x             = this.x + this.ax + this.style.padding.left;
        const y             = this.y + this.ay + this.style.padding.top;
        const lineHeight    = 20;
        let currentLine     = 0;
        let words           = (text + '').split(' ');
        let idx             = 1;
        while(words.length > 0 && idx <= words.length) {
            let str = words.slice(0, idx).join(' ');
            let w = this.ctx.measureText(str).width;
            if(w > this.width) {
                if(idx == 1) {
                    idx = 2;
                }
                this.ctx.fillText(words.slice(0, idx - 1).join(' '), x, y + (lineHeight * currentLine));
                currentLine++;
                words = words.splice(idx - 1);
                idx = 1;
            } else {
                idx++;
            }
        }
        if(idx > 0) {
            this.ctx.fillText(words.join(' '), x, y + (lineHeight * currentLine));
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
}

// Button
export class Button extends Window {

    constructor(x, y, w, h, id, title, text) {
        super(x, y, w, h, id, title, text);
        this.style.textAlign.horizontal = 'center';
        this.style.textAlign.vertical = 'middle';
        this.onMouseEnter = function() {
            this.style.background.color = '#8892c9';
            this.style.color = '#ffffff';
        }
        this.onMouseLeave = function() {
            this.style.background.color = '#00000000';
            this.style.color = '#3f3f3f';
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

class Tooltip extends Label {

    constructor(text) {
        super(0, 0, 100, 20, '_tooltip', null, text);
        this.style.background.color = '#000000cc';
        this.style.border.hidden = true;
        this.style.color = '#ffffff';
        this.style.font.size = 20;
        this.style.font.family = 'Ubuntu';
        this.style.padding = {
            left: 5,
            right: 5,
            top: 5,
            bottom: 5
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
                    x: this.x,
                    y: this.y
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
                        this.item.draw(e);
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