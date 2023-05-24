import {ChestHelpers, isBlockRoughlyWithinPickatRange, TChestSlots} from "@client/block_helpers.js";
import { ServerClient } from "@client/server_client.js";
import { BLOCK } from "@client/blocks.js";
import { InventoryComparator } from "@client/inventory_comparator.js";
import {CHEST_INTERACTION_MARGIN_BLOCKS, CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD, DEFAULT_CHEST_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX} from "@client/constant.js";
import {Inventory, InventorySize, ItemsCollection} from "@client/inventory.js";
import { Treasure_Sets } from "./treasure_sets.js";
import type { TBlock } from "@client/typed_blocks3.js";
import type { Vector } from "@client/helpers.js";
import {ArrayHelpers, ObjectHelpers} from "@client/helpers.js";
import type { ServerWorld } from "../server_world.js";
import type { ServerPlayer } from "../server_player.js";
import {CHEST_CHANGE, TChestChange, TChestConfirmData, TCmdChestContent} from "@client/chest.js";
import type {ServerChunk} from "../server_chunk.js";

const CHANGE_RESULT_FLAG_CHEST = 1;
const CHANGE_RESULT_FLAG_SECOND_CHEST = 2;
const CHANGE_RESULT_FLAG_INVENTORY = 4;

export class WorldChestManager {
    world: ServerWorld;
    treasure_sets: Treasure_Sets;

    constructor(world: ServerWorld) {
        this.world = world;
        this.treasure_sets = new Treasure_Sets(world, config.treasure_chests)
    }

    /**
     * Returns a valid chest by pos, or throws an exception.
     * Optionally, it can return null if the chunk is missing.
     * @param nullIfNotLoaded - if it's true and the chunk is missing,
     *      then instead of throwing an exception, it returns null. The default is false.
     * @returns chest
     */
    get(pos: Vector, nullIfNotLoaded = false): TBlock | null {
        const tblock = this.world.getBlock(pos);
        if(!tblock || tblock.id < 0) {
            if(nullIfNotLoaded) {
                return null;
            } else {
                throw `error_chest_not_found|${pos.x},${pos.y},${pos.z}`;
            }
        }
        if(!tblock.material?.chest || !tblock.extra_data) {
            throw 'error_block_is_not_chest';
        }
        if(tblock.extra_data.generate) {
            this.generateChest(tblock, pos);
        }
        return tblock;
    }

    getChestOrError(pos: IVector): [chest: TBlock | null, error: string | null] {
        const tblock = this.world.getBlock(pos);
        if (!tblock || tblock.id < 0) {
            return [null, `error_chest_not_found|${pos.x},${pos.y},${pos.z}`];
        }
        if (!tblock.material?.chest || !tblock.extra_data) {
            return [null, 'error_block_is_not_chest'];
        }
        if (tblock.extra_data.generate) {
            this.generateChest(tblock, pos);
        }
        return [tblock, null];
    }

