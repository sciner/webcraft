RECIPES = {
    all:             [],
    crafting_shaped: {
        list: [],
        searchRecipeResult: function(pattern_array) {
            for(var recipe of this.list) {
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
        var type = recipe.type.split(':')[1];
        switch(type) {
            case 'crafting_shaped': {
                // parse result
                if(!recipe.hasOwnProperty('result')) {
                    throw 'Recipe result not defined';
                }
                var result_block = BLOCK.fromName(recipe.result.item);
                if(result_block.id == BLOCK.DUMMY.id) {
                    throw 'Invalid recipe result block type ' + recipe.result.item;
                }
                recipe.result.item_id = result_block.id;
                // create key map
                var keys = {};
                for(const [key, value] of Object.entries(recipe.key)) {
                    if(value.hasOwnProperty('item')) {
                        var block = BLOCK.fromName(value.item);
                        if(block.id == BLOCK.DUMMY.id) {
                            throw 'Invalid recipe key name ' + value.item;
                        }
                        keys[key] = block.id;
                    } else if(value.hasOwnProperty('tag')) {
                        throw 'Recipe key not implemented `tag`';
                    } else {
                        throw 'Recipe key not have valie property `item` or `tag`';
                    }
                }
                // Make pattern
                for(var pk in recipe.pattern) {
                    if(recipe.pattern[pk].length < 3) {
                        recipe.pattern[pk] = (recipe.pattern[pk] + '   ').substring(0, 3);
                    }
                }
                recipe.pattern_array = recipe.pattern
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
                this.crafting_shaped.list.push(recipe);
                break;
            }
            default: {
                throw 'Invalid recipe type ' + recipe.type;
                break;
            }
        }
    }
};

Helpers.loadJSON('../recipes.json', function(json) {
    for(var recipe of json) {
        RECIPES.add(recipe);
    }
});