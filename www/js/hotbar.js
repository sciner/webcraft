import { BLOCK } from "./blocks.js";
import {Vector} from "./helpers.js";

export class Hotbar {

    constructor(hud, inventory) {
        let that                = this;
        this.hud                = hud;
        this.image              = new Image(); // new Image(40, 40); // Размер изображения
        //
        this.sounds = {
            hit3: new Howl({src: ['/sounds/hit3.ogg'], volume: .5})
        };
        //
        this.image.onload = function() {
            that.hud.add(that, 0);
        }
        this.image.src = './media/hotbar.png';
        //
        this.itemNameO = null;
        this.itemNameChangeTime = performance.now();
    }

    //
    setInventory(inventory) {
        this.inventory = inventory;
    }

    //
    damage(damage_value, reason_text) {
        if(damage_value > 0) {
            Game.player.world.server.ModifyIndicator('live', -damage_value, reason_text);
            console.log('Damage ' + damage_value + ', reason: ' + reason_text);
            this.sounds.hit3.play();
        }
    }

    setState(new_state) {
        for(const [key, value] of Object.entries(new_state)) {
            this[key] = value;
        }
    };
    
    drawHUD(hud) {
        const player = this.inventory.player;
        if(player.game_mode.isSpectator()) {
            return false;
        }
        const scale = 1;
        let w = 546; // this.image.width;
        let h = 147; // this.image.height;
        const cell_size = 60;
        const live_bar_height = 81;
        let hud_pos = {
            x: hud.width / 2 - w / 2,
            y: hud.height - h
        };
        const ss = 27;
        const mayGetDamaged = player.game_mode.mayGetDamaged();

        // Draw item name in hotbar
        let currentInventoryItem = player.currentInventoryItem;
        if(currentInventoryItem) {
            let itemName = currentInventoryItem?.name || BLOCK.fromId(currentInventoryItem.id)?.name;
            itemName = itemName.replaceAll('_', ' ');
            const max_name_show_time = 2000;
            if(itemName != this.itemNameO) {
                this.itemNameO = itemName;
                this.itemNameChangeTime = performance.now();
            }
            const time_remains = performance.now() - this.itemNameChangeTime;
            if(time_remains < max_name_show_time) {
                // Text opacity
                let alpha = 1;
                alpha = Math.min(2 - (time_remains / max_name_show_time) * 2, 1);
                let aa = Math.ceil(255 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                //
                hud.ctx.textBaseline = 'bottom';
                hud.ctx.font = '24px Ubuntu';
                const yMargin = mayGetDamaged ? 40 : 0;
                const textWidth = hud.ctx.measureText(itemName).width;
                hud.ctx.fillStyle = '#000000' + aa;
                hud.ctx.fillText(itemName, hud.width / 2 - textWidth / 2, hud_pos.y + cell_size - yMargin);
                hud.ctx.fillStyle = '#ffffff' + aa;
                hud.ctx.fillText(itemName, hud.width / 2 - textWidth / 2, hud_pos.y + cell_size - yMargin - 2);
                //
                hud.refresh();
            }
        } else {
            this.itemNameO = null;
        }

        if(mayGetDamaged) {
            // bar
            hud.ctx.drawImage(
                this.image,
                0,
                0,
                w,
                h,
                hud_pos.x,
                hud_pos.y,
                w,
                h
            );
            // Indicators
            let indicators = player.indicators;
            let live = indicators.live.value / 20;
            let food = indicators.food.value / 20;
            // live
            for(let i = 0; i < Math.floor(live * 10); i++) {
                hud.ctx.drawImage(
                    this.image,
                    0,
                    150,
                    ss,
                    ss,
                    hud_pos.x + i * 24,
                    hud_pos.y + 30,
                    ss,
                    ss
                );
            }
            if(Math.round(live * 10) > Math.floor(live * 10)) {
                hud.ctx.drawImage(
                    this.image,
                    0,
                    150 + ss,
                    ss,
                    ss,
                    hud_pos.x + Math.floor(live * 10) * 24,
                    hud_pos.y + 30,
                    ss,
                    ss
                );
            }
            // foods
            for(let i = 0; i < Math.floor(food * 10); i++) {
                hud.ctx.drawImage(
                    this.image,
                    ss,
                    150,
                    ss,
                    ss,
                    hud_pos.x + w - (i * 24 + ss),
                    hud_pos.y + 30,
                    ss,
                    ss
                );
            }
            if(Math.round(food * 10) > Math.floor(food * 10)) {
                hud.ctx.drawImage(
                    this.image,
                    ss,
                    150 + ss,
                    ss,
                    ss,
                    hud_pos.x + w - (Math.floor(food * 10) * 24 + ss),
                    hud_pos.y + 30,
                    ss,
                    ss
                );
            }
        } else {
            // bar
            hud.ctx.drawImage(
                this.image,
                0,
                live_bar_height,
                w,
                h - live_bar_height,
                hud_pos.x,
                hud_pos.y + live_bar_height,
                w,
                h - live_bar_height
            );
        }
        // inventory_selector
        hud.ctx.drawImage(
            this.image,
            live_bar_height,
            150,
            72,
            69,
            hud_pos.x - 3 + this.inventory.getRightIndex() * cell_size,
            hud_pos.y + 48 + 30,
            72,
            69
        );
        if(this.inventory) {
            this.inventory.drawHotbar(hud, cell_size, new Vector(hud_pos.x, hud_pos.y + 48 + 30, 0));
        }
    }

}