    /**
     * Общий алгоритм:
     * - проверяет корректность разных условий (например, наличие сундуков)
     * - применяет изменное состояние инвентаря - все до последнего
     * - воспроизводит действие, описанное клиентом, над серверыми данными
     * - сравнивает результат с тем, что ожидает клиент
     * - рассылает изменение игрокам и сохраняет в БД
     */
    async confirmPlayerAction(player: ServerPlayer, params: TChestConfirmData): Promise<void> {

        function combineChests(chest: TChestSlots, secondChest: TChestSlots | null): Dict<IInventoryItem> {
            if (secondChest == null) {
                return chest.slots;
            }
            const result = { ...chest.slots }
            for(let k in secondChest.slots) {
                const ki = parseInt(k)
                result[ki + DEFAULT_CHEST_SLOT_COUNT] = secondChest.slots[k]
            }
            return result;
        }

        function onBeforeExit(): void {
            if (params.requestId != null) { // если клиент ждет ответа - ответить (даже если данные сундука не были высланы)
                player.sendPackets([{
                    name: ServerClient.CMD_CHEST_CHANGE_PROCESSED,
                    data: {
                        chestSessionId: params.chestSessionId,
                        requestId:      params.requestId
                    }
                }])
            }
        }

        let error: string | null = null;
        let forceClose = false;
        let changeApplied = 0;
        const change = params.change

        // получить и проверить блок 1-го сундука
        const pos = params.chest.pos
        const [tblock, err] = this.getChestOrError(pos);
        const is_ender_chest = tblock?.material.name === 'ENDER_CHEST'
        if (tblock == null) {
            error = err;
            forceClose = true;
        }

        // получить и проверить блок 2-го сундука
        let secondPos: IVector | null = null;
        let secondTblock: TBlock | null = null;
        if (params.secondChest) {
            secondPos = params.secondChest.pos;
            [secondTblock, error] = this.getChestOrError(secondPos);
            if (secondTblock == null || secondTblock.material.name !== 'CHEST') {
                error ??= 'error_block_is_not_chest';
                forceClose = true;
            }
            // if there are 2 chests, they must be of type CHEST, and touch each other
            if (tblock) {
                // We don't check if the halves match, because even if they don't, there
                // is no reason to cancel the action. We only check that they're both
                // non-ender chests near each other.
                if (tblock.material.name !== 'CHEST') {
                    error = 'error_chest_not_found';
                    forceClose = true;
                }
                forceClose ||= tblock.posworld.distanceSqr(secondPos) !== 1;
            }
        }

        // check the distance to the chests
        if (!isBlockRoughlyWithinPickatRange(player,
            CHEST_INTERACTION_MARGIN_BLOCKS + CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD,
            pos, secondPos)
        ) {
            error = 'error_chest_too_far';
            forceClose = true;
        }

        /* Не удалять код - возможно, фича пригодится

        // Если игрок хочет сортировать не-ender сундук, то не делать этого, если сундук открыт у других игроков.
        // Это чтобы избежать резких изменений у других игроков, которые вероятно сорвут их текущее действие с сундуком.
        // Не выполнить сортировку у текущего игрока - меньшее зло.
        if (change.type === CHEST_CHANGE.SORT && !is_ender_chest && this.findPlayers(tblock, [player.userId]).length) {
            player.sendError('error_sort_chest_other_players')
            return onBeforeExit()
        }
        */

        // Проверить предметы которые по мнению клиента должны получиться после изменения
        if (InventoryComparator.sanitizeAndValidateItems(params.inventory_slots, true)) {
            error = 'error_incorrect_value';
        }

        // Разрешить клиенту свободно прекладывать инвентарь до изменения связанного с сундуками.
        // Проверить и принять состояние инвентаря до изменения.
        // В случае CHEST_CHANGE.SORT, вместо этого мы применяем текущее значение инвентаря
        const appliedInventory = change.type === CHEST_CHANGE.SORT
            ? params.inventory_slots
            : change.prevInventory
        if (appliedInventory) {
            try {
                const changeIsValid = player.inventory.sanitizeAndValidateClientItemsChange(appliedInventory, true)
                if(changeIsValid) {

                    // TODO здесь возможно предметы в недоступных слотах, это не проверяется.
                    // Проблема: драг слот может быть непустым. Это не очень страшно - фиксится при загрузке.

                    // apply new
                    player.inventory.applyNewItems(appliedInventory, false);
                } else {
                    error = 'error_inventory_mismatch';
                }
            } catch (e) {
                console.log(e);
                error = 'error_inventory_mismatch';
            }
        }

        // sanitize and validate the other items
        if (InventoryComparator.sanitizeAndValidateItems(params.chest.slots, false) ||
            InventoryComparator.sanitizeAndValidateItems(
                [params.change.slotPrevItem, params.change.dragPrevItem], true)
        ) {
            error = 'error_incorrect_value';
        }

        if (forceClose || error) {
            player.inventory.fixTemporarySlots();
            player.inventory.refresh(true);
            if (forceClose) {
                player.currentChests = null;
                player.sendPackets([{
                    name: ServerClient.CMD_CHEST_FORCE_CLOSE,
                    data: { chestSessionId: params.chestSessionId }
                }]);
            } else {
                // the player doesn't close the window, but he has some mismatch, so send him also the correct chests
                this.sendContentToPlayers([player], tblock);
                if (secondTblock) {
                    this.sendContentToPlayers([player], secondTblock);
                }
            }
            onBeforeExit()
            throw error || 'error_incorrect_value';
        }

        // update the current chests for this player
        player.currentChests = [pos, secondPos].filter(it => it != null);

        let chest: TChestSlots
        if (is_ender_chest) {
            chest = await player.loadEnderChest();
        } else {
            chest = tblock.extra_data;
            chest.slots ??= {};
        }

        let secondChest: TChestSlots | null = null
        if (secondTblock) {
            secondChest = secondTblock.extra_data;
            secondChest.slots ??= {};
        }

        const chestSlotsCount = secondTblock
            ? 2 * DEFAULT_CHEST_SLOT_COUNT
            : tblock.properties.chest.slots;
        const inputChestSlotsCount = chestSlotsCount - tblock.properties.chest.readonly_slots;

        let srvCombinedChestSlots = combineChests(chest, secondChest);
        let cliCombinedChestSlots = combineChests(params.chest, params.secondChest);

        const oldSimpleInventory = InventoryComparator.groupToSimpleItems(player.inventory.items);
        changeApplied |= this.applyClientChange(srvCombinedChestSlots, cliCombinedChestSlots,
                player.inventory.items, params.inventory_slots, params.change, player,
                inputChestSlotsCount, secondPos != null);
        const inventoryEqual = InventoryComparator.listsExactEqual(
                player.inventory.items, params.inventory_slots);

        // TODO remove these checks if/when the bug is found
        let zeroCountErr = Inventory.fixZeroCount(srvCombinedChestSlots);
        if (zeroCountErr) {
            player.sendError(`!alert${zeroCountErr} in server chest after change type=${params.change.type}`);
        }
        zeroCountErr = Inventory.fixZeroCount(player.inventory.items);
        if (zeroCountErr) {
            player.sendError(`!alert${zeroCountErr} in server inventory after change type=${params.change.type}`);
        }

        if (changeApplied & CHANGE_RESULT_FLAG_INVENTORY) {
            // Notify the player only if the inventory change result differs from expected.
            player.inventory.refresh(!inventoryEqual);
            // Check if new quest items were added. It triggers for the dragged item too.
            const newSimpleInventory = InventoryComparator.groupToSimpleItems(player.inventory.items);
            const put_items = [];
            for(let [key, item] of newSimpleInventory) {
                if (!oldSimpleInventory.get(key)) {
                    put_items.push(item);
                }
            }
            for(let item of put_items) {
                player.onPutInventoryItems({block_id: item.id});
            }
        } else {
            // Notify the player that the inventory change failed.
            if (!inventoryEqual) {
                player.inventory.send();
            }
        }

        const clientChestResultMatches = InventoryComparator.listsExactEqual(srvCombinedChestSlots, cliCombinedChestSlots)

        // Игрок, которому не шлются изменения.
        // Если сундук публичный - надо послать и своему игроку, чтобы переписать возможные более ранние апдейты от тикеров
        const exceptPlayer = ChestHelpers.isPublic(tblock.material) ? null : player
        let firstSentToPlayer = false
        let secondSentToPlayer = false
        // сохранить и разослать игрокам изменения
        if (changeApplied & CHANGE_RESULT_FLAG_CHEST) {
            if (secondPos) {
                // uncombine 1st chest
                chest.slots = {};
                for(let i = 0; i < DEFAULT_CHEST_SLOT_COUNT; i++) {
                    const item = srvCombinedChestSlots[i];
                    if (item) {
                        chest.slots[i] = item;
                    }
                }
            }
            // Сохранить в БД и послать остальным (и возможно этому) игроку
            if (is_ender_chest) {
                player.setEnderChest(chest);
            } else {
                // Notify the other players about the chest change
                this.world.saveSendExtraData(tblock, exceptPlayer)
            }
            firstSentToPlayer = !exceptPlayer
        }
        if (changeApplied & CHANGE_RESULT_FLAG_SECOND_CHEST) {
            // uncombine 2nd chest
            secondChest.slots = {};
            for(let i = 0; i < DEFAULT_CHEST_SLOT_COUNT; i++) {
                const item = srvCombinedChestSlots[i + DEFAULT_CHEST_SLOT_COUNT];
                if (item) {
                    secondChest.slots[i] = item;
                }
            }
            // Сохранить в БД и послать остальным (и возможно этому) игроку
            this.world.saveSendExtraData(secondTblock, exceptPlayer)
            secondSentToPlayer = !exceptPlayer
        }

        // После того, как изменения применены к сундукам в мире (это имеет значения для парных сундуков)
        // послать их клиенту, если результат отличается, и ему еще не высылали
        if (!clientChestResultMatches) {
            if (!firstSentToPlayer) {
                this.sendContentToPlayers([player], tblock)
            }
            // Send both chests, even if only one differs. It's rare and doesn't matter.
            if (secondTblock && !secondSentToPlayer) {
                this.sendContentToPlayers([player], secondTblock)
            }
        }
        onBeforeExit()
    }

