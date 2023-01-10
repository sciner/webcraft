// helpers
const SUFFIXES_ALL_ARMOR = ['_CAP', '_TUNIC', '_PANTS', '_BOOTS', '_HELMET', '_CHESTPLATE', '_LEGGINGS'];

const DEFAULT_IN_CREATIVE_INVENTORY = false;

export class Enchantments {

    /* Fields are automaticaly added:
        id: String
        incompatible_ids: Array

        ids are strings because is's the easist way to store them as keys of extra_data.enchantments.
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
        }
        // TODO add the rest
    };

    static byName = {}; // auto-generated

    static list = []; // auto-generated, unordered

    // preprocessing replaces names with ids
    static incompatible = [
        ['Protection', 'Fire Protection', 'Blast Protection', 'Projectile Protection']
        // TODO add the rest
    ];

    // preprocess
    static {
        for(const [id, value] of Object.entries(this.byId)) {
            value.id = id;
            value.incompatible_ids = [];
            value.in_creative_inventory = value.in_creative_inventory ?? DEFAULT_IN_CREATIVE_INVENTORY;
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
                this.byId[id].incompatible_ids = list.filter(it => it !== id);
            }
        }
    }
}