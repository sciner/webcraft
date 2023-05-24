import {ArrayOrMap, Helpers, ObjectHelpers} from "./helpers.js";
import {PAPERDOLL_BACKPACK, PAPERDOLL_BOOTS, PAPERDOLL_LEGGINGS, PAPERDOLL_CHESTPLATE, PAPERDOLL_HELMET, BAG_LENGTH_MIN,
    BAG_LENGTH_MAX, HOTBAR_LENGTH_MAX, HOTBAR_LENGTH_MIN, PAPERDOLL_CONTAINERS_SLOTS, INVENTORY_DRAG_SLOT_INDEX,
    INVENTORY_SLOT_COUNT, PAPERDOLL_MIN_INDEX, PAPERDOLL_END, INVENTORY_CRAFT_END, INVENTORY_CRAFT_INDEX_MIN
} from "./constant.js";
import { BLOCK } from "./blocks.js"
import {InventoryComparator, TItemNeedsCount, TUsedRecipe} from "./inventory_comparator.js";
import type { ArmorState, Player } from "./player.js";
import type {PlayerInventory} from "./player_inventory.js";

type TInventoryCurrentIndices = {
    /** Индекс выбранного в правой руке в хотбаре */
    index: int
    /**
     * Индекс выбранного в левой руке.
     *
     * Судя по коду в {@link setIndexes} может указывать и на сумку (?)
     */
    index2: int
}

/** A parameter used in the inventory constructors */
export type TInventoryState = {
    current: TInventoryCurrentIndices
    items: (IInventoryItem | null)[]
}

export type TInventoryStateChangeParams = {
    used_recipes?: TUsedRecipe[]
    recipe_manager_type?: string
    thrown_items?: IInventoryItem[] | null
    throw_yaw?: float
    delete_items?: IInventoryItem[] | null
    dont_check_equal?: boolean
    forget_chests?: boolean // если true, то сервер заывает сундуки, с которыми работал игрок
    allow_temporary?: boolean    // если true, то временные и несуществующие слоты не очищаются при отправке
}

export type TInventoryStateChangeMessage = {
    state: TInventoryState
} & TInventoryStateChangeParams

/**
 * Представляет переменный размер инвентаря, зависящий от надетых предметов.
 * Умеет вычисялть размер по списку предметов, проверять корректность индексов слотов, и итерировать их.
 * Также может использоваться для простых массивов предметов любого размера (не инвентаря), чтобы выполнять
 * над ними те же алгоритмы, что над инвентарем.
 *
 * Названия групп слотов:
 * - hotbar
 * - backpack (рюкзак) - обычные слоты, не входящие в hotbar
 * - bag (сумка) - все обычные слоты (hotbar + backpack)
 *
 * Почему это отдельный класс, а не часть часть {@link Inventory}: он бывает нужен отдельно от
 * {@link Inventory} для валидации списка предметов.
 */
export class InventorySize {

    /**
     * Номер последнего слота в рюкзаке (не включительно).
     * Оно же - обще число слотов в хотбаре и рюкзаке, включая дыры между ними.
     */
    bagEnd: int

    /** Размер хотбара = номер максимального слота в хотбаре (не включительно) */
    hotbar: int

    /**
     * Если true, то это размер не инвентаря, а просто какого-то массива предметов (например, сундука).
     * В этом случае не все методы имеют смысл, но итерация сумки работает.
     */
    protected fake: boolean

    /** Вычисляет (обновляет) размер рюкзака с учетом наетых предметов */
    calc(items: (IInventoryItem | null)[], block_manager: typeof BLOCK): this {
        this.fake = false
        let bag = BAG_LENGTH_MIN
        this.hotbar = HOTBAR_LENGTH_MIN
        for (const slot_index of PAPERDOLL_CONTAINERS_SLOTS) {
            if (items[slot_index]) {
                const extra_data = block_manager.fromId(items[slot_index].id)?.extra_data
                bag         += extra_data?.slot ?? 0
                this.hotbar += extra_data?.hotbar ?? 0
            }
        }
        this.bagEnd = Math.min(bag, BAG_LENGTH_MAX) + HOTBAR_LENGTH_MAX
        this.hotbar = Math.min(this.hotbar, HOTBAR_LENGTH_MAX)
        return this
    }