    // Validates the client change to a chest/inventory, and tries to apply it on the server
    applyClientChange(srvChest: Dict<IInventoryItem>, cliChest: Dict<IInventoryItem>,
        srvInv: (IInventoryItem | null)[], cliInv: (IInventoryItem | null)[],
        change: TChestChange, player: ServerPlayer, inputChestSlotsCount: int, twoChests: boolean
    ): int {

        function chestResultFlag(index: int): int {
            return twoChests && index >= DEFAULT_CHEST_SLOT_COUNT
                ? CHANGE_RESULT_FLAG_SECOND_CHEST
                : CHANGE_RESULT_FLAG_CHEST;
        }

        function resultFlag(index: int, isChest: boolean): int {
            return isChest ? chestResultFlag(index) : CHANGE_RESULT_FLAG_INVENTORY;
        }

        function updateSlot(index: int, inChest: boolean, delta = 0, similarSlot = null): void {
            let slot = inChest ? srvChest[index] : srvInv[index];
            if (delta > 0) {
                if (slot == null) {
                    slot = {
                        ...similarSlot,
                        count: 0
                    };
                    if (inChest) {
                        srvChest[index] = slot;
                    } else {
                        srvInv[index] = slot;
                    }
                }
                slot.count += delta;
            } else {
                slot.count += delta;
                if (slot.count <= 0) {
                    if (inChest) {
                        delete srvChest[index];
                    } else {
                        srvInv[index] = null;
                    }
                }
            }
            resultFlags |= resultFlag(index, inChest);
        }

        /**
         * Adds the source item to compatible item stacks or free places.
         * Subtracts from the source item's count. Updates the result flags.
         * @param slot - the source item
         * @param targetIsChest - whether it should be added to the chest, or to the inventory
         * @return the result flags
         */
        function spreadToList(slot: IInventoryItem, targetIsChest: boolean): int {
            const maxStack = BLOCK.getItemMaxStack(slot)
            let list: Dict<IInventoryItem> | (IInventoryItem | null)[]
            let size = new InventorySize()
            if (targetIsChest) {
                list = srvChest
                size.setFake(inputChestSlotsCount)
            } else {
                list = srvInv
                size.calc(srvInv, that.world.block_manager)
            }
            if (maxStack > 1) {
                // add to existing input slots
                for(const i of size.bagIndices()) {
                    const s = list[i];
                    if (s && InventoryComparator.itemsEqualExceptCount(slot, s) && s.count < maxStack) {
                        const c = Math.min(maxStack - s.count, slot.count);
                        s.count += c;
                        slot.count -= c;
                        resultFlags |= resultFlag(i, targetIsChest);
                        if (slot.count == 0) {
                            return;
                        }
                    }
                }
            }
            // move to a new slot
            for(const i of size.backpackHotbarIndices()) {
                if (list[i] == null) {
                    list[i] = { ...slot };
                    slot.count = 0;
                    resultFlags |= resultFlag(i, targetIsChest);
                    return;
                }
            }
        }

        const that = this
        let resultFlags = 0

        // сортируем сундук(и)
        if (change.type === CHEST_CHANGE.SORT) {
            const chestArr = ObjectHelpers.toArray(srvChest)
            const chestArrCopy = ObjectHelpers.deepClone(chestArr, 2) // клонируем на глубину 2 чтобы сохранить количество
            const itemsCollection = new ItemsCollection(chestArr, this.world.block_manager)
            itemsCollection.autoSort(0, chestArr.length)
            // найти какие из сукндуков изменились
            for(let i = 0; i < chestArr.length; i++) {
                if (!InventoryComparator.itemsEqual(chestArr[i], chestArrCopy[i])) {
                    resultFlags |= resultFlag(i, true)
                }
            }
            if (resultFlags) {
                ArrayHelpers.toObject(chestArr, srvChest)
            }
            return resultFlags
        }

        const srvDrag = srvInv[INVENTORY_DRAG_SLOT_INDEX];
        const cliDrag = cliInv[INVENTORY_DRAG_SLOT_INDEX];

        // a result for successful changes except merging small stacks
        const defaultResult = change.slotInChest
            ? chestResultFlag(change.slotIndex) | CHANGE_RESULT_FLAG_INVENTORY
            : CHANGE_RESULT_FLAG_INVENTORY;

        let srvSlot;
        let cliSlot;
        if (change.slotInChest) {
            srvSlot = srvChest[change.slotIndex];
            cliSlot = cliChest[change.slotIndex];
        } else {
            srvSlot = srvInv[change.slotIndex];
            cliSlot = cliInv[change.slotIndex];
        }
        const prevCliSlot = change.slotPrevItem;
        const prevCliDrag = change.dragPrevItem;

        const cliSlotCount = cliSlot?.count || 0;
        const srvSlotCount = srvSlot?.count || 0;
        const cliDragCount = cliDrag?.count || 0;
        const srvDragCount = srvDrag?.count || 0;
        const prevCliSlotCount = prevCliSlot?.count || 0;
        const prevCliDragCount = prevCliDrag?.count || 0;
        const slotDelta = cliSlotCount - prevCliSlotCount;
        const dragDelta = cliDragCount - prevCliDragCount;

        if (change.type === CHEST_CHANGE.MERGE_SMALL_STACKS) { // Gives the same result as in base_craft_window.js: this.onDrop = function(e)
            if (!cliDrag || !prevCliDrag ||
                !InventoryComparator.itemsEqualExceptCount(cliDrag, prevCliDrag) ||
                cliDragCount <= prevCliDragCount
            ) {
                return 0; // incorrect change
            }
            if (!srvDrag || !InventoryComparator.itemsEqualExceptCount(cliDrag, srvDrag)) {
                return 0; // it can't be applied on server
            }
            const maxStack = BLOCK.getItemMaxStack(cliDrag);
            let need_count = maxStack - srvDrag.count;
            if (need_count <= 0) {
                return 0;
            }
            const list = [];
            for(let i in srvChest) {
                const item = srvChest[i];
                if (InventoryComparator.itemsEqualExceptCount(item, cliDrag)) {
                    list.push({chest: 1, index: parseFloat(i), item: item});
                }
            }
            const invSize = new InventorySize().calc(srvInv, this.world.block_manager)
            for(const i of invSize.backpackHotbarIndices()) {
                const item = srvInv[i];
                if (item && InventoryComparator.itemsEqualExceptCount(item, cliDrag)) {
                    list.push({chest: 0, index: i, item: item});
                }
            }
            list.sort(function(a, b){
                let t = a.item.count - b.item.count;
                if (t != 0) {
                    return t;
                }
                return (a.index - b.index) - 1000 * (a.chest - b.chest);
            });
            for (let v of list) {
                if (need_count == 0) {
                    break;
                }
                const item = v.item;
                let minus_count = item.count < need_count ? item.count : need_count;
                need_count -= minus_count;
                srvDrag.count += minus_count;
                resultFlags |= CHANGE_RESULT_FLAG_INVENTORY;
                updateSlot(v.index, v.chest, -minus_count);
            }
            return resultFlags;
        }

        // Должно давать такой же резулльтат, как TableDataSlot.appendToList
        if (change.type === CHEST_CHANGE.SHIFT_SPREAD) {
            if (!prevCliSlot) {
                return 0; // incorrect change
            }
            if (!srvSlot || !InventoryComparator.itemsEqualExceptCount(prevCliSlot, srvSlot)) {
                return 0; // it can't be applied on server
            }
            spreadToList(srvSlot, !change.slotInChest);
            if (!resultFlags) {
                return 0;
            }
            updateSlot(change.slotIndex, change.slotInChest);
            return resultFlags;
        }

        if (change.type !== CHEST_CHANGE.SLOTS) {
            return 0;
        }
        if (cliDrag && cliSlot && !InventoryComparator.itemsEqualExceptCount(cliDrag, cliSlot)) { // swapped items
            if (!InventoryComparator.itemsEqual(prevCliSlot, cliDrag) ||
                !InventoryComparator.itemsEqual(prevCliDrag, cliSlot) ||
                change.slotInChest && change.slotIndex >= inputChestSlotsCount
            ) {
                return 0; // incorrect change
            }
            // we can swap if the ids on the server are the same, regardless of the quantity
            if (!srvSlot || !InventoryComparator.itemsEqualExceptCount(srvSlot, prevCliSlot) ||
                !srvDrag || !InventoryComparator.itemsEqualExceptCount(srvDrag, prevCliDrag)
            ) {
                return 0; // it can't be applied on server
            }
            // swap
            const srvContainer = change.slotInChest ? srvChest : srvInv;
            srvContainer[change.slotIndex] = srvDrag;
            srvInv[INVENTORY_DRAG_SLOT_INDEX] = srvSlot;
            return defaultResult;
        } else if (cliDrag && prevCliSlot && slotDelta < 0) { // take from a slot
            const maxStack = BLOCK.getItemMaxStack(cliDrag);
            if (cliSlot && !InventoryComparator.itemsEqualExceptCount(cliSlot, cliDrag) ||
                !InventoryComparator.itemsEqualExceptCount(prevCliSlot, cliDrag) ||
                prevCliDrag && !InventoryComparator.itemsEqualExceptCount(prevCliDrag, cliDrag) ||
                slotDelta !== -dragDelta ||
                cliDrag.count > maxStack
            ) {
                return 0; // incorrect change
            }
            if (!srvSlot || !InventoryComparator.itemsEqualExceptCount(srvSlot, cliDrag) ||
                srvDrag && !InventoryComparator.itemsEqualExceptCount(srvDrag, cliDrag)
            ) {
                return 0; // it can't be applied on server
            }
            const delta = Math.min(Math.min(dragDelta, maxStack - srvDragCount), srvSlotCount);
            if (delta <= 0) {
                return 0;
            }
            // apply on the server
            updateSlot(INVENTORY_DRAG_SLOT_INDEX, false, delta, srvSlot);
            updateSlot(change.slotIndex, change.slotInChest, -delta, srvSlot);
            return defaultResult;
        } else if (prevCliDrag && cliSlot && slotDelta > 0) { // put into a slot
            const maxStack = BLOCK.getItemMaxStack(cliSlot);
            if (prevCliSlot && !InventoryComparator.itemsEqualExceptCount(prevCliSlot, cliSlot) ||
                cliDrag && !InventoryComparator.itemsEqualExceptCount(cliDrag, cliSlot) ||
                !InventoryComparator.itemsEqualExceptCount(prevCliDrag, cliSlot) ||
                slotDelta !== -dragDelta ||
                cliSlot.count > maxStack ||
                change.slotInChest && change.slotIndex >= inputChestSlotsCount
            ) {
                return 0; // incorrect change
            }
            if (srvSlot && !InventoryComparator.itemsEqualExceptCount(srvSlot, cliSlot) ||
                !srvDrag || !InventoryComparator.itemsEqualExceptCount(srvDrag, cliSlot)
            ) {
                return 0; // it can't be applied on server
            }
            const delta = Math.min(Math.min(slotDelta, maxStack - srvSlotCount), srvDragCount);
            if (delta <= 0) {
                return 0;
            }
            // apply on the server
            updateSlot(change.slotIndex, change.slotInChest, delta, srvDrag);
            updateSlot(INVENTORY_DRAG_SLOT_INDEX, false, -delta, srvDrag);
            return defaultResult;
        }
        return 0; // some incorrect case of CHEST_CHANGE.SLOTS
    }

