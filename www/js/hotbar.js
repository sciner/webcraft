import {Vector} from "./helpers.js";

export class Hotbar {

    constructor(hud, inventory) {
        let that                = this;
        this.hud                = hud;
        this.inventory          = inventory;
        this.image              = new Image(); // new Image(40, 40); // Размер изображения
        this.lives              = 0.95;
        this.foods              = 1.;
        this.image.onload = function() {
            that.hud.add(that, 0);
        }
        this.image.src = './media/hotbar.png';
    }

    setState(new_state) {
        for(const [key, value] of Object.entries(new_state)) {
            this[key] = value;
        }
    };
    
    drawHUD(hud) {
        const scale = 1;
        let w = 546; // this.image.width;
        let h = 147; // this.image.height;
        const cell_size = 60;
        let hud_pos = {
            x: hud.width / 2 - w / 2,
            y: hud.height - h
        };
        const ss = 27;
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
        // lives
        for(let i = 0; i < Math.floor(this.lives * 10); i++) {
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
        if(Math.round(this.lives * 10) > Math.floor(this.lives * 10)) {
            hud.ctx.drawImage(
                this.image,
                0,
                150 + ss,
                ss,
                ss,
                hud_pos.x + Math.floor(this.lives * 10) * 24,
                hud_pos.y + 30,
                ss,
                ss
            );
        }
        // foods
        for(let i = 0; i < Math.floor(this.foods * 10); i++) {
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
        if(Math.round(this.foods * 10) > Math.floor(this.foods * 10)) {
            hud.ctx.drawImage(
                this.image,
                ss,
                150 + ss,
                ss,
                ss,
                hud_pos.x + w - (Math.floor(this.foods * 10) * 24 + ss),
                hud_pos.y + 30,
                ss,
                ss
            );
        }
        // inventory_selector
            // img,sx,sy,swidth,sheight,x,y,width,height
            hud.ctx.drawImage(
                this.image,
                81,
                150,
                72,
                69,
                hud_pos.x - 3 + this.inventory.index * cell_size,
                hud_pos.y + 48 + 30,
                72,
                69
            );
        this.inventory.drawHotbar(hud, cell_size, new Vector(hud_pos.x, hud_pos.y + 48 + 30, 0));
    }

}