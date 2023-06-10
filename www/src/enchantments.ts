import { BLOCK } from "./blocks.js";
import { ItemHelpers } from "./block_helpers.js";
import {Mth, ObjectHelpers} from "./helpers.js";

// helpers
const SUFFIXES_ALL_ARMOR = ['_CAP', '_TUNIC', '_PANTS', '_BOOTS', '_HELMET', '_CHESTPLATE', '_LEGGINGS'];
const SUFFIXES_ALL_TOOLS = ['_SWORD', '_AXE', '_SHOVEL', '_HOE', '_PICKAXE']

const IN_CREATIVE_INVENTORY_DEFAULT = true;

interface IEnchantment {
    // общие свойства - как может использоваться
    name: string
    suffixes: string[],             // суффиксы предметов,  которым применимо
    max_level: int,
    weight: int,                    // вероятность случайно сгенерироваться, пока не используется
    in_creative_inventory: boolean
    id : string                     // добавляется автоматически
    incompatible_ids: string[]      // добавляется автоматически

    /**
     * Если задано - то это особый вид зачарования, накладываемый через рецепт наковальни 'upgrade', а не 'combine'.
     * Его поведение отличается: может быть только один; не переносится при объединении предметов; удаляется при починке.
     */
    upgrade_by_block ? : string

    // некоторые станартные эффекты (только часто повторяющиеся; редкие и уникальные эффекты лучше проверять по id зачарования)
    visual_effect?: any,// какой применять визуальный эффект к предмету. По умолчанию - true для всех не-апгрейдов
    speed? : number,    // относительная прибавка к скорости
    power? : number,    // относительная прибавка к прочности
    damage?: number     // относительная прибавка к урону
}

const tmpIterationEntry: [IEnchantment, int] = [null, 0]

/**
 * Contains all enchentments, and some static methods to read them from an item.
 *
 * Similar to {@link BLOCK}, Enchantments contains all enchantment names as properties, e.g. these are the same:
 *   Enchantments['Feather Falling'].id
 *   Enchantments.byName['Feather Falling'].id
 */
export class Enchantments {

    /**
     * Список всех зачаровний.
     * id - строки, потом что так проще их ранить в extra_data.enchantments.
     * Зачарования в майне: https://minecraft.fandom.com/wiki/Anvil_mechanics#Combining_items
     */
    static byId: Dict<IEnchantment> = {
        0: {
            name: 'Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 10,
            in_creative_inventory: true
        } as IEnchantment,
        1: {
            name: 'Fire Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 5,
            in_creative_inventory: true
        } as IEnchantment,
        2: {
            name: 'Feather Falling',
            suffixes: ['_BOOTS'],
            max_level: 4,
            weight: 5,
            in_creative_inventory: true
        } as IEnchantment,
        3: {
            name: 'Blast Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 2
        } as IEnchantment,
        4: {
            name: 'Projectile Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 5
        } as IEnchantment,
        5: {
            name: 'Thorns',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 3,
            weight: 1
        } as IEnchantment,
        6: {
            name: 'Respiration',
            suffixes: ['_HELMET'],
            max_level: 3,
            weight: 2
        } as IEnchantment,
        7: {
            name: 'Diamond Coating',
            suffixes: SUFFIXES_ALL_TOOLS,
            upgrade_by_block: 'DIAMOND_DUST',
            speed: 0.3,
            power: 0.3,
            damage: 0.3
        } as IEnchantment
        // TODO add the rest
    };

    static byName: Dict<IEnchantment> = {}; // auto-generated

    static upgradeByBlock: Dict<IEnchantment> = {} // все улучшения по имени блока, автоматически генерируется

    static list: IEnchantment[] = []; // auto-generated, unordered

    // Groups of enchantments that can't be simultaneously on one item.
    // Preprocessing replaces names with ids.
    static incompatible: string[][] = [
        ['Protection', 'Fire Protection', 'Blast Protection', 'Projectile Protection']
        /* From Minecraft:
        ['Sharpness', 'Smite', 'Bane of Arthropods'],
        ['Depth Strider', 'Frost Walker'],
        ['Infinity', 'Mending'],
        ['Multishot', 'Piercing'],
        ['Loyalty', 'Riptide'],
        ['Channeling', 'Riptide'],
        ['Silk Touch', 'Looting'],
        ['Silk Touch', 'Luck of the Sea']
        */
    ];

    //=================== методы вычисления значений предмета с учетом эффектов ===================

    /** @return первое встреченное не null значение эффекта с указанным именем */
    static getFirst<T = any>(item: IInventoryItem, fieldName: 'visual_effect'): T | null {
        const enchantments = item.extra_data?.enchantments
        if (enchantments) {
            for(let id in enchantments) {
                const enchantment = this.byId[id]
                if (enchantment) {
                    const value = enchantment[fieldName]
                    if (value != null) {
                        return value
                    }
                }
            }
        }
        return null
    }

    /** Суммирует значения одного числового свойства от всех зачарований */
    static sum(item: IInventoryItem, fieldName: 'speed' | 'power' | 'damage'): float {
        let sum = 0
        const enchantments = item.extra_data?.enchantments
        if (enchantments) {
            for(let id in enchantments) {
                const enchantment = this.byId[id]
                if (enchantment) {
                    sum += enchantment[fieldName] ?? 0
                }
            }
        }
        return sum
    }