    /**
     * Устанавлиает размер как будто есть {@link length} слотов без дыр.
     * Это не для инвентаря, а для других простых коллкций предметов.
     */
    setFake(length: int): this {
        this.fake = true
        this.bagEnd = length
        this.hotbar = Math.min(length, HOTBAR_LENGTH_MAX)
        return this
    }

    /** Число предметов в (хотбаре + рюкзаке) */
    get bagSize(): int { return this.bagEnd - (HOTBAR_LENGTH_MAX - this.hotbar) }

    slotExists(index: int): boolean {
        return index < this.bagEnd // быстрая проверка - слот в сумке или специальных слотах
            ? index >= HOTBAR_LENGTH_MAX || (index >= 0 && index < this.hotbar)
            :   (index >= PAPERDOLL_MIN_INDEX && index < PAPERDOLL_END) ||
                (index >= INVENTORY_CRAFT_INDEX_MIN && index < INVENTORY_CRAFT_END) ||
                index === INVENTORY_DRAG_SLOT_INDEX
    }

    /** @return true если слот существует в сумке */
    bagSlotExists(index: int): boolean {
        return (index >= HOTBAR_LENGTH_MAX && index < this.bagEnd) || (index >= 0 && index < this.hotbar)
    }

    /** Возвращет true если число общее слотов и занятые слоты коректны. Не проверяет корректность данных в слотах. */
    slotsValid(items: (IInventoryItem | null)[]): boolean {
        if (items.length !== INVENTORY_SLOT_COUNT) {
            return false
        }
        for(let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
            if (items[i] && !this.slotExists(i)) {
                return false
            }
        }
        return true
    }

    /** Итерирует индексы существующих слотов хотбара и рюкзака */
    *bagIndices(): IterableIterator<int> {
        for(let i = 0; i < this.hotbar; i++) {
            yield i
        }
        for(let i = HOTBAR_LENGTH_MAX; i < this.bagEnd; i++) {
            yield i
        }
    }

    /** Как {@link bagIndices}, но если это реальный инвентарь, то перебирает сначала рюкзак, потом хотбар. */
    *backpackHotbarIndices(): IterableIterator<int> {
        if (this.fake) {
            for(let i = 0; i < this.bagEnd; i++) {
                yield i
            }
        } else {
            for(let i = HOTBAR_LENGTH_MAX; i < this.bagEnd; i++) {
                yield i
            }
            for(let i = 0; i < this.hotbar; i++) {
                yield i
            }
        }
    }

    /** Итерирует индексы несуществующих слотов */
    *invalidIndices(length = INVENTORY_SLOT_COUNT): IterableIterator<int> {
        for(let i = this.hotbar; i < HOTBAR_LENGTH_MAX; i++) {
            yield i
        }
        for(let i = this.bagEnd; i < PAPERDOLL_MIN_INDEX; i++) {
            yield i
        }
        for(let i = PAPERDOLL_END; i < INVENTORY_DRAG_SLOT_INDEX; i++) {
            yield i
        }
        for(let i = INVENTORY_DRAG_SLOT_INDEX + 1; i < INVENTORY_CRAFT_INDEX_MIN; i++) {
            yield i
        }
        for(let i = INVENTORY_CRAFT_END; i < length; i++) {
            yield i
        }
    }

    *craftIndices(): IterableIterator<int> {
        for(let i = INVENTORY_CRAFT_INDEX_MIN; i < INVENTORY_CRAFT_END; i++) {
            yield i
        }
    }

    /** Итерирует индексы временных слотов (драг и крафт слота) */
    *temporaryIndices(): IterableIterator<int> {
        yield INVENTORY_DRAG_SLOT_INDEX
        yield *this.craftIndices()
    }

    /**
     * Совместно {@link invalidIndices} и {@link temporaryIndices}
     * Первым - дрвг слот, т.к. премет оставшийся в нем в нем наиболее заметен игроку.
     */
    *invalidAndTemporaryIndices(length = INVENTORY_SLOT_COUNT): IterableIterator<int> {
        yield INVENTORY_DRAG_SLOT_INDEX
        yield *this.invalidIndices(length)
        yield *this.craftIndices()
    }
}

