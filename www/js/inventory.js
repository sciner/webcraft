import {BLOCK} from "./blocks.js";
import {CraftTable, InventoryWindow, ChestWindow} from "./window/index.js";
import {Vector, Helpers} from "./helpers.js";

// Player inventory

export default class Inventory {
    
    constructor(player, hud) {
        let that            = this;
        this.player         = player;
        this.hud            = hud;
        this.current        = null;
        this.index          = 0;
        this.max_count      = 36;
        this.hotbar_count   = 9;
        this.items          = []; // new Array(this.max_count);
        for(let i = 0; i < this.max_count; i++) {
            this.items.push(null);
        }
        //
        this.restoreItems(Game.world.saved_state.inventory.items);
        // set inventory to user
        this.player.setInventory(this);
        //
        this.select(Game.world.saved_state.inventory.current.index);
        //
        let image = new Image(); // new Image(40, 40); // Размер изображения
        image.onload = function() {
            that.inventory_image = image;
            that.hud.add(that, 0);
        }
        image.src = './media/inventory2.png';
        // CraftTable
        this.ct = new CraftTable(10, 10, 352, 332, 'ct1', null, null, this);
        hud.wm.add(this.ct);
        // Inventory window
        this.frmInventory = new InventoryWindow(10, 10, 352, 332, 'frmInventory', null, null, this);
        hud.wm.add(this.frmInventory);
        // Chest window
        this.frmChest = new ChestWindow(10, 10, 352, 332, 'frmChest', null, null, this);
        hud.wm.add(this.frmChest);
    }

    //
    exportItems() {
        let resp = [];
        for(var item of this.items) {
            let t = null;
            if(item) {
                t = {
                    id:         item.id,
                    count:      item.count,
                    power:      item.power
                };
                // Individual properties
                for(let prop of ['entity_id', 'entity_name']) {
                    t[prop] = null;
                    if(item.hasOwnProperty(prop)) {
                        t.entity_id = item[prop];
                    }
                }
            }
            resp.push(t);
        }
        return resp;
    }

    //
    restoreItems(items) {
        this.items          = []; // new Array(this.max_count);
        for(let i = 0; i < this.max_count; i++) {
            this.items.push(null);
        }

        this.index = 0;
        for(let k in items) {
            if(k >= this.items.length) {
                console.error('Limit reach of inventory');
                break;
            }
            let item = items[k];
            if(item) {
                const block = {...BLOCK.fromId(item.id)};
                if(block) {
                    item = Object.assign(block, items[k]);
                    this.items[k] = item;
                }
            }
        }
    }
    
    getCurrent() {
        return this.current;
    }

    // Refresh
    refresh() {
        this.hud.refresh();
    }
    
    increment(mat) {
        let item_max_count = mat.max_in_stack;
        // update cell if exists
        for(let i in this.items) {
            let item = this.items[i];
            if(item) {
                if(item.id == mat.id) {
                    if(item.count < item_max_count) {
                        if(item.count + mat.count <= item_max_count) {
                            item.count = Math.min(item.count + mat.count, item_max_count);
                            this.refresh();
                            return;
                        } else {
                            let remains = (item.count + mat.count) - item_max_count;
                            item.count = item_max_count;
                            mat.count = remains;
                            this.refresh();
                        }
                    }
                }
            }
        }
        // start new slot
        for(let i = 0; i < this.items.length; i++) {
            if(!this.items[i]) {
                this.items[i] = {...mat};
                if(this.items[i].count > item_max_count) {
                    mat.count -= item_max_count;
                    this.items[i].count = item_max_count;
                } else {
                    mat.count = 0;
                }
                delete(this.items[i].texture);
                if(i == this.index) {
                    this.select(i);
                }
                if(mat.count > 0) {
                    this.increment(mat);
                }
                this.refresh();
                return;
            }
        }
    }
    
    decrement() {
        if(!this.current) {
            return;
        }
        this.current.count = Math.max(this.current.count - 1, 0);
        if(this.current.count < 1) {
            this.current = this.player.buildMaterial = this.items[this.index] = null;
        }
        this.refresh();
    }
    
    //
    setItem(index, item) {
        this.items[index] = item;
        // Обновить текущий инструмент у игрока
        this.select(this.index);
    }
    
