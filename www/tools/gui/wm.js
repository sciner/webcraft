/**
* Window Manager based ON 2D canvas 
*/

// Base window
export class Window {
    constructor(x, y, w, h, id, title, text) {
        this.list           = {};
        this.visible        = true;
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
        this.onHide         = function() {};
        this.onShow         = function() {};
        this.onDrop         = function(e) {};
        this.onMouseMove    = function(e) {};
        this.onMouseEnter   = function() {};
        this.onMouseLeave   = function() {};
        this.onMouseDown    = function() {};
        this.style          = {
            color: '#3f3f3f',
            textAlign: {
                horizonal: 'left',
                vertical: 'top' // "top" || "hanging" || "middle" || "alphabetic" || "ideographic" || "bottom";
            },
            font: {
                size: 16,
                family: 'Minecraftia',
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
    add(w) {
        if(!w.id) {
            throw 'Control does not have valid ID';
        }
        w.parent = this;
        this.list[w.id] = w;
    }
    getWindow(id) {
        if(!this.list.hasOwnProperty(id)) {
            throw 'Window not found by ID ' + id;
        }
        return this.list[id];
    }
    move(x, y) {
        this.x = x;
        this.y = y;
    }
    resize(w, h) {
        this.width = w;
        this.height = h;
    }
    center(w) {
        w.move(this.width / 2 - w.width / 2, this.height / 2 - w.height / 2);
        // this.redraw();
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
            ctx.fillStyle = this.style.border.color;
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
        for(let id of Object.keys(this.list)) {
            let w = this.list[id];
            if(w.visible) {
                w.draw(ctx, this.x, this.y);
            }
        }
    }
    getVisibleWindows() {
        let list = [];
        for(let id of Object.keys(this.list)) {
            let w = this.list[id];
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
    getRoot() {
        if(this.parent) {
            return this.parent.getRoot();
        }
        return this;
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
            that.style.background.image_size_mode = image_size_mode ? image_size_mode : 'none';
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
        if(Game.hud) {
            Game.hud.prevDrawTime = 0;
        }
    }
    resetHover() {
        this.hover = false;
        for(let id of Object.keys(this.list)) {
            let w = this.list[id];
            w.hover = false;
        }
    }
    toggleVisibility() {
        if(this.visible) {
            return this.hide();
        }
        return this.show();
    }
    mousemove(e) {
        this.hover = true;
        this.onMouseMove(e);
        for(let id of Object.keys(this.list)) {
            let w = this.list[id];
            if(!w.catchEvents) {
                continue;
            }
            let old_hover = w.hover;
            w.hover = false;
            if(w.visible) {
                let e2 = {...e};
                e2.x -= (this.ax + w.x);
                e2.y -= (this.ay + w.y);
                if(e2.x >= 0 && e2.y >= 0 && e2.x < w.width && e2.y < w.height)  {
                    w.mousemove(e2);
                    w.hover = true;
                }
            }
            if(w.hover != old_hover) {
                if(w.hover) {
                    w.onMouseEnter();
                } else {
                    w.onMouseLeave();
                }
            }
        }
    }
    _mousedown(e) {
        for(let id of Object.keys(this.list)) {
            let w = this.list[id];
            if(w.visible) {
                let e2 = {...e};
                e2.x -= (this.ax + w.x);
                e2.y -= (this.ay + w.y);
                if(e2.x >= 0 && e2.y >= 0 && e2.x < w.width && e2.y < w.height)  {
                    w._mousedown(e2);
                    return;
                }
            }
        }
        this.onMouseDown(e);
    }
    _drop(e) {
        for(let id of Object.keys(this.list)) {
            let w = this.list[id];
            if(w.visible) {
                let e2 = {...e};
                e2.x -= (this.ax + w.x);
                e2.y -= (this.ay + w.y);
                if(e2.x >= 0 && e2.y >= 0 && e2.x < w.width && e2.y < w.height)  {
                    w._drop(e2);
                    return;
                }
            }
        }
        this.onDrop(e);
    }
    print(text) {
        if(!this.ctx) {
            console.error('Empty context');
            return;
        }
        if(!text) {
            return;
        }
        const x             = this.x + this.ax;
        const y             = this.y + this.ay;
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

// WindowManager
export class WindowManager extends Window {
    
    static draw_calls = 0;
    
    constructor(canvas, ctx, x, y, w, h) {
        super(x, y, w, h, '_wm', null);
        let that = this;
        this.list = [];
        this.canvas = canvas;
        this.ctx = ctx;
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
                this.mousemove(evt);
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
        }
    }

}