    /** @return визуальный эффект, применяемый к зачарованному предмету (тип пока не определен) */
    static getVisualEffect(item: IInventoryItem | IBlockItem) {
        return this.getFirst(item as IInventoryItem, 'visual_effect')
    }

    /** @return значения урона из блока, модифицированного зачарованиями предмета */
    static getDamage(block: IBlockMaterial, item: IInventoryItem): int {
        let res = block.damage ?? 1
        const sum = this.sum(item, 'damage')
        if (sum) {
            res = Mth.round(res * (1 + sum), 1)
        }
        return res
    }

    /** @return макс. значение прочности из блока, модифицированного зачарованиями предмета */
    static getMaxPower(block: IBlockMaterial, item: IInventoryItem): int | undefined {
        let res = block.power
        if (res) {
            const sum = this.sum(item, 'power')
            if (sum) {
                res = Math.round(res * (1 + sum))
            }
        }
        return res
    }

    //============================= методы работы со списком эффектов =============================

    /** Yields [enchantment, level] for each enchantment on the item. */
    static *ofItem(item: IInventoryItem): IterableIterator<[IEnchantment, int]> {
        const enchantments = item.extra_data?.enchantments;
        if (enchantments) {
            for(let id in enchantments) {
                const enchantment = this.byId[id]
                if (enchantment) {
                    tmpIterationEntry[0] = enchantment
                    tmpIterationEntry[1] = enchantments[id]
                    yield tmpIterationEntry
                }
            }
        }
    }

    /**
     * @return the level of enchantment on the item by enchantment id,
     * or 0 if there is no such enchantment on the item.
     */
    static getLevelById(item: IInventoryItem, enchantmentId: string): int {
        const enchantments = item.extra_data?.enchantments;
        return (enchantments && enchantments[enchantmentId]) ?? 0;
    }

    static getLevel(item: IInventoryItem, enchantment: IEnchantment): int {
        return this.getLevelById(item, enchantment.id);
    }

    /** Similar to {@link getLevelById}, but looks enchantment by name. */
    static getLevelByName(item: IInventoryItem, enchantmentName: string): int {
        return this.getLevelById(item, this.byName[enchantmentName].id);
    }

    /** @return true if the the enchantment is compatible with a type of this item. */
    static isCompatibleType(item: IInventoryItem, enchantment: IEnchantment): boolean {
        if (item.id === BLOCK.ENCHANTED_BOOK.id) {
            return true;
        }
        const blockName = BLOCK.fromId(item.id).name;
        return enchantment.suffixes?.some(it => blockName.endsWith(it))
    }

    /** @return true if the item has any enchantments incompatible with this enchantment. */
    static hasIncompatible(item: IInventoryItem, enchantment: IEnchantment): boolean {
        const enchantments = item.extra_data?.enchantments;
        return (enchantments && enchantment.incompatible_ids.find(id => enchantments[id])) != null;
    }

    /** Sets the enchantment level, or removes the enchantment it if !(level > 0) */
    static setLevelById(item: IInventoryItem, enchantmentId: string, level: int): void {
        if (level > 0) {
            const enchantments = ItemHelpers.getOrSetExtraDataFieldObject(item, 'enchantments');
            enchantments[enchantmentId] = level;
        } else {
            this.removeById(item, enchantmentId);
        }
    }

    static removeById(item: IInventoryItem, enchantmentId: string): void {
        const enchantments = item.extra_data?.enchantments;
        if (enchantments) {
            delete enchantments[enchantmentId];
            if (ObjectHelpers.isEmpty(enchantments)) {
                ItemHelpers.deleteExtraDataField(item, 'enchantments');
            }
        }
    }

    static remove(item: IInventoryItem, filter: (IEnchantment) => boolean): void {
        const enchantments = item.extra_data?.enchantments;
        if (enchantments) {
            for(let id in enchantments) {
                const enchantment = this.byId[id]
                if (enchantment && filter(enchantment)) {
                    this.removeById(item, id)
                }
            }
        }
    }

    // preprocess
    static init() {
        // обработать улучшения
        const incompatibleUpgrades = [] // сюда добавляются все апгрейды - они все несовместимы между собой
        for(const [id, value] of Object.entries(this.byId)) {
            value.id = id;
            value.incompatible_ids = [];
            value.in_creative_inventory = value.in_creative_inventory ?? IN_CREATIVE_INVENTORY_DEFAULT;
            value.weight ??= 0
            if (value.upgrade_by_block) {
                value.max_level = 1
                value.in_creative_inventory = false
                this.upgradeByBlock[value.upgrade_by_block] = value
                incompatibleUpgrades.push(value.name)
            } else {
                value.visual_effect ??= true
            }
            this.byName[value.name] = value;
            this.list.push(value);
        }

        // обработать списки несовместимых улучшений
        this.incompatible.push(incompatibleUpgrades)
        for(let [i, list] of this.incompatible.entries()) {
            list = list.map( name => {
                const v = this.byName[name];
                if (v == null) {
                    throw new Error('Unknown incompatible enchantment name ' + name);
                }
                return v.id;
            });
            this.incompatible[i] = list;
            for(const id of list) {
                const incompatible_ids = this.byId[id].incompatible_ids;
                for(const incId of list) {
                    if (incId !== id && !incompatible_ids.includes(incId)) {
                        incompatible_ids.push(incId);
                    }
                }
            }
        }
    }
}

Enchantments.init()