/**
 * Коллекция предметов, над которой можно производить действия (сортировка, добвление, и т.п.)
 * Например: инвентарь, сундук, просто массив полученный откудато.
 */
export class ItemsCollection {
    items: (IInventoryItem | null)[]
    block_manager: typeof BLOCK
    /** Не обращаться к этому полю напрямую, вместо этого вызывать {@link getSize} */
    protected _size = new InventorySize()

    constructor(items: (IInventoryItem | null)[], block_manager: typeof BLOCK) {
        this.items = items
        this.block_manager = block_manager
    }

    /** Обновляет и возвращает размер коллекции */
    getSize(): InventorySize {
        return this._size.setFake(this.items.length)
    }

    equal(other: ItemsCollection): boolean {
        return ObjectHelpers.deepEqual(this.items, other.items)
    }

    /** Клонирует предметы до глубины 2 (позволяет независимо менять в них количество, не extra_data) */
    clone(): ItemsCollection {
        return new ItemsCollection(ObjectHelpers.deepClone(this.items, 2), this.block_manager)
    }

    /**
     * Объединяет стеки одинакового типа.
     * Группирует все непустые стеки в начале инвентаря.
     * Не сортирует предметы по порядку (не аналог Array.sort).
     * @param items - сортируемые предметы
     * @param fromIndex - начальный индекс (включительно)
     * @param toIndex - конечный индекс (не включительно)
     */
    autoSort(fromIndex: int = 0, toIndex: int = this.items.length): void {
        const {items, block_manager} = this
        for (let i = fromIndex; i < toIndex; i++) {
            if (!items[i]) { // переместить слоты на пустые места ближе к началу инвентаря
                for (let j = i + 1; j < toIndex; j++) {
                    if (items[j]) {
                        items[i] = items[j]
                        items[j] = null
                        break
                    }
                }
            }
            if (!items[i]) {
                break // непустые слоты закончились
            }
            // добавить к неполным слотам
            const max_stack = block_manager.getItemMaxStack(items[i])
            if (items[i].count == max_stack) {
                continue
            }
            for (let j = i + 1; j < toIndex; j++) {
                if (items[j] && InventoryComparator.itemsEqualExceptCount(items[i], items[j])) {
                    const sum = items[i].count + items[j].count
                    if (sum <= max_stack) {
                        items[i].count += items[j].count
                        items[j] = null
                    } else {
                        items[i].count = max_stack
                        items[j].count = sum - max_stack
                        break
                    }
                }
            }
        }
    }

}

/**
 * Коллекция предметов инвентаря: сам инвентарь, временная копия его предметов, полученный откуда-то массив предметов.
 * Отличине от инвентаря: не прявязан к игроку; изменния не вызывают побочных эффектов (отправка сообщений,
 * перерисовка), не содержит индексов выбранных предметов.
 */
export class InventoryItemsCollection extends ItemsCollection {

    // Временные массивы - используется в реализации increment
    private static tmpUpdated:  [index: int, count: int][] = []
    private static tmpAdded:    [index: int, intem: IInventoryItem][] = []

    private static tmpRemainingIndices: int[] = []

    /** См. {@link ItemsCollection.clone} */
    clone(): InventoryItemsCollection {
        return new InventoryItemsCollection(ObjectHelpers.deepClone(this.items, 2), this.block_manager)
    }

    /** Обновляет и возвращает размер рюкзака с учетом надетых предметов */
    getSize(): InventorySize {
        return this._size.calc(this.items, this.block_manager)
    }

