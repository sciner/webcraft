import { BLOCK } from "./blocks.js";
import { ItemHelpers } from "./block_helpers.js";
import { ObjectHelpers } from "./helpers.js";

// helpers
const SUFFIXES_ALL_ARMOR = ['_CAP', '_TUNIC', '_PANTS', '_BOOTS', '_HELMET', '_CHESTPLATE', '_LEGGINGS'];

const IN_CREATIVE_INVENTORY_DEFAULT = true;

/**
 * Contains all enchentments, and some static methods to read them from an item.
 * 
 * Similar to {@link BLOCK}, Enchantments contains all enchantment names as properties, e.g. these are the same:
 *   Enchantments['Feather Falling'].id
 *   Enchantments.byName['Feather Falling'].id
 */
export class Enchantments {

    /* Fields are automaticaly added:
        id: String
        incompatible_ids: Array

        ids are strings because it's the easist way to store them as keys of extra_data.enchantments.

        The original list: https://minecraft.fandom.com/wiki/Anvil_mechanics#Combining_items
    */
    static byId = {
        0: {
            name: 'Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 10,
            in_creative_inventory: true
        },
        1: {
            name: 'Fire Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 5,
            in_creative_inventory: true
        },
        2: {
            name: 'Feather Falling',
            suffixes: ['_BOOTS'],
            max_level: 4,
            weight: 5,
            in_creative_inventory: true
        },
        3: {
            name: 'Blast Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 2
        },
        4: {
            name: 'Projectile Protection',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 4,
            weight: 5
        },
        5: {
            name: 'Thorns',
            suffixes: SUFFIXES_ALL_ARMOR,
            max_level: 3,
            weight: 1
        },
        6: {
            name: 'Respiration',
            suffixes: ['_HELMET'],
            max_level: 3,
            weight: 2
        }
        // TODO add the rest
    };

    static byName = {}; // auto-generated

    static list = []; // auto-generated, unordered

    // Groups of enchantments that can't be simultaneously on one item.
    // Preprocessing replaces names with ids.
    static incompatible = [
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

    /** Yields [enchantment, level] for each enchantment on the item. */
    static *ofItem(item) {
        const enchantments = item.extra_data?.enchantments;
        if (enchantments) {
            for(let id in enchantments) {
                yield [this.byId[id], enchantments[id]];
            }
        }
    }

    /**
     * @return the level of enchantment on the item by enchantment id,
     * or 0 if there is no such enchantment on the item.
     */
    static getLevelById(item, enchantmentId) {
        const enchantments = item.extra_data?.enchantments;
        return (enchantments && enchantments[enchantmentId]) ?? 0;
    }

    static getLevel(item, enchantment) {
        return this.getLevelById(item, enchantment.id);
    }

    /** Similar to {@link getLevelById}, but looks enchantment by name. */
    static getLevelByName(item, enchantmentName) {
        return this.getLevelById(item, this.byName[enchantmentName].id);
    }

    /** @return true if the the enchantment is compatible with a type of this item. */
    static isCompatibleType(item, enchantment) {
        if (item.id === BLOCK.ENCHANTED_BOOK.id) {
            return true;
        }
        const blockName = BLOCK.fromId(item.id).name;
        return enchantment.names?.includes(blockName) ||
            enchantment.suffixes?.find(it => blockName.endsWith(it)) != null;
    }

    /** @return true if the item has any enchantments incompatible with this enchantment. */
    static hasIncompatible(item, enchantment) {
        const enchantments = item.extra_data?.enchantments;
        return (enchantments && enchantment.incompatible_ids.find(id => enchantments[id])) != null;
    }

    /** Sets the enchantment level, or removes the enchantment it if !(level > 0) */
    static setLevelById(item, enchantmentId, level) {
        if (level > 0) {
            const enchantments = ItemHelpers.getOrSetExtraDataFieldObject(item, 'enchantments');
            enchantments[enchantmentId] = level;
        } else {
            this.removeById(item, enchantmentId);
        }
    }

    static removeById(item, enchantmentId) {
        const enchantments = item.extra_data?.enchantments;
        if (enchantments) {
            delete enchantments[enchantmentId];
            if (ObjectHelpers.isEmpty(enchantments)) {
                ItemHelpers.deleteExtraDataField(item, 'enchantments');
            }
        }
    }

    // preprocess
    static {
        for(const [id, value] of Object.entries(this.byId)) {
            value.id = id;
            value.incompatible_ids = [];
            value.in_creative_inventory = value.in_creative_inventory ?? IN_CREATIVE_INVENTORY_DEFAULT;
            this.byName[value.name] = value;
            this[value.name] = value; // for syntax convenience, like in BLOCK
            this.list.push(value);
        }
        for(let [i, list] of this.incompatible.entries()) {
            list = list.map( name => {
                const v = this.byName[name];
                if (v == null) {
                    throw new Error('Unknwon incompatible enchantment name ' + name);
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