import {BLOCK} from "../blocks.js";
import { Vector } from "../helpers.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { Button, Label, Window, TextEdit } from "../../tools/gui/wm.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_SLOT_SIZE, INVENTORY_VISIBLE_SLOT_COUNT } from "../constant.js";
import { CraftTableInventorySlot, CraftTableSlot } from "./base_craft_window.js";



export class AnvilWindow extends BaseChestWindow {

    constructor(inventory) {
        super(10, 10, 350, 330, 'frmAnvil', null, null, inventory, {
            title: 'Anvil',
            background: {
                image: './media/gui/anvil.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 350,
                    height: 330
                }
            },
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        });
        
        this.name = new TextEdit(118 * this.zoom, 40 * this.zoom, 220 * this.zoom, 32 * this.zoom, 'tilte_edit', null, 'Hello, World!');
        this.name.word_wrap          = true;
        this.name.style.color        = '#ffffff';
        this.name.focused            = true;
        this.name.style.font.size    *= this.zoom;
        this.add(this.name);
    }
    
    prepareSlots() {
        const resp = [];
        resp.push({pos: new Vector(102, 182, 0)});
        resp.push({pos: new Vector(300, 182, 0)});
        resp.push({pos: new Vector(530, 182, 0), readonly: true});
        return resp;
    }
    
     draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        //if(this.state) {
            if(typeof this.style.background.image == 'object') {
                let x = ax + this.x;
                let y = ay + this.y;
                const arrow = {x: 353, y: 0, width: 96, height: 41, tox: 200 * this.zoom, toy: 90 * this.zoom};
                ctx.drawImage(
                    this.style.background.image,
                    arrow.x,
                    arrow.y,
                    arrow.width,
                    arrow.height,
                    x + arrow.tox,
                    y + arrow.toy,
                    arrow.width * this.zoom,
                    arrow.height * this.zoom
                );
            }
       // }
    }
    
}