    /**
     * Добавляет стек пердметов {@link src} к слотам инвентаря, целиком или частично.
     * Меняет count в {@link src}.
     * Не вызывает побочных эффектов (отправка сообщений, изменение выбранных предметов, и т.п.)
     * @param no_update_if_remains - если true и не получилось добавить целиком, то не добавлется ничего. По умолчанию false.
     * @param backpackFirst true, то создание новых слотов в первую очередь выполняется в рюкзаке. Иначе - в хотбаре. По умалчание false.
     *   Не влияет на добавление к существующим слотам - это всегда сначала в хотбар.
     * @returns true если что-то изменилось
     */
    simpleIncrement(src: IInventoryItem, no_update_if_remains?: boolean, backpackFirst?: boolean): boolean {
        const {block_manager, items} = this
        const size = this.getSize()
        const item_max_count = block_manager.getItemMaxStack(src)
        let remainingCount = src.count

        // во временных массивах запоминаются изменения, которые мы возможно не выполним
        const updated = Inventory.tmpUpdated
        const added = Inventory.tmpAdded
        updated.length = 0
        added.length = 0

        // 1. update cell if exists
        let changed = false
        if(item_max_count > 1) {
            for(const i of size.bagIndices()) {
                const item = items[i];
                if(item && item.count < item_max_count && InventoryComparator.itemsEqualExceptCount(item, src)) {
                    changed = true
                    const delta = Math.min(remainingCount, item_max_count - item.count)
                    updated.push([i, item.count + delta])
                    remainingCount -= delta
                    if (remainingCount === 0) {
                        break
                    }
                }
            }
        }
        // 2. start new slot
        if (remainingCount > 0) {
            const indices = backpackFirst ? size.backpackHotbarIndices() : size.bagIndices()
            for(const i of indices) {
                if(!items[i]) {
                    const new_slot = {
                        ...src,
                        count: Math.min(remainingCount, item_max_count)
                    }
                    added.push([i, new_slot])
                    changed = true
                    remainingCount -= new_slot.count
                    if (remainingCount === 0) {
                        break
                    }
                }
            }
        }
        // no update if remains
        if(no_update_if_remains && remainingCount > 0) {
            return false
        }
        if(changed) {
            src.count = remainingCount
            // updated
            for(let [i, count] of updated) {
                items[i].count = count
            }
            // added
            for(let [i, item] of added) {
                items[i] = item
            }
        }
        return changed
    }

    /**
     * Перемещает из указанных слотов в сумку, возможно перкладывая другие стеки в рюкзаке чтобы освободить место.
     * @param force - если true, то обязательно освобождает слоты, даже если нет места.
     *   Иначе - только если есть найдется свободное место, и только целиком.
     * @return предметы, которым не налось место
     */
    moveFromSlots(force: boolean, slotIndices: Iterable<int>): IInventoryItem[] {

        /**
         * Пытается объединить неполные кучки предметов чтобы освободить {@link count} слотов.
         * Не удаляет из HUD слотов, но может добавить к ним.
         *
         * Не оптимизировано, но это кажется не важно.
         *
         * @return true если что-то изменилось (даже если освободилось меньше чем {@link count})
         *  Внимание! Если в слотах изначально количество превышало max_stack, может переложить что-то,
         *  вернуть true, но не освободить ни одного стека.
         */
        function reorganizeFreeSlots(count: int): boolean {
            const size = that.getSize()
            const simpleKeys = new Array<string>(size.bagEnd)
            const freeSpaceByKey: Dict<int> = {} // total free space in all stacks of this type of item
            let changed = false

            for(const i of size.bagIndices()) {
                const item = items[i]
                if (item) {
                    const key = InventoryComparator.makeItemCompareKey(item)
                    simpleKeys[i] = key
                    const thisItemFreeSpace = Math.max(0, block_manager.getItemMaxStack(item) - item.count)
                    freeSpaceByKey[key] = (freeSpaceByKey[key] ?? 0) + thisItemFreeSpace
                }
            }

            // for each slot that can be freed. It excludes HUD slots
            for(let i = HOTBAR_LENGTH_MAX; i < size.bagEnd; i++) {
                const item = items[i]
                if (!item) {
                    continue
                }

                // check if this item can be completely moved to partially other filled slots
                const key = simpleKeys[i]
                const thisItemFreeSpace = Math.max(0, block_manager.getItemMaxStack(item) - item.count)
                const otherItemsFreeSpace = freeSpaceByKey[key] - thisItemFreeSpace // свободное место в дргих стках того же типа
                if (item.count > otherItemsFreeSpace) {
                    continue
                }

                // этот стек можно целиком разместить в других неполных стеках. Перемещаем.
                changed = true
                items[i] = null // do it before incrementing, so it won't add to itself

                const success = that.simpleIncrement(item, true)
                if (!success) {
                    throw Error() // этого не должно произойти - мы знаем что хватало места
                }
                freeSpaceByKey[key] -= thisItemFreeSpace
                if (--count == 0) {
                    return true
                }
            }
            return changed
        }

        const that = this
        const thrown: IInventoryItem[] = []
        const {block_manager, items} = this
        const remaining = InventoryItemsCollection.tmpRemainingIndices
        remaining.length = 0
        // сначала попробуем переместить без перекладывания других предметов
        for(const i of slotIndices) {
            const item = items[i]
            if (item) {
                this.simpleIncrement(item, !force, true) // если force - то перекладываем более насйтойчиво (даже частично)
                if (item.count) {
                    remaining.push(i)
                } else {
                    items[i] = null
                }
            }
        }
        if (remaining.length && force) {
            // пробуем освободить слоты, а потом еще раз переложить или выкинуть
            reorganizeFreeSlots(remaining.length)
            for(const i of remaining) {
                const item = items[i]
                if (item) {
                    this.simpleIncrement(item, false, true)
                    if (item.count) { // если еще осталось - выкинуть
                        thrown.push(item)
                    }
                    items[i] = null
                }
            }
        }
        return thrown
    }

