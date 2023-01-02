import {RecipeWindow} from "./window/index.js";
import {COLOR_PALETTE, Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import { md5 } from "./helpers.js";
import {default as runes} from "../vendors/runes.js";

const MAX_SIZE = 3;

export class Recipe {

    constructor(recipe, variant_index, size, keys) {

        Object.assign(this, recipe);

        this.size = size;
        this.fixPattern(this.pattern, keys);

        this.adaptivePatterns = {};
        for(let sz of [2, 3]) {
            this.adaptivePatterns[sz] = this.calcAdaptivePatterns(keys, sz, sz);
        }

        // Need resources
        this.calcNeedResources(this.adaptivePatterns[3][0]);

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

    /**
     * @param adaptivePattern
     * @returns {Array} resources - contains objects {
     *      item_id: Array of Int
     *      count: Int
     *  }, see {@link Inventory.hasResources}
     */
    calcNeedResources(adaptivePattern) {
        const { array_keys, array_id } = adaptivePattern;
        this.need_resources = new Map();
        for(let i = 0; i < array_id.length; i++) {
            const key = array_keys[i];
            if(!key) {
                continue;
            }
            if(!this.need_resources.has(key)) {
                this.need_resources.set(key, {
                    item_id: array_id[i],   
                    count: 0
                });
            }
            this.need_resources.get(key).count++;
        }
        this.need_resources = [...this.need_resources.values()];
    }

    /**
     * Calculates an array of adaptive patterns for craft slots with the given number
     * of columns. It may contain 1 or 2 elements (the second one is mirrored).
     * @param keys
     * @param {Int} rows - the maximum number of craft slot rows
     * @param {Int} cols - the number of craft slots columns
     * @returns a non-empty array of patterns, or null if there are no patterns.
     */
    calcAdaptivePatterns(keys, rows, cols) {

        function addAdaptivePattern() {
            const array_id = [];
            const array_keys = [];
            let gap = 0;
            for(let i = minRow; i <= maxRow; i++) {
                for(let j = 0; j < cols; j++) {
                    if (i * cols + j < start_index) {
                        continue; // skip elements before the beginning of the 1st string
                    }
                    const key = rn[i][j];
                    if (key !== ' ') {
                        while(gap) {
                            array_keys.push(null);
                            array_id.push(null);
                            gap--;
                        }
                        array_keys.push(key);
                        array_id.push(keys[key]);
                    } else {
                        gap++;
                    }
                }
            }
            const adaptivePattern = { array_keys, array_id, start_index, filledWidth, filledHeight };
            result.push(adaptivePattern);
        }

        // Array of Strings -> Array of Array of Runes (each rune = 1 complex unicode character?)
        const rn = this.pattern.map(it => runes(it));

        // Find actual the pattern size. We expect it to padded by spaces to MAX_SIZE x MAX_SIZE.
        let minRow = Infinity;
        let minCol = Infinity;
        let maxRow = 0;
        let maxCol = 0;
        for(let i = 0; i < MAX_SIZE; i++) {
            for(let j = 0; j < MAX_SIZE; j++) {
                const key = rn[i][j];
                if (key !== ' ') {
                    if(!keys.hasOwnProperty(key)) {
                        throw `error_invalid_recipe_pattern_key|${key}`;
                    }
                    minRow = Math.min(minRow, i);
                    minCol = Math.min(minCol, j);
                    maxRow = Math.max(maxRow, i);
                    maxCol = Math.max(maxCol, j);
                }
            }
        }
        const start_index = minRow * cols + minCol;

        // Check if it's not too big
        const filledWidth = maxCol - minCol + 1;
        const filledHeight = maxRow - minRow + 1;
        if (filledHeight > rows || filledWidth > cols) {
            return null;
        }

        const result = [];
        addAdaptivePattern();
        // try to mirror
        let differs = false;
        for(let i = minRow; i <= maxRow; i++) {
            const row = rn[i];
            for(let dj = 0; dj < (filledWidth * 0.5 | 0); dj++) {
                const a = row[minCol + dj];
                const b = row[maxCol - dj];
                differs ||= (a !== b);
                row[minCol + dj] = b;
                row[maxCol - dj] = a;
            }
        }
        if (differs) {
            addAdaptivePattern();
        }

        return result;
    }

    /**
     * @param {Array of Int} item_ids - for each crafting slot, id of its item, or null
     * @param {Object} area_size - {width, height}
     * @return {Object} - an object that contains all the necessary information to search
     *  or match recipes to the given slots.
     */
    static craftingSlotsToSearchPattern(item_ids, area_size) {
        const width = area_size.width;
        // find the filled part size in the same way as in adaptive patterns
        let minRow = Infinity;
        let minCol = Infinity;
        let maxRow = 0;
        let maxCol = 0;
        let end_index = null;
        for(let i = 0; i < item_ids.length; i++) {
            if (item_ids[i]) {
                end_index = i;
                const row = i / width | 0;
                const col = i % width;
                minRow = Math.min(minRow, row);
                minCol = Math.min(minCol, col);
                maxRow = Math.max(maxRow, row);
                maxCol = Math.max(maxCol, col);
            }
        }
        // form a short pattern, in the same was in adpative patterns
        const start_index = minRow * width + minCol;
        return end_index !== null ? {
            start_index,
            width,
            height:         area_size.height,
            filledWidth:    maxCol - minCol + 1,
            filledHeight:   maxRow - minRow + 1,
            array_id:       item_ids.slice(start_index, end_index + 1),
            full_array_ids: item_ids
        } : {
            start_index,
            width,
            height:         area_size.height,
            filledWidth:    0,
            filledHeight:   0,
            array_id:       [],
            full_array_ids: item_ids
        };
    }

    /**
     * Finds an adaptive pattern (see {@link calcAdaptivePatterns}) that matches
     * the given search pattern (see {@link craftingSlotsToSearchPattern}).
     */
    findAdaptivePattern(searchPattern) {
        const {width, filledWidth, filledHeight, array_id} = searchPattern;
        for(let ap of this.adaptivePatterns[width]) {
            // test pattern
            if (// if the filled area size matches (without this check, we might get false positives with cyclic horizontal shifts)
                ap.filledHeight === filledHeight && ap.filledWidth === filledWidth &&
                // and the elements match
                ap.array_id.length === array_id.length &&
                ap.array_id.every((ids, index) =>
                    ids ? ids.includes(array_id[index]) : (array_id[index] === null)
                )
            ) {
                return ap;
            }
        }
    }

}

export class RecipeManager {

    constructor(force_load) {
        this.all = [];
        this.crafting_shaped = {
            list: [],
            grouped: [],
            map: new Map(),
            /**
             * @param {Array of Int} pattern_array - array of item ids, one per slot of the input area.
             * @param {Object} area_size {width, height}
             */
            searchRecipe: function(searchPattern) {
                for(let recipe of this.list) {
                    if (recipe.findAdaptivePattern(searchPattern)) {
                        return recipe;
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
                const blockNameToId = (block_name) => {
                    let block = BLOCK.fromName(block_name);
                    if(block.id == BLOCK.DUMMY.id) {
                        throw `Invalid recipe key name '${block_name}'`;
                    }
                    return block.id;
                }
                const makeKeyVariants = (recipe_keys) => {
                    let keys = {};
                    for(let key of Object.keys(recipe_keys)) {
                        let value = recipe_keys[key];
                        if(!value.hasOwnProperty('item')) {
                            throw 'Recipe key not have valid property `item` or `tag`';
                        }
                        // To enable generation of a variant for each ingredient type, specify its property "same": true.
                        // It creates a requirement that all ingredients of this key must be the same.
                        // By default, it's disabled.
                        const item = value.item;
                        if (Array.isArray(item)) {
                            if (value.same) {
                                for(let name of item) {
                                    let n = {...recipe_keys};
                                    n[key] = {item: name};
                                    makeKeyVariants(n);
                                }
                                return;
                            }
                            keys[key] = item.map(it => blockNameToId(it));
                        } else {
                            keys[key] = [blockNameToId(item)];
                        }
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
        for (let block of BLOCK.getAll()) {
            this.addOrePieces(recipes, block);
            this.addStairs(recipes, block);
            this.addPlanks(recipes, block);
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

    addOrePieces(recipes, piece) {
        if (piece.piece_of) {
            const pieceName = piece.name;
            const ingotName = piece.piece_of;
            const ingot = BLOCK[ingotName];
            if (!ingot) {
                return;
            }
            recipes.push({
                "id": this.md5s(ingotName + '_TO_' + pieceName),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "W"
                ],
                "key": {
                    "W": { "item": "madcraft:" + ingotName.toLowerCase() }
                },
                "result": {
                    "item": "madcraft:" + pieceName.toLowerCase(),
                    "count": 9
                }
            }, {
                "id": this.md5s(pieceName + '_TO_' + ingotName),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "WWW",
                    "WWW",
                    "WWW"
                ],
                "key": {
                    "W": { "item": "madcraft:" + pieceName.toLowerCase() }
                },
                "result": {
                    "item": "madcraft:" + ingotName.toLowerCase(),
                    "count": 1
                }
            });
        }
    }

    addStairs(recipes, resultBlock) {
        const item = this.getAutoIngredients(resultBlock, '_STAIRS', 'stairs',
            // Don't auto-detect '_BRICK' and '_BRICKS' to avoid confusion with NETHER.
            // 'S' is for ***_BRICKS -> ***_BRICK_STAIRS, ***_TILES -> ***_TILE_STAIRS
            [''], ['', 'S', '_PLANKS', '_PILLAR'],
            // to distinguish between 'BRICK' and 'BRICKS', 'NETHER_BRICK' and 'NETHER_BRICKS'
            { ignoreItems: true });
        if (item) {
            recipes.push({
                "id": this.md5s(resultBlock.name),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "W  ",
                    "WW ",
                    "WWW"
                ],
                "key": {
                    "W": { "item": item }
                },
                "result": {
                    "item": "madcraft:" + resultBlock.name.toLowerCase(),
                    "count": 4
                }
            });
        }
    }

    addPlanks(recipes, resultBlock) {
        const item = this.getAutoIngredients(resultBlock, '_PLANKS', 'planks',
            ['', 'STRIPPED_'], ['_LOG', '_WOOD', '_STEM', '_HYPHAE']);
        if (item) {
            recipes.push({
                "id": this.md5s(resultBlock.name),
                "type": "madcraft:crafting_shaped",
                "pattern": [
                    "   ",
                    "   ",
                    "W  "
                ],
                "key": {
                    "W": { "item": item }
                },
                "result": {
                    "item": "madcraft:" + resultBlock.name.toLowerCase(),
                    "count": 4
                }
            });
        }
    }

    // Options: { ignoreItems }
    getAutoIngredients(resultBlock, resultSuffix, configName, prefixes, suffixes, options = {}) {
        const resultName = resultBlock.name;
        if (!resultName.endsWith(resultSuffix)) {
            return;
        }
        let item = null;
        if (configName && resultBlock.recipes) {
            item = resultBlock.recipes[configName] ?? null;
            if (this.isItemDisabled(item)) {
                return null;
            }
        }
        if (!item) {
            const nameBase = resultName.substring(0, resultName.length - resultSuffix.length);
            for(let prefix of prefixes) {
                for(let suffix of suffixes) {
                    const ingredient = BLOCK[prefix + nameBase + suffix];
                    if (!ingredient ||
                        options.ignoreItems && ingredient.item
                    ) {
                        continue;
                    }
                    item = this.addToItem(item, ingredient.name);
                }
            }
        }
        return item ? this.preprocessItem(item) : null;
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

    preprocessIngredientName(name) {
        if (name.includes(':')) {
            return name;
        }
        return 'madcraft:' + name.toLowerCase();
    }

    // A helper method. Adds one more block name to to an item (possibly null).
    // Returns a new item or a modified sorure item.
    addToItem(item, name) {
        name = this.preprocessIngredientName(name);
        if (item == null) {
            return name;
        }
        if (Array.isArray(item)) {
            item.push(name);
            return item;
        }
        return [item, name];
    }

    preprocessItem(item) {
        if (item != null) {
            if (Array.isArray(item)) {
                for(let i = 0; i < item.length; i++) {
                    item[i] = this.preprocessIngredientName(item[i]);
                }
            } else {
                item = this.preprocessIngredientName(item);
            }
        }
        return item;
    }

    isItemDisabled(item) {
        return Array.isArray(item) && item.length === 0;
    }
}