    /**
     * Послылает данные блока игрокам. Особо обрабатывает сундуки.
     * Если это ENDER CHEST, то считает что он уже загружен этими игроками (иначе эта функция не должна была вызываться).
     */
    sendContentToPlayers(players: ServerPlayer[], tblock: TBlock): void {
        if(!tblock || tblock.id < 0 || players.length === 0) {
            return
        }
        const mat = tblock.material;
        if(mat.name == 'ENDER_CHEST') {
            for(let player of players) {
                if (!player.ender_chest) {
                    continue
                }
                const chest: TCmdChestContent = {
                    pos:            tblock.posworld,
                    slots:          player.ender_chest.slots,
                    state:          tblock.extra_data.state
                }
                player.sendPackets([{
                    name: ServerClient.CMD_CHEST_CONTENT,
                    data: chest
                }])
            }
        } else if (mat.chest?.private) {
            const extra_data = tblock.extra_data
            if(!extra_data || !extra_data.slots) {
                return
            }
            const chest: TCmdChestContent = {
                pos:    tblock.posworld,
                slots:  extra_data.slots,
                state:  extra_data.state
            }
            const packets = [{
                name: ServerClient.CMD_CHEST_CONTENT,
                data: chest
            }]
            for(const player of players) {
                player.sendPackets(packets)
            }
        } else {
            const packets = [{
                name: ServerClient.CMD_BLOCK_SET,
                data: {
                    pos: tblock.posworld,
                    item: {
                        id:         tblock.id,
                        extra_data: tblock.extra_data,
                        rotate:     tblock.rotate
                    }
                }
            }]
            for(const player of players) {
                player.sendPackets(packets)
            }
        }
    }

