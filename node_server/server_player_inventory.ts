import { INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX } from "../www/src/constant.js";
import { InventoryComparator } from "../www/src/inventory_comparator.js";
import { Inventory } from "../www/src/inventory.js";
import { ServerClient } from "../www/src/server_client.js";
import { ServerPlayer } from "./server_player.js";
import type { Player } from "../www/src/player.js";

export class ServerPlayerInventory extends Inventory {

    //@ts-expect-error
    player: ServerPlayer

    constructor(player : ServerPlayer, state : any) {
        super(player as unknown as Player, state)
    }

    // Marks that the inventory needs to be saved in the next transaction
    markDirty() {
        this.player.dbDirtyFlags |= ServerPlayer.DB_DIRTY_FLAG_INVENTORY;
    }

    send() {
        this.player.world.sendSelected([
            {name: ServerClient.CMD_INVENTORY_STATE, data: this.exportItems()}
        ], this.player);
    }

    // Saves the invenory to DB, updates hands, sends the inventory to other players,
    // and optionally sends it to the owner.
    refresh(send_state) {
        // Update hands
        this.current.index = isNaN(this.current.index) ? 0 : this.current.index;
        this.current.index2 = isNaN(this.current.index2) ? -1 : this.current.index2;
        this.player.updateHands();
        // Marks that it needs to be saved in DB
        this.markDirty();
        // Send for all except player
        this.player.sendNearPlayers();
        // Send to player
        if(send_state) {
            this.send();
        }
        return true;
    }

    /**
     * @param {Array or Object} new_items - items from the client
     * @param { boolean } mustCheckEqual - if it's true, the change is accepted only if the items
     *   are equal to the existing items, accoring to {@link InventoryComparator.checkEqual}
     * @param {Array of objects} used_recipes - optional, see {@link InventoryComparator.checkEqual}
     * @param {RecipeManager} recipeManager - optional, used only if recipes are not null
     * @return { boolean } true if success
     *
     * @todo make some validation even when {@link mustCheckEqual} === true, e.g. that there are no extra entities.
     */
    sanitizeAndValidateClinetItemsChange(new_items, mustCheckEqual, used_recipes, recipeManager) {
        // sanitize and validate once here. The code everywhere else assumes they at least have valid format, existing ids, etc.
        const invalidItem = InventoryComparator.sanitizeAndValidateItems(new_items, undefined, mustCheckEqual, this.player);
        if (invalidItem != null) {
            console.log('Invalid item: ' + JSON.stringify(invalidItem));
            return false;
        }
        if (mustCheckEqual) {
            return InventoryComparator.checkEqual(this.items, new_items, used_recipes, recipeManager);
        }
        return true;
    }

    // Игрок прислал новое состояние инвентаря, нужно его провалидировать и применить
    async newState(params) {
        try {
            const state = params.state;
            const used_recipes = params.used_recipes;
            if (!state || !state?.items || !used_recipes) {
                throw 'error_invalid_inventory_state_params';
            }
            // New state
            if('items' in state) {
                const new_items = state.items;
                const recipeMan = used_recipes.length &&
                    await InventoryComparator.getRecipeManager(params.recipe_manager_type);
                // The only situation when we don't check equality (which includes applying recipes) is
                // in the creative inventory, where there are no recipes, and the client explicitly asks for it.
                const dontCheckEqual = params.dont_check_equal && used_recipes.length === 0 && this.player.game_mode.isCreative();
                const changeIsValid = this.sanitizeAndValidateClinetItemsChange(new_items, !dontCheckEqual, used_recipes, recipeMan);
                if(changeIsValid) {
                    // apply new
                    this.applyNewItems(new_items, true);
                    console.log('New inventory state ... Accepted');
                    // run triggers
                    if(this.player.onCrafted) {
                        for(let used_recipe of used_recipes) {
                            // we know the recipe exists, because it was successfully applied and validated
                            const recipe = recipeMan.getRecipe(used_recipe.recipe_id);
                            this.player.onCrafted(recipe, used_recipe.onCraftedData);
                        }
                    }
                    return; // the state is accepted, don't send anything to the player
                }
            }
        } catch (e) {
            console.log(e);
        }
        // the sate wasn't accpted, or there was an exception
        console.error('New inventory state ... Rejected');
        this.send();
    }

    // Drop item from hand
    dropItem() {
        if(!this.current_item) {
            return false;
        }
        const item = {...this.current_item, count: 1};
        const pos = this.player.state.pos.clone().addScalarSelf(0, this.player.height * .4, 0);
        // Add velocity for drop item
        this.temp_vec.set(
            Math.sin(this.player.state.rotate.z),
            .5,
            Math.cos(this.player.state.rotate.z),
        ).normSelf();
        this.player.world.createDropItems(this.player, pos, [item], this.temp_vec);
        if(this.current_item.count == 1) {
            this.setItem(this.current.index, null);
        } else {
            this.decrement(null, true);
        }
        return true;
    }

    // returns true if changed
    moveOrDropFromDragSlot() {
        const drag_item = this.items[INVENTORY_DRAG_SLOT_INDEX];
        if (!drag_item) {
            return false;
        }
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
            if (!this.items[i]) {
                this.items[i] = drag_item;
                this.items[INVENTORY_DRAG_SLOT_INDEX] = null;
                return true;
            }
        }
        return this.dropFromDragSlot();
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

    writeToWorldTransaction(underConstruction) {
        underConstruction.updatePlayerInventory.push([
            this.player.session.user_id,
            JSON.stringify(this.exportItems())
        ]);
    }

}