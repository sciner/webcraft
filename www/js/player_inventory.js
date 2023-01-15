import {Vector, Helpers} from "./helpers.js";
import {RecipeManager} from "./recipes.js";
import {Resources} from "./resources.js";
import { Inventory } from "./inventory.js";
import { INVENTORY_DRAG_SLOT_INDEX } from "./constant.js";
import { INVENTORY_ICON_COUNT_PER_TEX } from "./chunk_const.js";
import { EnchantShaderNoise } from "./math/EnchantShaderNoise.js";

const enchantShader = new EnchantShaderNoise()

// Player inventory
export class PlayerInventory extends Inventory {

    constructor(player, state, hud) {
        super(player, {current: {index: 0, index2: -1}, items: []});
        this.hud = hud
        for(let i = 0; i < this.max_count; i++) {
            this.items.push(null);
        }
        //
        this.select(this.current.index);
        // Recipe manager
        this.recipes = new RecipeManager(true);
        // Restore slots state
        this.setState(state);
        // Action on change slot
        this.onSelect = (item) => {
            // Вызывается при переключении активного слота в инвентаре
            player.resetMouseActivity();
            player.world.server.InventorySelect(this.current);
            this.hud.refresh();
        };
        // Add this for draw on screen
        Qubatch.hotbar.setInventory(this);
        //
        this.hud.add(this, 0);
    }

    setState(inventory_state) {
        this.current = inventory_state.current;
        this.items = inventory_state.items;
        this.refresh();
        // update drag UI if the dragged item changed
        for(const w of this.hud.wm.visibleWindows()) {
            w.onInventorySetState && w.onInventorySetState();
        }
    }

    get inventory_window() {
        return this.hud.wm.getWindow('frmInventory');
    }

    // Open window
    open() {
        if(this.player.game_mode.isCreative()) {
            this.hud.wm.getWindow('frmCreativeInventory').toggleVisibility();
        } else {
            this.hud.wm.getWindow('frmInventory').toggleVisibility();
        }
    }

    // Refresh
    refresh() {
        this.player.state.hands.right = this.current_item;
        if(this.hud) {
            this.hud.refresh();
            try {
                const frmRecipe = this.hud.wm.getWindow('frmRecipe');
                frmRecipe.paginator.update();
            } catch(e) {
                // do nothing
            }
        }
        return true;
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
    drawHotbar(hud, cell_size, pos, zoom) {
        if(!this.inventory_image) {
            return this.initUI();
        }
        hud.ctx.imageSmoothingEnabled = false;
        // 1. that.inventory_image
        // 2. inventory_selector
        // img,sx,sy,swidth,sheight,x,y,width,height
        const hud_pos = new Vector(pos.x, pos.y, 0);
        const DEST_SIZE = 64 * zoom;
        // style
        hud.ctx.font            = Math.round(18 * zoom) + 'px ' + UI_FONT;
        hud.ctx.textAlign       = 'right';
        hud.ctx.textBaseline    = 'bottom';
        const bm = this.player.world.block_manager;
        // Create virtual slots if not exists
        if(!this.slots) {
            this.slots = new Array(this.hotbar_count)
            for(let i = 0; i < this.slots.length; i++) {
                this.slots[i] = {x: i * 100, y: 0}
            }
        }
        for(const k in this.items) {
            const item = this.items[k];
            if(k >= this.hotbar_count) {
                break;
            }
            //
            if(item) {
                if(!('id' in item)) {
                    console.error(item);
                }
                const mat = bm.fromId(item.id);
                const icon = bm.getInventoryIconPos(
                    mat.inventory_icon_id,
                    this.inventory_image.width,
                    this.inventory_image.width / INVENTORY_ICON_COUNT_PER_TEX
                );

                //
                const image = enchantShader.processEnchantedIcon(this.slots[k], item, this.inventory_image, icon)

                hud.ctx.drawImage(
                    image,
                    icon.x,
                    icon.y,
                    icon.width,
                    icon.height,
                    hud_pos.x + cell_size / 2 - 49 * zoom / 2 - 4 * zoom,
                    hud_pos.y + cell_size / 2 - 48 * zoom / 2 - 2 * zoom,
                    DEST_SIZE,
                    DEST_SIZE
                )

                // Draw instrument life
                const power_in_percent = mat?.item?.indicator == 'bar';
                if((mat.item?.instrument_id && item.power < mat.power) || power_in_percent) {
                    const power_normal = Math.min(item.power / mat.power, 1);
                    let cx = hud_pos.x + 14 * zoom;
                    let cy = hud_pos.y + 14 * zoom;
                    let cw = 40 * zoom;
                    let ch = 43 * zoom;
                    hud.ctx.fillStyle = '#000000ff';
                    hud.ctx.fillRect(cx, cy + ch - 8 * zoom, cw, 6 * zoom);
                    //
                    let rgb = Helpers.getColorForPercentage(power_normal);
                    hud.ctx.fillStyle = rgb.toCSS();
                    hud.ctx.fillRect(cx, cy + ch - 8 * zoom, cw * power_normal | 0, 4 * zoom);
                }
                // Draw label
                let label = item.count > 1 ? item.count : null;
                let shift_y = 0;
                if(this.current.index == k) {
                    if(!label && 'power' in item) {
                        if(power_in_percent) {
                            label = (Math.round((item.power / mat.power * 100) * 100) / 100) + '%';
                        } else {
                            label = Math.round(item.power * 100) / 100;
                        }
                        shift_y = -10;
                    }
                }
                if(label) {
                    hud.ctx.textBaseline = 'bottom';
                    hud.ctx.font = Math.round(18 * zoom) + 'px ' + UI_FONT;
                    hud.ctx.fillStyle = '#000000ff';
                    hud.ctx.fillText(label, hud_pos.x + cell_size - 5 * zoom, hud_pos.y + cell_size + shift_y * (zoom / 2));
                    hud.ctx.fillStyle = '#ffffffff';
                    hud.ctx.fillText(label, hud_pos.x + cell_size - 5 * zoom, hud_pos.y + cell_size + (shift_y - 2) * (zoom / 2));
                }
            }
            hud_pos.x += cell_size;
        }
    }

    // initUI...
    initUI() {
        this.inventory_image = Resources.inventory.image;
    }

    //
    setDragItem(slot, item, drag, width, height) {
        this.items[INVENTORY_DRAG_SLOT_INDEX] = item;
        if(!drag) {
            drag = this.hud.wm.drag;
        }
        if(item) {
            drag.setItem({
                item,
                draw: function(e) {
                    slot.drawItem(e.ctx, this.item, e.x, e.y, width, height);
                }
            });
        } else {
            this.clearDragItem();
        }
    }

    // The same result as in chest_manager.js: applyClientChange()
    clearDragItem(move_to_inventory) {
        const drag = this.hud.wm.drag;
        if(move_to_inventory) {
            let dragItem = drag.getItem();
            if(dragItem) {
                this.increment(dragItem.item, true);
            }
        }
        this.items[INVENTORY_DRAG_SLOT_INDEX] = null;
        drag.clear();
    }

}