    //
    select(index) {
        if(index < 0) {
            index = this.hotbar_count - 1;
        }
        if(index >= this.hotbar_count) {
            index = 0;
        }
        this.index = index;
        this.current = this.player.buildMaterial = this.items[index];
        this.refresh();
        this.player.onInventorySelect(this.current);
    }
    
    next() {
        this.select(++this.index);
    }
    
    prev() {
        this.select(--this.index);
    }
    
    cloneMaterial(mat) {
        const MAX = 64;
        // Search same material with count < max
        for(let index in this.items) {
            if(this.items[index]) {
                if(this.items[index].id == mat.id) {
                    if(this.items[index].count < MAX) {
                        this.items[index].count = Math.min(this.items[index].count + 1, MAX);
                        if(index < this.hotbar_count) {
                            this.select(index);
                        }
                        return this.refresh();
                    }
                }
            }
        }
        // start new cell
        for(let index = 0; index < this.items.length; index++) {
            if(!this.items[index]) {
                this.items[index] = Object.assign({count: 1}, mat);
                delete(this.items[index].texture);
                if(index < this.hotbar_count) {
                    this.select(index);
                }
                return this.refresh();
            }
        }
        /*
        this.current = this.player.buildMaterial = this.items[this.index] = Object.assign({count: 1}, mat);
        delete(this.items[this.index].texture);
        */
    }
    
    drawHUD(hud) {
        if(!this.index) {
            this.index = 0;
        }
        hud.wm.center(this.ct);
        hud.wm.center(this.frmInventory);
    }
    
    drawHotbar(hud, cell_size, pos) {
        if(!this.inventory_image) {
            return;
        }
        hud.ctx.imageSmoothingEnabled = false;
        // 1. that.inventory_image
        // 2. inventory_selector
        // img,sx,sy,swidth,sheight,x,y,width,height
        const hud_pos = new Vector(pos.x, pos.y, 0);
        // style
        hud.ctx.font            = '18px Minecraftia';
        hud.ctx.textAlign       = 'right';
        hud.ctx.textBaseline    = 'bottom';
        for(const k in this.items) {
            const item = this.items[k];
            if(k >= this.hotbar_count) {
                break;
            }
            if(item) {
                if(!item.name) {
                    console.error(item);
                }
                if('inventory_icon_id' in item) {
                    let icon = BLOCK.getInventoryIconPos(item.inventory_icon_id);
                    hud.ctx.drawImage(
                        this.inventory_image,
                        icon.x,
                        icon.y,
                        icon.width,
                        icon.height,
                        hud_pos.x + cell_size / 2 - icon.width / 2 - 4,
                        hud_pos.y + cell_size / 2 - icon.height / 2,
                        48,
                        48
                    );
                } else {
                    hud.ctx.textBaseline    = 'top';
                    hud.ctx.font            = '12px Minecraftia';
                    let text = item.name.substring(0, 4);
                    hud.ctx.fillStyle = '#000000ff';
                    hud.ctx.fillText(text, hud_pos.x + cell_size - 5, hud_pos.y + 20);
                    hud.ctx.fillStyle = '#ffffffff';
                    hud.ctx.fillText(text, hud_pos.x + cell_size - 5, hud_pos.y + 20 - 2);
                }
                if(item.count > 1) {
                    hud.ctx.textBaseline    = 'bottom';
                    hud.ctx.font            = '18px Minecraftia';
                    hud.ctx.fillStyle = '#000000ff';
                    hud.ctx.fillText(item.count, hud_pos.x + cell_size - 5, hud_pos.y + cell_size);
                    hud.ctx.fillStyle = '#ffffffff';
                    hud.ctx.fillText(item.count, hud_pos.x + cell_size - 5, hud_pos.y + cell_size - 2);
                }
                // Draw instrument life
                if(item.instrument_id && item.power < 1) {
                    let cx = hud_pos.x + 14;
                    let cy = hud_pos.y + 14;
                    let cw = 40;
                    let ch = 43;
                    hud.ctx.fillStyle = '#000000ff';
                    hud.ctx.fillRect(cx, cy + ch - 8, cw, 8);
                    //
                    let rgb = Helpers.getColorForPercentage(item.power);
                    hud.ctx.fillStyle = rgb.toCSS();
                    hud.ctx.fillRect(cx, cy + ch - 8, cw * item.power | 0, 4);
                }
            }
            hud_pos.x += cell_size;
        }
    }

}