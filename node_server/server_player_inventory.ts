import { INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX } from "@client/constant.js";
import {InventoryComparator, IRecipeManager, TUsedRecipe} from "@client/inventory_comparator.js";
import {Inventory, TInventoryState, TInventoryStateChangeMessage} from "@client/inventory.js";
import { ServerClient } from "@client/server_client.js";
import { ServerPlayer } from "./server_player.js";
import type { Player } from "@client/player.js";

export class ServerPlayerInventory extends Inventory {

    //@ts-expect-error
    player: ServerPlayer

    constructor(player : ServerPlayer, state : TInventoryState) {
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

    // Saves the inventory to DB, updates hands, sends the inventory to other players,
    // and optionally sends it to the owner.
    refresh(send_state: boolean): true {
        // Update hands
        this.current.index = isNaN(this.current.index) ? 0 : this.current.index;
        this.current.index2 = isNaN(this.current.index2) ? -1 : this.current.index2;
        this.player.updateHands();
        // Marks that it needs to be saved in DB
        this.markDirty();
        // Send to player
        if(send_state) {
            this.send();
        }
        return true;
    }

    /**
     * @param {Array or Object} new_items - items from the client
     * @param { boolean } mustCheckEqual - if it's true, the change is accepted only if the items
     *   are equal to the existing items, according to {@link InventoryComparator.checkEqual}
     * @param recipeManager - optional, used only if recipes are not null
     * @return true if success
     *
     * @todo make some validation even when {@link mustCheckEqual} === true, e.g. that there are no extra entities.
     */
    sanitizeAndValidateClientItemsChange(
        new_items: (IInventoryItem | null)[],
        mustCheckEqual: boolean,
        used_recipes?: TUsedRecipe[],
        recipeManager?: IRecipeManager,
        thrownItems?: IInventoryItem[]
    ): boolean {
        // sanitize and validate once here. The code everywhere else assumes they at least have valid format, existing ids, etc.
        let errorText = InventoryComparator.sanitizeAndValidateItems(new_items) ?? ''
        if (thrownItems) {
            errorText += InventoryComparator.sanitizeAndValidateItems(thrownItems) ?? ''
        }
        if (errorText.length) {
            if (mustCheckEqual) {
                console.log('Invalid items: ' + errorText)
                return false
            } else {
                this.player.sendError(`!alertError: ` + errorText)
            }
        }
        return mustCheckEqual
            ? InventoryComparator.checkEqual(this.items, new_items, used_recipes, recipeManager, thrownItems)
            : true
    }

    // Игрок прислал новое состояние инвентаря, нужно его провалидировать и применить
    async newState(params: TInventoryStateChangeMessage): Promise<void> {
        try {
            const state = params.state;
            const used_recipes = params.used_recipes;
            if (!state || !state?.items) {
                throw 'error_invalid_inventory_state_params';
            }
            // New state
            if('items' in state) {
                const new_items = state.items;
                const recipeMan = used_recipes?.length &&
                    await InventoryComparator.getRecipeManager(params.recipe_manager_type);
                // The only situation when we don't check equality (which includes applying recipes) is
                // in the creative inventory, where there are no recipes, and the client explicitly asks for it.
                const dontCheckEqual = params.dont_check_equal && !used_recipes?.length && this.player.game_mode.isCreative();
                const changeIsValid = this.sanitizeAndValidateClientItemsChange(new_items, !dontCheckEqual, used_recipes, recipeMan, params.thrown_items);
                if(changeIsValid) {
                    if (params.thrown_items) {
                        const yaw = params.throw_yaw
                        const mergedThrownItems = InventoryComparator.groupToSimpleItems(params.thrown_items).values()
                        for(const item of mergedThrownItems) {
                            this.createDropItem([item], yaw != null, yaw)
                        }
                    }
                    // apply new
                    this.applyNewItems(new_items, true);
                    console.log('New inventory state ... Accepted');
                    // run triggers
                    if(used_recipes && this.player.onCrafted) {
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
        // the state wasn't accepted, or there was an exception
        console.error('New inventory state ... Rejected');
        this.send();
    }

    private createDropItem(items: IInventoryItem[], thrown: boolean, yaw?: float): void {
        const player = this.player
        yaw ??= player.state.rotate.z
        const pos = player.state.pos.clone()
        const velocity = this.temp_vec

        if (thrown) {
            pos.addScalarSelf(0, player.height * .4, 0)
            velocity.set(
                Math.sin(yaw),
                .5,
                Math.cos(yaw)
            ).normSelf()
        } else {
            pos.addScalarSelf(
                -Math.sin(yaw) * .15 + (Math.random() - 0.5) * .5,
                player.height * .4,
                -Math.cos(yaw) * .15 + (Math.random() - 0.5) * .5,
            )
            velocity.set(
                Math.sin(yaw) * .5,
                .5,
                Math.cos(yaw) * .5,
            )
        }
        player.world.createDropItems(player, pos, items, velocity, true)
    }

    // Drop item from hand
    dropCurrentItem(): boolean {
        if(!this.current_item) {
            return false;
        }
        this.createDropItem([{...this.current_item, count: 1}], true)
        if(this.current_item.count == 1) {
            this.setItem(this.current.index, null);
        } else {
            this.decrement(null, true);
        }
        return true;
    }

    // returns true if changed
    moveOrDropFromDragSlot(): boolean {
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
    dropFromDragSlot(): boolean {
        const slot_index = INVENTORY_DRAG_SLOT_INDEX;
        const item = this.items[slot_index];
        if(!item) {
            return false;
        }
        console.log(this.player.state)
        this.createDropItem([item], false)
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