    /**
     * Сортирует предметы в рюкзаке (не хотбаре) как {@link Inventory.autoSort}
     * Переносит из несуществующих слотов в существующие, если возможно.
     */
    autoSortInventory(): void {
        this.autoSort(HOTBAR_LENGTH_MAX, this.getSize().bagEnd)
        this.moveFromSlots(true, this.getSize().invalidIndices())
    }
}

/**
 * Инвентарь, принадлежащий конкретному игроку.
 * Базовый класс ServerPlayerInventory и клиентсокго {@link PlayerInventory}
 */
export abstract class Inventory extends InventoryItemsCollection {

    player: Player
    current: TInventoryCurrentIndices

    constructor(player : Player, state : TInventoryState) {
        super(new Array(state.items.length), player.world.block_manager)
        this.player             = player;
        this.current            = state.current;
        this.applyNewItems(state.items, false)
    }

    //
    setIndexes(data: TInventoryCurrentIndices, send_state: boolean): void {
        const size = this.getSize()
        this.current.index = Helpers.clamp(data.index, 0, size.hotbar);
        this.current.index2 = size.bagSlotExists(data.index2) ? data.index2 : -1
        this.refresh(send_state);
    }

    //
    applyNewItems(items: (IInventoryItem | null)[], refresh: boolean): void {
        if(!Array.isArray(items)) {
            throw 'error_items_must_be_array';
        }
        if(items.length != this.items.length) {
            throw 'error_items_invalid_count|' + `${items.length} != ${this.items.length}`;
        }
        const new_items = [];
        for(let i in items) {
            let b = null;
            if(items[i]) {
                b = this.block_manager.fromId(items[i].id)
            }
            new_items[i] = this.block_manager.convertItemToInventoryItem(items[i], b);
        }
        // if nothing changes, don't refresh
        refresh = refresh && !InventoryComparator.listsExactEqual(this.items, new_items);

        this.items = new_items;
        if(refresh) {
            this.refresh(true);
        }
    }

    // Return current active item in hotbar
    get current_item(): IInventoryItem | null {
        return this.items[this.current.index];
    }

    /** Делает занчения индексов {@link current} корректными. */
    fixCurrentIndexes(): void {
        const current = this.current
        const size = this.getSize()

        if (typeof current.index !== 'number' || isNaN(current.index)) {
            current.index = 0
        }
        if (current.index < 0) {
            current.index = size.hotbar - 1
        }
        if (current.index >= size.hotbar) {
            current.index = 0
        }

        if (typeof current.index2 !== 'number' || !size.bagSlotExists(current.index2)) {
            current.index2 = -1
        }
    }

    /**
     * Умышленное переключение текущего предмета игроком.
     * На клиенте - отправляет команду на серве.
     *
     * Не вызывать как хак чтобы обновиь UI или индексы при изменении инвентаря! Для этого есть
     * {@link PlayerInventory.refresh}
     */
    select(index: int, resend = true): void {
        this.current.index = index
        this.fixCurrentIndexes()
        this.refresh(resend)
        if(this.player.mechanism_assembler.pos1) {
            this.player.mechanism_assembler.pos1 = null
            this.player.mechanism_assembler.pos2 = null
        }
    }

