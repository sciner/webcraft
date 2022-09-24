import {Vector} from "./helpers.js";

const MAX_NAME_SHOW_TIME = 2000;

//
const LIVE_SHIFT_RANDOM = new Array(1024);
for(let i = 0; i < LIVE_SHIFT_RANDOM.length; i++) {
    LIVE_SHIFT_RANDOM[i] = Math.round(Math.random());
}

//
class Strings {

    constructor() {
        this.strings = [
            {text: null, set_time: null, measure: null, max_time: null},
            {text: null, set_time: null, measure: null, max_time: null}
        ];
    }
    
    // set new text
    setText(index, text, max_time) {
        this.strings[index].text = text;
        if(text) {
            this.strings[index].set_time = performance.now();
            this.strings[index].measure = null;
            this.strings[index].max_time = max_time;
        }
    }

    // set text if not same with previous
    updateText(index, text, max_time) {
        if(this.strings[index].text == text) {
            return false;
        }
        this.setText(index, text, max_time);
    }

    // draw
    draw(hud, y_margin, zoom, hud_pos, cell_size) {

        let draw_count = 0;
        const ctx = hud.ctx;

        for(let i = 0; i < this.strings.length; i++) {
            const item = this.strings[i];
            if(!item.text) {
                continue;
            }
            const time_remains = performance.now() - item.set_time;
            const max_time = item.max_time || MAX_NAME_SHOW_TIME;
            if(time_remains > max_time) {
                continue;
            }
            //
            y_margin += (i * cell_size / 2);
            // Text opacity
            const alpha = Math.min(2 - (time_remains / max_time) * 2, 1);
            let aa = Math.ceil(255 * alpha).toString(16);
            if(aa.length == 1) {
                aa = '0' + aa;
            }
            //
            ctx.textBaseline = 'bottom';
            ctx.font = Math.round(24 * zoom) + 'px ' + UI_FONT;
            // Measure text
            if(!item.measure) {
                item.measure = ctx.measureText(item.text);
            }
            ctx.fillStyle = '#000000' + aa;
            ctx.fillText(item.text, hud.width / 2 - item.measure.width / 2, hud_pos.y + cell_size - y_margin);
            ctx.fillStyle = '#ffffff' + aa;
            ctx.fillText(item.text, hud.width / 2 - item.measure.width / 2, hud_pos.y + cell_size - y_margin - 2 * zoom);
            //
            draw_count++;

        }

        return draw_count > 0;

    }

}

export class Hotbar {

    constructor(hud) {
        let that                = this;
        this.hud                = hud;
        this.image              = new Image(); // new Image(40, 40); // Размер изображения
        
        //
        this.image.onload = function() {
            that.hud.add(that, 0);
        }
        this.image.src = './media/hotbar.png';
        this.last_damage_time = null;
        //
        this.strings = new Strings();
        
        this.inventory_image = new Image();
        this.inventory_image.src = './media/gui/inventory2.png';
    }

    get zoom() {
        return UI_ZOOM;
    }

    //
    setInventory(inventory) {
        this.inventory = inventory;
    }

    //
    damage(damage_value, reason_text) {
        this.last_damage_time = performance.now();
        console.error('error_not_implemented', damage_value, reason_text);
        this.inventory.player.world.server.ModifyIndicator('live', -damage_value, reason_text);
    }

    setState(new_state) {
        for(const [key, value] of Object.entries(new_state)) {
            this[key] = value;
        }
    }

