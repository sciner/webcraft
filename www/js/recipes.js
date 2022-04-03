import {RecipeWindow} from "./window/index.js";
import {Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import {default as runes} from "../vendors/runes.js";

export class RecipeManager {

    constructor(force_load) {
        this.all = [];
        this.crafting_shaped = {
            list: [],
            grouped: [],
            map: new Map(),
            searchRecipe: function(pattern_array) {
                for(let recipe of this.list) {
                    if(recipe.pattern_array.length == pattern_array.length) {
                        if(recipe.pattern_array.every((val, index) => val === pattern_array[index])) {
                            return recipe;
                        }
                    }
                }
                return null;
            }
        };
        if(force_load) {
            this.load(() => {
                if(!Game.is_server) {
                    // Recipe window
                    this.frmRecipe = new RecipeWindow(this, 10, 10, 294, 332, 'frmRecipe', null, null);
                    Game.hud.wm.add(this.frmRecipe);
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

    calcStartIndex(recipe, pattern, rows = 3, cols = 3) {
        let pat = [...pattern];
        while(pat.length < rows) {
            pat.unshift('   ');
        }
        let resp = 0;
        for(let i in pat) {
            let line = pat[i];
            if(line.length < cols) {
                line += ' '.repeat(cols - line.length);
                pat[i] = line;
            }
            const rn = runes(line);
            for(let j of rn) {
                if(j != ' ') {
                    return resp;
                }
                resp++;
            }
        }
        return resp;
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
                    const keys = keys_variants[i];
                    let r = Object.assign({}, recipe);
                    r.start_index = {
                        2: this.calcStartIndex(recipe, r.pattern, 2, 2),
                        3: this.calcStartIndex(recipe, r.pattern, 3, 3)
                    };
                    if(i > 0) {
                        r.id += `:${i}`;
                    }
                    r.pattern_array = this.makeRecipePattern(recipe.pattern, keys);
                    //
                    r.size = {
                        width: max_x - min_x + 1,
                        height: max_y - min_y + 1
                    };
                    //
                    r.getCroppedPatternArray = function(size) {
                        let resp = [];
                        for(let i in this.pattern_array) {
                            if(i % 3 == size.width) {
                                continue;
                            }
                            resp.push(this.pattern_array[i]);
                        }
                        return resp;
                    };
                    // Need resources
                    r.need_resources = new Map();
                    for(let item_id of r.pattern_array) {
                        if(!item_id) {
                            continue;
                        }
                        if(!r.need_resources.has(item_id)) {
                            r.need_resources.set(item_id, {
                                item_id: item_id,   
                                count: 0
                            });
                        }
                        r.need_resources.get(item_id).count++;
                    }
                    r.need_resources = Array.from(r.need_resources, ([name, value]) => (value));
                    //
                    this.crafting_shaped.list.push(r);
                    this.crafting_shaped.map.set(r.id, r);
                }
                break;
            }
            default: {
                throw 'Invalid recipe type ' + recipe.type;
                break;
            }
        }
    }

    makeRecipePattern(pattern, keys, index) {
        // Make pattern
        for(let pk in pattern) {
            if(pattern[pk].length < 3) {
                pattern[pk] = (pattern[pk] + '   ').substring(0, 3);
            }
        }
        return pattern
            .join('')
            .trim()
            .split('')
            .map(function(key) {
                if(key == ' ') {
                    return null;
                }
                if(!keys.hasOwnProperty(key)) {
                    throw 'Invalid recipe pattern key `' + key + '`';
                }
                return keys[key];
            });
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

    // Load
    async load(callback) {
        let that = this;
        let recipes = await Resources.loadRecipes();
        let ids = new Map();
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