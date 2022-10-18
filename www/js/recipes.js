import {RecipeWindow} from "./window/index.js";
import {COLOR_PALETTE, Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import { md5 } from "./helpers.js";
import {default as runes} from "../vendors/runes.js";

const MAX_SIZE = 3;

class Recipe {

    constructor(recipe, variant_index, size, keys) {

        Object.assign(this, recipe);

        this.size = size;
        this.fixPattern(this.pattern, keys);

        //
        this.adaptivePattern = {};
        for(let sz of [2, 3]) {
            this.adaptivePattern[sz] = this.calcAdaptivePattern(this.pattern, keys, sz, sz);
        }

        // Need resources
        this.calcNeedResources(this.adaptivePattern[3].array_id);

        //if(this.id == '8dafbca0-e5a4-46b3-8673-49c6e5e3a909') {
        //    console.log(this.pattern, this.adaptivePattern)
        //    debugger;
        //}

        if(variant_index > 0) {
            this.id += `:${variant_index}`;
        }

    }

    /**
     * 
     * @param {*} pattern 
     * @param {*} keys 
     * @returns 
     */
    fixPattern(pattern, keys) {
        // добираем сверху пустыми строками
        while(pattern.length < MAX_SIZE) {
            pattern.unshift(' '.repeat(MAX_SIZE));
        }
        // добираем каждую строку пробелами справа
        for(let i in pattern) {
            let line = pattern[i];
            if(line.length < MAX_SIZE) {
                pattern[i] = line + ' '.repeat(MAX_SIZE - line.length);
            }
        }
    }

    // Need resources
    calcNeedResources(pattern_array) {
        this.need_resources = new Map();
        for(let item_id of pattern_array) {
            if(!item_id) {
                continue;
            }
            if(!this.need_resources.has(item_id)) {
                this.need_resources.set(item_id, {
                    item_id: item_id,   
                    count: 0
                });
            }
            this.need_resources.get(item_id).count++;
        }
        this.need_resources = Array.from(this.need_resources, ([name, value]) => (value));
    }

    /**
     * 
     * @param {*} recipe 
     * @param {*} pattern 
     * @param {*} rows 
     * @param {*} cols 
     * @returns 
     */
    calcAdaptivePattern(pattern, keys, rows = 3, cols = 3) {

        // 1. check pattern size
        for(let i in pattern) {
            const rn = runes(pattern[i].trimRight());
            if(rn.length > 0 && pattern.length - i > rows) return null;
            if(rn.length > cols) return null;
        }

        let array = [];
        let start_index = -1;

        // 2. search start index
        for(let i in pattern) {
            const rn = runes(pattern[i]);
            if(pattern.length - i > rows) continue;
            for(let j = 0; j < rn.length; j++) {
                if(j > cols - 1) continue;
                array.push(rn[j]);
                if(start_index < 0 && rn[j] != ' ') {
                    start_index = (i - (pattern.length - rows)) * cols + j;
                }
            }
        }

        array = array.join('').trim().split('');

        //
        const array_id = [];
        array.map(function(key) {
            if(key == ' ') {
                array_id.push(null);
            } else {
                if(!keys.hasOwnProperty(key)) {
                    throw `error_invalid_recipe_pattern_key|${key}`;
                }
                array_id.push(keys[key]);
            }
        });

        return {array, array_id, start_index};
    }

}

export class RecipeManager {

    constructor(force_load) {
        this.all = [];
        this.crafting_shaped = {
            list: [],
            grouped: [],
            map: new Map(),
            searchRecipe: function(pattern_array, area_size) {
                for(let recipe of this.list) {
                    const ap = recipe.adaptivePattern[area_size.width];
                    if(ap) {
                        if(ap.array_id.length == pattern_array.length) {
                            if(ap.array_id.every((val, index) => val === pattern_array[index])) {
                                return recipe;
                            }
                        }
                    }
                }
                return null;
            }
        };
        if(force_load) {
            this.load(() => {
                if(!Qubatch.is_server) {
                    // Recipe window
                    this.frmRecipe = new RecipeWindow(this);
                    Qubatch.hud.wm.add(this.frmRecipe);
                }
            });
        }
    }

    // Return recipe by ID
    getRecipe(recipe_id) {
        if(typeof recipe_id != 'string') {
            throw 'error_invalid_recipe_id';
        }
        return this.crafting_shaped.map.get(recipe_id);
    }

    // Return item recipes
    getRecipesForItem(item_id) {
        let b = BLOCK.fromId(item_id);
        for(let r of this.crafting_shaped.list) {
            let n = r.result.item.split(':');
            if(n.length == 2) {
                if(n[1] == b.name.toLowerCase()) {
                    return r;
                }
            }
        }
        return null;
    }

    add(recipe) {
        if(!recipe) {
            throw 'Empty recipe';
        }
        let type = recipe.type.split(':')[1];
        switch(type) {
            case 'crafting_shaped': {
                // parse result
                if(!recipe.hasOwnProperty('result')) {
                    throw 'Recipe result not defined';
                }
                let result_block = BLOCK.fromName(recipe.result.item);
                if(result_block.id == BLOCK.DUMMY.id) {
                    throw 'Invalid recipe result block type ' + recipe.result.item;
                }
                recipe.result.item_id = result_block.id;
                // Key variants
                let keys_variants = [];
                const makeKeyVariants = (recipe_keys) => {
                    let keys = {};
                    for(let key of Object.keys(recipe_keys)) {
                        let value = recipe_keys[key];
                        if(!value.hasOwnProperty('item')) {
                            throw 'Recipe key not have valid property `item` or `tag`';
                        }
                        if(Array.isArray(value.item)) {
                            for(let name of value.item) {
                                let n = {...recipe_keys};
                                n[key] = {item: name};
                                makeKeyVariants(n)
                            }
                            return;
                        }
                        let block_name = value.item;
                        let block = BLOCK.fromName(block_name);
                        if(block.id == BLOCK.DUMMY.id) {
                            throw `Invalid recipe key name '${block_name}'`;
                        }
                        keys[key] = block.id;
                    }
                    keys_variants.push(keys);
                }
                makeKeyVariants(recipe.key);
                // Calculate pattern minimal area size
                let min_x = 100;
                let min_y = 100;
                let max_x = -100;
                let max_y = -100;
                for(let row in recipe.pattern) {
                    let s = recipe.pattern[row].trim().split('');
                    if(s.length > 0) {
                        if(row < min_y) min_y = row;
                        if(row > max_y) max_y = row;
                        for(let col in s) {
                            if(col < min_x) min_x = col;
                            if(col > max_x) max_x = col;
                        }
                    }
                }
                //
                for(let i in keys_variants) {
                    const size = {
                        width: max_x - min_x + 1,
                        height: max_y - min_y + 1
                    };
                    const r = new Recipe(recipe, i, size, keys_variants[i]);
                    this.crafting_shaped.list.push(r);
                    this.crafting_shaped.map.set(r.id, r);
                }
                break;
            }
            default: {
                throw 'Invalid recipe type ' + recipe.type;
            }
        }
    }

    // Compare two patterns for equals
    patternsIsEqual(p1, p2) {
        if(p1.length != p2.length) {
            return false;
        }
        for(let i of p1) {
            if(p1[i] != p2[i]) {
                return false;
            }
        }
        return true;
    }
    
    md5s(text) {
        const guid = md5(text);
        return guid.substring(0, 8) + '-' +
            guid.substring(8, 12) + '-' + guid.substring(12, 16) + '-' +
            guid.substring(16, 20) + '-' + guid.substring(20, 32);
    }

    // Load
    async load(callback) {
        const that = this;
        const recipes = await Resources.loadRecipes();
        const ids = new Map();
        // bed
        for(let color in COLOR_PALETTE) {
            let name = `${color}_bed`;
            recipes.push(
            {
                "id": this.md5s(name),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "   ",
                    "WWW",
                    "PPP"
                ],
                "key": {
                    "W": {"item": [`madcraft:${color}_wool`]},
                    "P": {"item": ["madcraft:oak_planks", "madcraft:birch_planks", "madcraft:spruce_planks", "madcraft:acacia_planks", "madcraft:jungle_planks", "madcraft:dark_oak_planks"]}
                },
                "result": {
                    "item": `madcraft:${name}`,
                    "count": 1
                }
            });
        }
        // carpet
        for(let color in COLOR_PALETTE) {
            let name = `${color}_carpet`;
            recipes.push(
            {
                "id": this.md5s(name),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "WW"
                ],
                "key": {
                    "W": {"item": [`madcraft:${color}_wool`]}
                },
                "result": {
                    "item": `madcraft:${name}`,
                    "count": 3
                }
            });
        }
        // banner
        for(let color in COLOR_PALETTE) {
            let name = `${color}_banner`;
            recipes.push(
            {
                "id": this.md5s(name),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "WWW",
                    "WWW",
                    " S "
                ],
                "key": {
                    "W": {"item": [`madcraft:${color}_wool`]},
                    "S": {"item": [`madcraft:stick`]}
                },
                "result": {
                    "item": `madcraft:${name}`,
                    "count": 3
                }
            });
        }
        // chairs and stools
        const logs = {
            oak: 'oak_log',
            birch: 'birch_log',
            spruce: 'spruce_log',
            acacia: 'acacia_log',
            jungle: 'jungle_log',
            dark_oak: 'dark_oak_log',
            crimson: 'crimson_stem',
            warped: 'warped_stem'
        };
        for(let k in logs) {
            const log_name = logs[k];
            recipes.push({
                "id": this.md5s(`${k}_chair`),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "L",
                    "LL",
                    "SS"
                ],
                "key": {
                    "L": {
                        "item": `madcraft:${log_name}`
                    },
                    "S": {
                        "item": "madcraft:stick"
                    }
                },
                "result": {
                    "item": `madcraft:${k}_chair`,
                    "count": 1
                }
            });
            recipes.push({
                "id": this.md5s(`${k}_stool`),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    " L",
                    "SS"
                ],
                "key": {
                    "L": {
                        "item": `madcraft:${log_name}`
                    },
                    "S": {
                        "item": "madcraft:stick"
                    }
                },
                "result": {
                    "item": `madcraft:${k}_stool`,
                    "count": 1
                }
            });
        }
        //
        for(let item of recipes) {
            if(!('id' in item)) {
                console.error(item);
                throw 'error_recipe_has_no_id';
            }
            if(ids.has(item.id)) {
                console.error(item);
                throw 'error_duplicate_recipe_id|' + item.id;
            }
            ids.set(item.id, true);
            that.add(item);
        }
        //
        this.group();
        callback();
    }

    // Group
    group() {
        const map = new Map();
        this.crafting_shaped.grouped = this.crafting_shaped.list.filter(
            recipe => {
                recipe.is_main = recipe.id.indexOf(':') < 0;
                if(recipe.is_main) {
                    map.set(recipe.id, recipe);
                    recipe.subrecipes = [];
                }
                return recipe.is_main;
            }
        );
        for(let recipe of this.crafting_shaped.list) {
            if(!recipe.is_main) {
                const group_recipe_id = recipe.id.split(':')[0];
                const group = map.get(group_recipe_id);
                group.subrecipes.push(recipe);
            }
        }
    }

}