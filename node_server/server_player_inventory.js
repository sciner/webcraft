import { BLOCK } from "../www/js/blocks.js";
import { INVENTORY_DRAG_SLOT_INDEX } from "../www/js/constant.js";
import { InventoryComparator } from "../www/js/inventory_comparator.js";
import { Inventory } from "../www/js/inventory.js";
import { ServerClient } from "../www/js/server_client.js";

export class ServerPlayerInventory extends Inventory {

    save() {
        this.player.world.db.savePlayerInventory(this.player, this.exportItems());
    }

    send() {
        this.player.world.sendSelected([
            {name: ServerClient.CMD_INVENTORY_STATE, data: this.exportItems()}
        ], [this.player.session.user_id], []);
    }

    // Refresh
    refresh(send_state) {
        // Update hands
        this.current.index = isNaN(this.current.index) ? 0 : this.current.index;
        this.current.index2 = isNaN(this.current.index2) ? -1 : this.current.index2;
        this.player.updateHands();
        // Save inventory to DB
        this.save();
        // Send for all except player
        this.player.sendState();
        // Send to player
        if(send_state) {
            this.send();
        }
        return true;
    }

    // Игрок прислал новое состояние инвентаря, нужно его провалидировать и применить
    async newState(params) {

        const state = params.state;
        const used_recipes = params.used_recipes;

        if(!state || !state?.items || !used_recipes) {
            throw 'error_invalid_inventory_state_params';
        }

        // New state
        if('items' in state) {
            let equal = this.player.game_mode.isCreative();
            const old_items = this.items;
            const new_items = state.items;
            if(!equal) {
                equal = await InventoryComparator.checkEqual(old_items, new_items, used_recipes);
            }
            if(equal) {
                // apply new
                this.applyNewItems(new_items, true);
                console.log('New inventory state ... Accepted');
                // run triggers
                if(this.player.onCrafted) {
                    const recipeMan = await InventoryComparator.getRecipeManager();
                    for(let recipe_id of used_recipes) {
                        const recipe = recipeMan.getRecipe(recipe_id);
                        this.player.onCrafted(recipe, {
                            block_id: recipe.result.item_id,
                            count: recipe.result.count
                        });
                    }
                }
            } else {
                // send current to player
                console.error('New inventory state ... Rejected');
                this.send();
            }
        }
    }

    // Drop item from hand
    dropItem() {
        if(!this.current_item) {
            return false;
        }
        const item = {...this.current_item};
        item.count = 1;
        const pos = this.player.state.pos.clone();
        pos.addSelf(this.temp_vec.set(
            -Math.sin(this.player.state.rotate.z) * .15 + Math.random() * .5,
            this.player.height * .4,
            -Math.cos(this.player.state.rotate.z) * .15 + Math.random() * .5,
        ));
        // Add velocity for drop item
        this.temp_vec.set(
            Math.sin(this.player.state.rotate.z) *  .5,
            .5,
            Math.cos(this.player.state.rotate.z) * .5,
        );
        this.player.world.createDropItems(this.player, pos, [item], this.temp_vec);
        if(this.current_item.count == 1) {
            this.setItem(this.current.index, null);
        } else {
            this.decrement(null, true);
        }
        return true;
    }

    // Drop item from drag temporary slot
    dropFromDragSlot() {
        const slot_index = INVENTORY_DRAG_SLOT_INDEX;
        const item = this.items[slot_index];
        if(!item) {
            return false;
        }
        console.log(this.player.state)
        const pos = this.player.state.pos.clone();
        pos.addSelf(this.temp_vec.set(
            -Math.sin(this.player.state.rotate.z) * .15 + Math.random() * .5,
            this.player.height * .4,
            -Math.cos(this.player.state.rotate.z) * .15 + Math.random() * .5,
        ));
        // Add velocity for drop item
        this.temp_vec.set(
            Math.sin(this.player.state.rotate.z) *  .5,
            .5,
            Math.cos(this.player.state.rotate.z) * .5,
        );
        this.player.world.createDropItems(this.player, pos, [item], this.temp_vec);
        this.items[slot_index] = null;
        return true;
    }

    // Клонирование материала в инвентарь
    cloneMaterial(mat, allow_create_new) {
        if(mat.id < 2 || mat.deprecated) {
            return false;
        }
        while(mat.previous_part && mat.previous_part.id != mat.id) {
            let b = BLOCK.fromId(mat.previous_part.id);
            mat = {id: b.id, previous_part: b.previous_part};
        }
        mat = BLOCK.convertItemToInventoryItem(mat);
        // Search same material with count < max
        for(let k in Object.keys(this.items)) {
            k = parseInt(k);
            if(this.items[k]) {
                let item = this.items[k];
                if(item.id == mat.id) {
                    if(k >= this.hotbar_count) {
                        // swith with another from inventory
                        this.items[k] = this.items[this.current.index];
                        this.items[this.current.index] = item;
                        this.select(this.current.index);
                        return this.refresh(false);
                    } else {
                        // select if on hotbar
                        this.select(k);
                        return this.refresh(false);
                    }
                }
            }
        }
        if(!allow_create_new) {
            return false;
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

}