    drawHUD(hud) {

        const player = this.inventory.player;
        if(player.game_mode.isSpectator()) {
            return false;
        }

        // Source image sizes
        const sw                = 1092; // this.image.width;
        const sh                = 294; // this.image.height;
        const slive_bar_height  = 162;
        const selector          = {x: 162, y: 300, width: 144, height: 138};
        const src = {
            icons: {
                live: {x: 0, y: 300, width: 54, height: 54},
                live_half: {x: 0, y: 354, width: 54, height: 54},
                food: {x: 54, y: 300, width: 54, height: 54},
                food_half: {x: 54, y: 354, width: 54, height: 54},
                oxygen: {x: 108, y: 300, width: 54, height: 54},
                oxygen_half: {x: 108, y: 354, width: 54, height: 54}
            }
        };

        // Target sizes
        const dst = {
            w: 546 * this.zoom,
            h: 147 * this.zoom,
            live_bar_height: 81 * this.zoom,
            selector: {
                width: 72 * this.zoom,
                height: 69 * this.zoom
            }
        };
        const hud_pos = {
            x: (hud.width / 2 - dst.w / 2),
            y: hud.height - dst.h
        };

        // Other sizes
        const cell_size         = 60 * this.zoom;
        const ss                = 27 * this.zoom;
        const mayGetDamaged     = player.game_mode.mayGetDamaged();

        // Draw item name in hotbar
        const currentInventoryItem = player.currentInventoryItem;
        if(currentInventoryItem) {
            const itemTitle = player.world.block_manager.getBlockTitle(currentInventoryItem);
            this.strings.updateText(0, itemTitle);
        } else {
            this.strings.setText(0, null);
        }

        // Draw strings
        // shift texts to up if livebar is drawed
        const y_margin = mayGetDamaged ? 40 * this.zoom : 0;
        if(this.strings.draw(hud, y_margin, this.zoom, hud_pos, cell_size)) {
            hud.refresh();
        }

        //
        if(mayGetDamaged) {
            // bar
            hud.ctx.drawImage(
                this.image,
                0,           // sx
                0,           // sy
                sw,          // sw
                sh,          // sh
                hud_pos.x,   // dx
                hud_pos.y,   // dy
                dst.w,       // dw
                dst.h        // dh
            );
            // Indicators
            const MAX_INDICATOR_VALUE = 20;
            const INDICATOR_PIECES = 10;
            let indicators = player.indicators;
            let live = indicators.live.value / MAX_INDICATOR_VALUE;
            let food = indicators.food.value / MAX_INDICATOR_VALUE;
            let oxygen = indicators.oxygen.value / MAX_INDICATOR_VALUE;
            //
            let spn = Math.round(performance.now() / 75);
            let calcShiftY = (i, live) => {
                let shift_y = 0;
                if(live < .35) {
                    shift_y = LIVE_SHIFT_RANDOM[(spn + i) % LIVE_SHIFT_RANDOM.length] * 5;
                }
                return shift_y;
            };
            // live
            // backgrounds
            const damage_time = 1000;
            if(Qubatch.hotbar.last_damage_time && performance.now() - Qubatch.hotbar.last_damage_time < damage_time) {
                let diff = performance.now() - Qubatch.hotbar.last_damage_time;
                if(diff % 200 < 100) {
                    hud.ctx.filter = 'opacity(.5)';
                }
            }
            for(let i = 0; i < 10; i++) {
                let shift_y = calcShiftY(i, live);
                hud.ctx.drawImage(
                    this.image,
                    src.icons.live.x,
                    src.icons.live_half.y + src.icons.live_half.height,
                    src.icons.live.width,
                    src.icons.live.height,
                    hud_pos.x + i * 24 * this.zoom,
                    hud_pos.y + 30 * this.zoom + shift_y,
                    ss,
                    ss
                );
            }
            hud.ctx.filter = 'none';
            for(let i = 0; i < Math.floor(live * INDICATOR_PIECES); i++) {
                let shift_y = calcShiftY(i, live);
                hud.ctx.drawImage(
                    this.image,
                    src.icons.live.x,
                    src.icons.live.y,
                    src.icons.live.width,
                    src.icons.live.height,
                    hud_pos.x + i * 24 * this.zoom,
                    hud_pos.y + 30 * this.zoom + shift_y,
                    ss,
                    ss
                );
            }
            if(Math.round(live * INDICATOR_PIECES) > Math.floor(live * INDICATOR_PIECES)) {
                let shift_y = calcShiftY(Math.floor(live * INDICATOR_PIECES), live);
                hud.ctx.drawImage(
                    this.image,
                    src.icons.live_half.x,
                    src.icons.live_half.y,
                    src.icons.live_half.width,
                    src.icons.live_half.height,
                    hud_pos.x + Math.floor(live * INDICATOR_PIECES) * (24 * this.zoom),
                    hud_pos.y + (30 * this.zoom) + shift_y,
                    ss,
                    ss
                );
            }
            // foods && oxygen
            const right_inds = [
                {value: food, img_full: src.icons.food, img_half: src.icons.food_half, visible_min: 1},
                {value: oxygen, img_full: src.icons.oxygen, img_half: src.icons.oxygen_half, visible_min: .95}
            ];
            for(let i in right_inds) {
                const ind = right_inds[i];
                const yoffset = i * (ss + 2 * this.zoom);
                if(ind.value > ind.visible_min) {
                    continue;
                }
                for(let i = 0; i < Math.floor(ind.value * INDICATOR_PIECES); i++) {
                    hud.ctx.drawImage(
                        this.image,
                        ind.img_full.x,
                        ind.img_full.y,
                        ind.img_full.width,
                        ind.img_full.height,
                        hud_pos.x + dst.w - (i * 24 * this.zoom + ss),
                        hud_pos.y + 30 * this.zoom - yoffset,
                        ss,
                        ss
                    );
                }
                if(Math.round(ind.value * INDICATOR_PIECES) > Math.floor(ind.value * INDICATOR_PIECES)) {
                    hud.ctx.drawImage(
                        this.image,
                        ind.img_half.x,
                        ind.img_half.y,
                        ind.img_half.width,
                        ind.img_half.height,
                        hud_pos.x + dst.w - (Math.floor(ind.value * INDICATOR_PIECES) * 24 * this.zoom + ss),
                        hud_pos.y + 30 * this.zoom - yoffset,
                        ss,
                        ss
                    );
                }
            }
        } else {
            // bar
            hud.ctx.drawImage(
                this.image,
                0,
                slive_bar_height,
                sw,
                sh - slive_bar_height,
                hud_pos.x,
                hud_pos.y + dst.live_bar_height,
                dst.w,
                dst.h - dst.live_bar_height
            );
        }
        // inventory_selector
        hud.ctx.drawImage(
            this.image,
            selector.x,
            selector.y,
            selector.width,
            selector.height,
            hud_pos.x - 3 * this.zoom + this.inventory.getRightIndex() * cell_size,
            hud_pos.y + (48 + 30) * this.zoom,
            dst.selector.width,
            dst.selector.height
        );
        if(this.inventory) {
            this.inventory.drawHotbar(hud, cell_size, new Vector(hud_pos.x, hud_pos.y + (48 + 30) * this.zoom, 0), this.zoom);
        }
        
        this.drawEffects(hud);
    }
    
    
    drawEffects(hud) {
        const player = this.inventory.player;
        let pos = 0;
        for (const effect of player.effects.effects) {
            this.drawEffectsIcon(hud, effect.id, pos++);
        }
    }
    