    /**
     * Добавляет стек пердметов {@link src} к слотам инвентаря, целиком или частично. Дополнительно:
     * - производит (возможно неполную) валидацию {@link src}
     * - вызывает {@link refresh}, высылает обновление клиенту
     * - возможно, обновляет {@link current}
     * @param no_update_if_remains - если true и не получилось добавить целиком, то не добавлется ничего. По умолчанию false.
     * @returns true если что-то изменилось
     * @throws если src некорректно
     */
    increment(src: IInventoryItem, no_update_if_remains?: boolean): boolean {
        if(!src.id) {
            throw 'error_empty_block_id';
        }

        // is it necessary? can it ever be a string?
        src.id = parseInt(src.id as any);
        src.count = parseInt(src.count as any);

        if(src.count < 1) {
            throw 'error_increment_value_less_then_one';
        }
        if(this.block_manager.fromId(src.id).is_dummy) {
            throw 'error_invalid_block_id';
        }
        const mat = this.block_manager.convertItemToInventoryItem(src);

        const oldCurrentItem = this.current_item

        const changed = this.simpleIncrement(mat, no_update_if_remains)

        if (changed) {
            if ((this.current_item != null) !== (oldCurrentItem != null)) {
                this.select(this.current.index, true) // вызывает внутри refresh
            } else {
                this.refresh(true)
            }
        }
        return changed
    }

