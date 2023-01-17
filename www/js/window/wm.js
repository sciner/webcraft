import { Resources } from "../resources.js";
import { Window } from "../../tools/gui/wm.js";

// Base window
export class Component extends Window {

    #_visible = true;
    #_tooltip = null;

    zoom = UI_ZOOM;
    
    constructor(x, y, w, h, id, title, parent) {
        super(x, y, w, h, id, null, null);
        this.list           = new Map();
        this.x              = x * this.zoom;
        this.y              = y * this.zoom;
        this.z              = 0;
        this.width          = w * this.zoom;
        this.height         = h * this.zoom;
        this.id             = id;
        this.parent         = parent;
        this.onHide         = function() {};
        this.onShow         = function() {};
        this.text = {
            textAlign: {
                horizontal: 'center',
                vertical: 'middle'
            },
            color: '#FFFFFFFF',
            text: title
        };
        this.border = {
            color: '#FFFFFFFF',
            width: 4,
            show: false
        }
        this.background = {
            sprite: null,
            color: '#00000000'
        },
        this.icon = {
            sprite: null,
            padding: 0
        }
        this.atlas = null;
        if (!parent) {
            this.atlas = new Image();
            const self = this;
            this.atlas.onload = function(e) {
                self.redraw();
            }
            this.atlas.src = './media/icons.png';
        };
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
        
        const atlas = this.parent ? this.parent.atlas : this.atlas;
        const icons = Resources.icons;
        if (this.background.sprite) {
            const frame = icons[this.background.sprite].frame;
            this.ctx.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
        }
        if (this.icon.sprite) {
            const frame = icons[this.icon.sprite].frame;
            const padding = this.icon.padding * this.zoom;
            this.ctx.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, x + padding / 2, y + padding / 2, w - padding, h - padding);
        }
        if (this.text.text) {
            ctx.fillStyle = this.text.color;
            const pos = {
                x: x + (this.text.textAlign.horizontal == 'center' ? w / 2 : (this.text.textAlign.horizontal == 'right' ? this.width : 0)),
                y: y + (this.text.textAlign.vertical == 'middle' ? h / 2 : (this.text.textAlign.vertical == 'bottom' ? this.height : 0))
            };
            ctx.textAlign = this.text.textAlign.horizontal;
            ctx.textBaseline = this.text.textAlign.vertical;
            ctx.fillText(this.text.text, pos.x, pos.y);
        }
        // draw border
        if(this.border.show) {
            ctx.strokeStyle = this.border.color;
            ctx.lineWidth = this.border.width;
            ctx.beginPath();
            ctx.lineJoin = 'round';
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        // Restore the default state
        ctx.restore();
        const visible_windows = [];
        for(const w of this.list.values()) {
            if(w.visible) {
                visible_windows.push(w);
            }
        }
        visible_windows.sort((a, b) => b.z - a.z);
        for(const w of visible_windows) {
            w.draw(ctx, ax + this.x, ay + this.y);
        }
    }
    
    setBackground(val) {
        this.background.sprite = val; 
    }
    
    setBackgroundColor(color = '00000000') {
        this.background.color = color; 
    }
    
    setIcon(val, padding = 0) {
        this.icon.padding = padding; 
        this.icon.sprite = val; 
    }
    
    setText(val) {
        this.text.text = val;
    }
    
    showBorder(val) {
        this.border.show = val;
    }
}