    async loadAndSendToPlayers(player: ServerPlayer, tblock: TBlock): Promise<boolean> {
        const mat = tblock.material
        if (!mat.chest) {
            return false
        }
        if (mat.name == 'ENDER_CHEST') {
            await player.loadEnderChest()
        }
        this.sendContentToPlayers([player], tblock)
        return true
    }

    /**
     * Находит всех игроков, которым нужно слать содержимое указанного блока (сундука или обычного),
     * за исключением {@link except_player}.
     */
    findPlayers(tblock: TBlock, except_player?: ServerPlayer): ServerPlayer[] {
        const players = []
        const chunk: ServerChunk = tblock.chunk
        const pos = tblock.posworld
        const isPrivate = tblock.material.chest?.private
        for(let p of chunk.connections.values()) {
            if (p === except_player) {
                continue
            }
            if (isPrivate) {
                if (!p.currentChests) {
                    continue
                }
                const ind = p.currentChests.findIndex((it) => pos.equal(it))
                if (ind < 0) {
                    continue
                }
                if (!isBlockRoughlyWithinPickatRange(p,
                    CHEST_INTERACTION_MARGIN_BLOCKS + CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD,
                    pos)
                ) {
                    p.currentChests.splice(ind, 1)
                    continue
                }
            }
            players.push(p)
        }
        return players
    }

    // Generate chest
    private generateChest(tblock: TBlock, pos: IVector): void {
        const extra_data = tblock.extra_data
        extra_data.can_destroy = false
        extra_data.slots = this.treasure_sets.generateSlots(pos, extra_data.params.source, DEFAULT_CHEST_SLOT_COUNT)
        delete extra_data.generate
        this.world.saveSendExtraData(tblock)
    }

}