/**
* Window Manager based ON 2D canvas 
*/

import {RuneStrings, deepAssign} from "../../js/helpers.js";

export const BLINK_PERIOD = 500; // период моргания курсора ввода текста (мс)

// Base window
export class Component {

    zoom = UI_ZOOM;

    constructor(x, y, w, h, id, text, parent) {
        this.list           = new Map();
        this.x              = x * this.zoom;
        this.y              = y * this.zoom;
        this.width          = w * this.zoom;
        this.height         = h * this.zoom;
        this.id             = id;
        this.text           = text || null;
        this.parent         = parent;
        this.onHide         = function() {};
        this.onShow         = function() {};
        this.background = {
            sprite: null,
            color: '#ffffff44'
        }
        
        this.atlas = null;
        if (!parent) {
            this.atlas = new Image();
            const self = this;
            this.atlas.onload = function(e) {
                self.redraw();
            }
            this.atlas.src = './media/icons.png';
        }
    }
    add(w) {
        if(!w.id) {
            throw 'Control does not have valid ID';
        }
        w.parent = this;
        this.list.set(w.id, w);
    }
    redraw() {
        if(!this.ctx) {
            return;
        }
        this.draw(this.ctx, this.ax, this.ay);
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
        for(const w of this.list.values()) {
            w.hover = false;
        }
    }
    draw(ctx, ax, ay) {
        if(!this.visible) {
            return;
        }
        this.ctx = ctx;
        this.ax = ax;
        this.ay = ay;
        
        const x = ax + this.x;
        const y = ay + this.y;
        const w = this.width;
        const h = this.height;

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
        ctx.fillStyle = this.background.color;
        ctx.fillRect(x, y, w, h);
        // Restore the default state
        ctx.restore();
    }
}