import {CraftTable, InventoryWindow, ChestWindow, CreativeInventoryWindow} from "./window/index.js";
import {DIRECTION, Vector, Helpers} from "./helpers.js";
import {RecipeManager} from "./recipes.js";
import {BLOCK} from "./blocks.js";
import {Resources} from "./resources.js";
import { PlayerInventory } from "./player_inventory.js";

// Player inventory
export class Inventory extends PlayerInventory {

    constructor(player, hud, cb_onSelect) {
        super(null, {current: {index: 0, index2: -1}, items: []});
        this.player         = player;
        this.hud            = hud;
        this.cb_onSelect    = cb_onSelect;
        this.current_item   = null;
        for(let i = 0; i < this.max_count; i++) {
            this.items.push(null);
        }
        //
        // this.restoreItems(player.state.inventory);
        this.select(this.current.index);
        // Recipe manager
        this.recipes = new RecipeManager();
    }

    setState(inventory_state) {
        this.current = inventory_state.current;
        this.items = inventory_state.items;
    }

    // Open window
    open() {
        if(this.player.world.game_mode.isCreative()) {
            Game.hud.wm.getWindow('frmCreativeInventory').toggleVisibility();
        } else {
            Game.hud.wm.getWindow('frmInventory').toggleVisibility();
        }
    }

    //
    restoreItems(saved_inventory) {
        let items = saved_inventory.items;
        this.items = []; // new Array(this.max_count);
        for(let i = 0; i < this.max_count; i++) {
            this.items.push(null);
        }
        this.current.index = 0;
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
                    if(!item.count) {
                        item.count = 1;
                    }
                    this.items[k] = item;
                }
            }
        }
    }

    // Refresh
    refresh(changed) {
        if(this.hud) {
            this.hud.refresh();
            try {
                let frmRecipe = Game.hud.wm.getWindow('frmRecipe');
                frmRecipe.paginator.update();
            } catch(e) {
                // do nothing
            }
        }
    }
    
    // Клонирование материала в инвентарь
    cloneMaterial(mat) {
        if(!this.player.world.game_mode.isCreative()) {
            return false;
        }
        const MAX = mat.max_in_stack;
        // Search same material with count < max
        for(let k in Object.keys(this.items)) {
            if(parseInt(k) >= this.hotbar_count) {
                break;
            }
            if(this.items[k]) {
                let item = this.items[k];
                if(item.id == mat.id) {
                    this.select(parseInt(k));
                    return this.refresh(false);
                }
            }
        }
        // Create in current cell if this empty
        if(this.current.index < this.hotbar_count) {
            let k = this.current.index;
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, mat);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Start new cell
        for(let k in Object.keys(this.items)) {
            if(parseInt(k) >= this.hotbar_count) {
                break;
            }
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, mat);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Replace current cell
        if(this.current.index < this.hotbar_count) {
            let k = this.current.index;
            this.items[k] = Object.assign({count: 1}, mat);
            delete(this.items[k].texture);
            this.select(parseInt(k));
            return this.refresh(true);
        }
    }

    // drawHUD
    drawHUD(hud) {
        if(!this.inventory_image) {
            return this.initUI();
        }
        if(!this.current.index) {
            this.current.index = 0;
        }
        hud.wm.centerChild();
    }

    // drawHotbar
    drawHotbar(hud, cell_size, pos) {
        if(!this.inventory_image) {
            return this.initUI();
        }
        hud.ctx.imageSmoothingEnabled = false;
        // 1. that.inventory_image
        // 2. inventory_selector
        // img,sx,sy,swidth,sheight,x,y,width,height
        const hud_pos = new Vector(pos.x, pos.y, 0);
        const DEST_SIZE = 64;
        // style
        hud.ctx.font            = '18px Ubuntu';
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
                let mat = BLOCK.fromId(item.id);
                const icon = BLOCK.getInventoryIconPos(
                    mat.inventory_icon_id,
                    this.inventory_image.width,
                    this.inventory_image.width / 16
                );
                hud.ctx.drawImage(
                    this.inventory_image,
                    icon.x,
                    icon.y,
                    icon.width,
                    icon.height,
                    hud_pos.x + cell_size / 2 - 49 / 2 - 4,
                    hud_pos.y + cell_size / 2 - 48 / 2 - 2,
                    DEST_SIZE,
                    DEST_SIZE
                    );
                if(item.count > 1) {
                    hud.ctx.textBaseline    = 'bottom';
                    hud.ctx.font            = '18px Ubuntu';
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

    // initUI...
    initUI() {
        this.inventory_image = Resources.inventory.image;
        this.hud.add(this, 0);
        // CraftTable
        this.ct = new CraftTable(this.recipes, 0, 0, 352, 332, 'frmCraft', null, null, this);
        this.ct.visible = false;
        this.hud.wm.add(this.ct);
        // Inventory window
        this.frmInventory = new InventoryWindow(this.recipes, 10, 10, 352, 332, 'frmInventory', null, null, this);
        this.hud.wm.add(this.frmInventory);
        // Creative Inventory window
        this.frmCreativeInventory = new CreativeInventoryWindow(10, 10, 390, 416, 'frmCreativeInventory', null, null, this);
        this.hud.wm.add(this.frmCreativeInventory);
        // Chest window
        this.frmChest = new ChestWindow(10, 10, 352, 332, 'frmChest', null, null, this);
        this.hud.wm.add(this.frmChest);
    }

}