    drawEffectsIcon(hud, icon, pos) {
        if (icon > 23) {
            return;
        }
        const icons = [
            {x: 2, y: 397},
            {x: 39, y: 397},
            {x: 73, y: 397},
            {x: 112, y: 397},
            {x: 145, y: 397},
            {x: 181, y: 397},
            {x: 219, y: 397},
            {x: 255, y: 397},
            {x: 2, y: 435},
            {x: 39, y: 435},
            {x: 73, y: 435},
            {x: 112, y: 435},
            {x: 145, y: 435},
            {x: 181, y: 435},
            {x: 219, y: 435},
            {x: 255, y: 435},
            {x: 2, y: 472},
            {x: 39, y: 472},
            {x: 73, y: 472},
            {x: 112, y: 472},
            {x: 145, y: 472},
            {x: 181, y: 472},
            {x: 219, y: 472},
            {x: 255, y: 472},
        ];
        hud.ctx.drawImage(this.inventory_image, 280, 333, 50, 50, hud.width - this.zoom * 50 * ( pos + 1) - 10, 10, this.zoom * 50, this.zoom * 50);
        hud.ctx.drawImage(this.inventory_image, icons[icon].x, icons[icon].y, 34, 34, hud.width - (this.zoom * (50 * (pos + 1) - 11)) - 10, this.zoom * 14, this.zoom * 34, this.zoom * 34);
    }

}