    /** Decrements the power of {@link current_item}. */
    decrement_instrument(): void {
        if(!this.current_item || this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        if(current_item_material.power && current_item_material.item?.instrument_id) {
            this.current_item.power = Math.max(this.current_item.power - 1, 0);
            if(this.current_item.power <= 0) {
                this.items[this.current.index] = null;
            }
            this.refresh(true);
        }
    }

    /**
     * Decrements the current item.
     * @param {null} decrement_item - not processed, must be null
     */
    decrement(decrement_item = null, ignore_creative_game_mode? : boolean): void {
        if(!this.current_item) {
            return;
        }
        if(!ignore_creative_game_mode && this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        if(current_item_material.item?.instrument_id) {
            this.decrement_instrument();
        } else {
            this.current_item.count = Math.max(this.current_item.count - 1, 0);
            if(this.current_item.count < 1) {
                const matBlock = this.block_manager.fromId(this.current_item.id);
                if(matBlock.item && matBlock.item?.name == 'bucket') {
                    if(matBlock.item.emit_on_set) {
                        const emptyBucket = this.block_manager.BUCKET;
                        this.items[this.current.index] = {id: emptyBucket.id, count: 1};
                    }
                } else if (matBlock.item && matBlock.item?.name == 'bottle') {
                    this.items[this.current.index] = {id: BLOCK.GLASS_BOTTLE.id, count: 1};
                } else {
                    this.items[this.current.index] = null;
                }
            }
        }
        this.refresh(true);
    }

    // Decrement extended (ver. 2)
    decrementExtended(params) {
        if(!this.current_item) {
            return;
        }
        if(!params.ignore_creative_game_mode && this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = this.block_manager.fromId(this.current_item.id);
        const count_mode = params.mode == 'count';
        if(!count_mode && current_item_material.item?.instrument_id) {
            this.decrement_instrument();
        } else {
            this.current_item.count = Math.max(this.current_item.count - 1, 0);
            if(this.current_item.count < 1) {
                if(!count_mode && current_item_material.item && current_item_material.item?.name == 'bucket') {
                    if(current_item_material.item.emit_on_set) {
                        const emptyBucket = this.block_manager.BUCKET;
                        this.items[this.current.index] = {id: emptyBucket.id, count: 1};
                    }
                } else {
                    this.items[this.current.index] = null;
                }
            }
        }
        this.refresh(true);
    }

    /**
     * Decrements one or multiple items is visible slots by the given total amount,
     * or, if the given amount is not present, decrements by as much as posible.

    decrementByItemID(item_id, count, dont_refresh) {
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
            let item = this.items[i];
            if(!item || item.count < 1) {
                continue;
            }
            if(item.id == item_id) {
                count -= this.decrementByIndex(i, count);
                if (count === 0) {
                    break;
                }
            }
        }
        if(typeof dont_refresh === 'undefined' || !dont_refresh) {
            this.refresh(true);
        }
    }
    */

    /**
     * Decrements the item count by {@link count} or by as much as possible, and removes the
     * item from list if the count becomes 0.
     * @return int the amount actually subtracted
     */
    decrementByIndex(index: int, count: int = 1): int {
        const item = this.items[index];
        if (item == null) {
            return 0;
        }
        if (item.count > count) {
            item.count -= count;
            return count;
        } else {
            this.items[index] = null
            return item.count;
        }
    }

    countItemId(item_id) {
        let count = 0;
        for(let item of this.items) {
            if (item && item.id === item_id) {
                count += item.count;
            }
        }
        return count;
    }

    /**
     * Возвращает список того, чего и в каком количестве не хватает
     * в (текущем инвентаре + дополнительном списке предметов) по указанному списку.
     * @param resources - the array of needed resources, see {@link Recipe.calcNeedResources}
     * @param craftSlotsNumber - из скольких первых слотов крафта учитывать предметы
     * @returns объект со следующими свойствами
     *  - missing - недостающие ресурсы
     *  - has -найденные ресурсы
     */
    hasResources(resources: TItemNeedsCount[], craftSlotsNumber: int = 0): {
        missing: TItemNeedsCount[],
        has: (TItemNeedsCount & {item_index: int})[]
    } {
        const resp = {
            missing: [],
            has: []
        };
        // combined array of items
        const items =  this.items.slice(0, this.getSize().bagEnd)
        items.push(...this.items.slice(INVENTORY_CRAFT_INDEX_MIN, INVENTORY_CRAFT_INDEX_MIN + craftSlotsNumber))
        // array of mutable counts - no need to clone the the items themselves
        const counts = items.map(item => item?.count);
        // iterate the resources in order of decreasing needs specificity
        for(const resource of resources) {
            let count = resource.count;
            for(let i = 0; i < items.length; i++) {
                if (counts[i] && InventoryComparator.itemMatchesNeeds(items[i], resource.needs)) {
                    const take_count = Math.min(counts[i], count);
                    resp.has.push({
                        ...resource,
                        count: take_count,
                        item_index: i
                    });
                    counts[i] -= take_count;
                    count -= take_count;
                    if (count === 0) {
                        break;
                    }
                }
            }
            if(count > 0) {
                const r = {...resource, count};
                resp.missing.push(r);
            }
        }
        return resp;
    }

    // Return items from inventory
    exportItems(): TInventoryState {
        return {
            current: {
                index: this.current.index,
                index2: this.current.index2
            },
            items: this.items
        }
    }

    getLeftIndex() {
        return this.current.index2;
    }

    getRightIndex() {
        return this.current.index;
    }

    /**
     * Вызывается после изменений инвентаря чтобы оповестить об этом другие классы.
     * Семантика отличается на клиенте и сервере.
     */
    abstract refresh(send_state : boolean): void

    // Клонирование материала в инвентарь
    cloneMaterial(pos, allow_create_new) {

        const { block_manager, player } = this;

        if(!player.game_mode.canBlockClone()) {
            return true;
        }

        const count = this.getSize().hotbar

        //
        const tblock = player.world.getBlock(pos);
        let mat = tblock.material;

        if(mat.sham_block_name) {
            mat = player.world.block_manager[mat.sham_block_name]
        }

        //
        if(mat.id < 2 || mat.deprecated || mat.tags.includes('noclonable')) {
            return false;
        }
        while(mat.previous_part && mat.previous_part.id != mat.id) {
            const b = block_manager.fromId(mat.previous_part.id);
            mat = {id: b.id, previous_part: b.previous_part} as IBlockMaterial;
        }
        const cloned_block = block_manager.convertItemToInventoryItem(mat);
        delete(cloned_block.extra_data);
        if('power' in cloned_block && cloned_block.power == 0) {
            delete(cloned_block.power);
        }
        // Search same material with count < max
        for(let slot_key in Object.keys(this.items)) {
            const slot_index = parseInt(slot_key);
            if(this.items[slot_index]) {
                let item = this.items[slot_index];
                if(item.id == cloned_block.id) {
                    if(slot_index >= count) {
                        // swith with another from inventory
                        this.items[slot_index] = this.items[this.current.index];
                        this.items[this.current.index] = item;
                        this.select(this.current.index);
                        return this.refresh(false);
                    } else {
                        // select if on hotbar
                        if(slot_index == this.current.index) {
                            const maxStack = BLOCK.getItemMaxStack(cloned_block);
                            item.count = Math.min(item.count + 1, maxStack);
                        }
                        this.select(slot_index);
                        return this.refresh(false);
                    }
                }
            }
        }
        if(!allow_create_new) {
            return false;
        }
        // Create in current cell if this empty
        if(this.current.index < count) {
            let k = this.current.index;
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, cloned_block);
                delete(this.items[k].texture);
                this.select(k);
                return this.refresh(true);
            }
        }
        // Start new cell
        for(let k in Object.keys(this.items)) {
            if(parseInt(k) >= count) {
                break;
            }
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, cloned_block);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Replace current cell
        if(this.current.index < count) {
            let k = this.current.index;
            this.items[k] = Object.assign({count: 1}, cloned_block);
            delete(this.items[k].texture);
            this.select(k);
            return this.refresh(true);
        }
    }

    exportArmorState(): ArmorState {
        return {
            head: this.items[PAPERDOLL_HELMET]?.id,
            body: this.items[PAPERDOLL_CHESTPLATE]?.id,
            leg: this.items[PAPERDOLL_LEGGINGS]?.id,
            boot: this.items[PAPERDOLL_BOOTS]?.id,
            backpack: this.items[PAPERDOLL_BACKPACK]?.id,
        }
    }

    /**
     * Возвращает армор от надетых предметов
     * @returns {int}
     */
    getArmorLevel() {
        let resp = 0;
        for(const slot_index of [PAPERDOLL_BOOTS, PAPERDOLL_LEGGINGS, PAPERDOLL_CHESTPLATE, PAPERDOLL_HELMET]) {
            if(this.items[slot_index]) {
                const item = this.block_manager.fromId(this.items[slot_index].id);
                resp += item.armor?.damage ?? 0;
            }
        }
        return resp
    }

    /**
     * Возвращает прочность надетого премета
     */
    getArmorPower(slot_index : int) : int {
        if (this.items[slot_index]) {
            return 90
        }
        return 0
    }

    /**
     * Deletes items with count = 0.
     * @return null if nothing is deleted, or an error string
     */
    static fixZeroCount(items: (IInventoryItem | null)[] | Dict<IInventoryItem>): null | string {
        let res = null;
        for(let i in items) {
            const item = items[i];
            if (item?.count === 0) {
                res = res ?? `Error: count == 0 in slot ${i}, ${JSON.stringify(item)}`;
                ArrayOrMap.delete(items, i, null);
            }
        }
        return res;
    }

    fixZeroCount(): null | string {
        return Inventory.fixZeroCount(this.items);
    }

    /*
    // Has item
    hasItem(item) {
        if(!item || !('id' in item) || !('count' in item)) {
            return false;
        }
        //
        const item_col = InventoryComparator.groupToSimpleItems([item]);
        if(item_col.size != 1) {
            return false;
        }
        const item_key = item_col.keys().next()?.value;
        item = item_col.get(item_key);
        //
        const items = InventoryComparator.groupToSimpleItems(this.items);
        const existing_item = items.get(item_key);
        return existing_item && existing_item.count >= item.count;
    }*/

    /*
    // Decrement item
    decrementItem(item) {
        if(!item || !('id' in item) || !('count' in item)) {
            return false;
        }
        //
        const item_col = InventoryComparator.groupToSimpleItems([item]);
        if(item_col.size != 1) {
            return false;
        }
        const item_key = item_col.keys().next()?.value;
        item = item_col.get(item_key);
        //
        const items = InventoryComparator.groupToSimpleItems(this.items);
        const existing_item = items.get(item_key);
        if(!existing_item || existing_item.count < item.count) {
            return false;
        }
        // Decrement
        if(isNaN(item_key)) {
            // @todo Нужно по другому сделать вычитание, иначе если игрок не запросит свою постройку айтемов, на сервере у него порядок и группировка останется неправильной
            // Я сделал так, потому что математически у него останется правильное количество айтемов и меня это пока устраивает =)
            existing_item.count -= item.count;
            if(existing_item.count < 1) {
                items.delete(item_key);
            }
            this.items = Array.from(items.values());
        } else {
            this.decrementByItemID(item.id, item.count, true);
        }
        return true;
    }*/

}