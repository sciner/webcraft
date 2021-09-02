import {Helpers} from "./helpers.js";
import {BLOCK} from "./blocks.js";

const RECIPES = {
    all:             [],
    crafting_shaped: {
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
    },
    add: function(recipe) {
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
                        if(BLOCK.BLOCK_BY_TAGS.hasOwnProperty(tag)) {
                            for(let block of BLOCK.BLOCK_BY_TAGS[tag]) {
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
                this.crafting_shaped.list.push(r);
                break;
            }
            default: {
                throw 'Invalid recipe type ' + recipe.type;
                break;
            }
        }
    },
    makeRecipePattern: function(pattern, keys) {
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
}

Helpers.loadJSON('../data/recipes.json', function(json) {
    for(let recipe of json) {
        RECIPES.add(recipe);
    }
});

export default RECIPES;