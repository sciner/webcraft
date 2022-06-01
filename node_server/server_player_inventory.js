import { InventoryComparator } from "../www/js/inventory_comparator.js";
import { PlayerInventory } from "../www/js/player_inventory.js";
import { ServerClient } from "../www/js/server_client.js";

export class ServerPlayerInventory extends PlayerInventory {

    // Refresh
    refresh(send_state) {
        const data = {
            current: this.current,
            items: this.items
        };
        this.current.index = isNaN(data.current.index) ? 0 : data.current.index;
        this.current.index2 = isNaN(data.current.index2) ? -1 : data.current.index2;
        this.player.updateHands();
        this.player.world.db.savePlayerInventory(this.player, data);
        let packets = [{
            name: ServerClient.CMD_PLAYER_STATE,
            data: this.player.exportState()
        }];
        this.player.world.sendAll(packets, [this.player.session.user_id]);
        // Send new inventory to player
        if(send_state) {
            this.player.world.sendSelected([{name: ServerClient.CMD_INVENTORY_STATE, data: data}], [this.player.session.user_id], []);
        }
        return true;
    }

    // Игрок прислал новое состояние инвентаря, нужно его провалидировать и применить
    async newState(params) {
        if(!('state' in params && 'used_recipes' in params)) {
            throw 'error_invalid_inventory_state_params';
        }

        console.log({
            newState: params.state.items
        });

        // New state
        const state = params.state;
        if('items' in state) {
            let equal = this.player.game_mode.isCreative();
            const old_items = this.items;
            const new_items = state.items;
            if(!equal) {
                equal = await InventoryComparator.checkEqual(old_items, new_items, params.used_recipes);
            }
            if(equal) {
                // apply new
                this.applyNewItems(new_items, true);
                // send current to player
                this.refresh(true);
                console.log('Applied new state');
                //
                if(this.player.onCrafted) {
                    const rm = await InventoryComparator.getRecipeManager();
                    for(let recipe_id of params.used_recipes) {
                        const recipe = rm.getRecipe(recipe_id);
                        this.player.onCrafted(recipe, {block_id: recipe.result.item_id, count: recipe.result.count});
                    }
                }
            } else {
                // send current to player
                this.refresh(true);
                console.log('Ignore new state');
            }
        }
    }

    // Drop item from hand
    dropItem(data) {
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