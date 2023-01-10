// helpers
const SUFFIXES_ALL_ARMOR = ['_CAP', '_TUNIC', '_PANTS', '_BOOTS', '_HELMET', '_CHESTPLATE', '_LEGGINGS'];

const IN_CREATIVE_INVENTORY_DEFAULT = true;

// Contains all enchentments, and some static methods to read them from an item.
export class Enchantments {

    /* Fields are automaticaly added:
        id: String
        incompatible_ids: Array

        ids are strings because is's the easist way to store them as keys of extra_data.enchantments.

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

    static getLevelById(item, enchantmentId) {
        const enchantments = item.extra_data?.enchantments;
        return (enchantments && enchantments[enchantmentId]) ?? 0;
    }

    static getLevelByName(item, enchantmentName) {
        return this.getLevelById(item, this.byName[enchantmentName].id);
    }

    // preprocess
    static {
        for(const [id, value] of Object.entries(this.byId)) {
            value.id = id;
            value.incompatible_ids = [];
            value.in_creative_inventory = value.in_creative_inventory ?? IN_CREATIVE_INVENTORY_DEFAULT;
            this.byName[value.name] = value;
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