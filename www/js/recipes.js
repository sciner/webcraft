import {RecipeWindow} from "./window/index.js";
import {Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";

export class RecipeManager {

    constructor() {
        this.all = [];
        this.crafting_shaped = {
            list: [],
            searchRecipeResult: function(pattern_array) {
                for(let recipe of this.list) {
                    if(recipe.pattern_array.length == pattern_array.length) {
                        if(recipe.pattern_array.every((val, index) => val === pattern_array[index])) {
                            return recipe.result;
                        }
                    }
                }
                return null;
            }
        };
        this.load(() => {
            if(!Game.is_server) {
                // Recipe window
                this.frmRecipe = new RecipeWindow(this, 10, 10, 294, 332, 'frmRecipe', null, null);
                Game.hud.wm.add(this.frmRecipe);
            }
        });
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
                // Create key map
                let keys = {};
                for(let key of Object.keys(recipe.key)) {
                    let value = recipe.key[key];
                    if(value.hasOwnProperty('item')) {
                        let block = BLOCK.fromName(value.item);
                        if(block.id == BLOCK.DUMMY.id) {
                            throw 'Invalid recipe key name ' + value.item;
                        }
                        keys[key] = block.id;
                    } else if(value.hasOwnProperty('tag')) {
                        let tag = value.tag;
                        if(BLOCK.BLOCK_BY_TAGS.has(tag)) {
                            const tag_map = BLOCK.BLOCK_BY_TAGS.get(tag);
                            for(let block of tag_map.values()) {
                                // @todo ???
                            }
                        } else {
                            throw 'items with tag `' + tag + '` not found';
                        }
                        debugger;
                    } else {
                        throw 'Recipe key not have valie property `item` or `tag`';
                    }
                }
                let r = Object.assign({}, recipe);
                r.pattern_array = this.makeRecipePattern(recipe.pattern, keys);
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
                break;
            }
            default: {
                throw 'Invalid recipe type ' + recipe.type;
                break;
            }
        }
    }

    makeRecipePattern(pattern, keys) {
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
        for(let item of recipes) {
            that.add(item);
        }
        callback();
    }

}