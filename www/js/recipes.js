import {RecipeWindow} from "./window/index.js";
import {COLOR_PALETTE, Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import { md5, ArrayHelpers } from "./helpers.js";
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
        const pat = this.adaptivePatterns[3][0];
        this.need_resources = Recipe.calcNeedResources(pat.array_id, pat.array_keys);

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
     * @param {Array of Arrays of Int} array_id - adaptivePatterns.array_id
     * @param {Array of String} array_keys - adaptivePatterns.array_keys
     * @returns {Array} resources - contains objects {
     *      item_id: Array of Int
     *      count: Int
     *  }, see {@link Inventory.hasResources}
     */
    static calcNeedResources(array_id, array_keys = null) {
        if (array_keys == null) {
            array_keys = new Array(array_id.size);
            for(let i = 0; i < array_id.length; i++) {
                array_keys[i] = array_id[i]?.join();
            }    
        }
        const need_resources = new Map();
        for(let i = 0; i < array_id.length; i++) {
            const key = array_keys[i];
            if(!key) {
                continue;
            }
            if(!need_resources.has(key)) {
                need_resources.set(key, {
                    item_ids: array_id[i],   
                    count: 0
                });
            }
            need_resources.get(key).count++;
        }
        const arr = [...need_resources.values()];
        // Sort by the number of ids ascending: if multiple entries have the same id,
        // in Invetory.hasResources we must first exhaust the entries that have no alternative ids,
        // i.e. the ones with fewer ids. It's a srictly correct solution, but it should mostly work.
        return arr.sort((a, b) => a.item_ids.length - b.item_ids.length);
    }

    /**
     * Calculates an array of adaptive patterns for craft slots with the given number
     * of columns. It may contain 0, 1 or 2 elements (the second one is mirrored).
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

        // Reduce the pattern size if necessary
        while (rn.length > rows) {  // remove top rows
            if (rn[0].find(it => it != ' ')) {
                return [];
            }
            rn.shift();
        }
        for(let i = 0; i < rows; i++) { // remove right columns
            const removed = rn[i].splice(cols);
            if (removed.find(it => it != ' ')) {
                return [];
            }
        }

        // Find actual the pattern size. We expect it to padded by spaces to MAX_SIZE x MAX_SIZE.
        let minRow = Infinity;
        let minCol = Infinity;
        let maxRow = 0;
        let maxCol = 0;
        for(let i = 0; i < rows; i++) {
            for(let j = 0; j < cols; j++) {
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
        const filledWidth = maxCol - minCol + 1;
        const filledHeight = maxRow - minRow + 1;

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
        return null;
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
                    "P": {"item": ["special:planks"]}
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
        //
        this.addOrePieces(recipes);
        this.generateTemplates(recipes);
        this.replaceSpecialItems(recipes);
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

    addOrePieces(recipes) {
        for (let piece of BLOCK.list.values()) {
            if (!piece.piece_of) {
                continue;
            }
            const pieceName = piece.name;
            const ingotName = piece.piece_of;
            const ingot = BLOCK[ingotName];
            if (!ingot) {
                continue;
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

    /**
     * @param {Object} template - see doc/recipes.md
     * @returns {Array} - entries (blocks with additional data) that match the template.
     */
    getResultTemplateEntries(template, template_name) {
        const suffixes = this.preprocessTemplateList(template.suffix);
        if (suffixes == null) {
            throw `Result template in "${template_name}" has no suffixes`;
        }
        if (template.prefix != null || template.ignore_items || template.manual || template.additional) {
            throw `Result template in "${template_name}" has unsupported properties`;
        }
        const ignore = this.preprocessTemplateList(template.ignore, true);
        const result = [];
        for(const suffix of suffixes) {
            let bySuffix = BLOCK.getBySuffix(suffix);
            for(const block of bySuffix) {
                if (ignore.includes(block.name)) {
                    continue;
                }
                result.push({
                    block,
                    nameBase: block.name.substring(0, block.name.length - suffix.length)
                });
            }
        }
        return result;
    }

    /**
     * @param {Object} resultBlock
     * @param {nameBase} - the name of resultBlock without its suffix
     * @param {Object} template - the value of item in the template. See doc/recipes.md
     * @return a recipe item (i.e. a string or array of strings) consisting of blocks that match the arguments.
     */
    getIngredientTemplateItem(resultBlock, nameBase, template) {

        const that = this;
        function addManual(name) {
            const ingredient = BLOCK.fromNameOrNull(name);
            if (!ingredient) {
                throw 'Invalid block name in a template ' + name;
            }
            item = that.addToItem(item, ingredient.name);
        }

        // building the result
        let item = null;
        if (template.manual) {
            const manual = this.preprocessTemplateList(template.additional[resultBlock.name], true);
            for(const name of manual) {
                addManual(name);
            }
        } else {
            for(const prefix of template.prefix) {
                for(const suffix of template.suffix) {
                    const ingredient = BLOCK[prefix + nameBase + suffix];
                    if (!ingredient ||
                        template.ignore_items && ingredient.item ||
                        template.ignore.includes(ingredient.name)
                    ) {
                        continue;
                    }
                    item = this.addToItem(item, ingredient.name);
                }
            }
        }
        if (template.additional) {
            const additional = this.preprocessTemplateList(template.additional[resultBlock.name], true);
            for(const name of additional) {
                addManual(name);
            }
        }
        return item ? this.preprocessItem(item) : null;
    }

    generateTemplates(recipes) {
        
        function isItemTemplate(item) {
            return typeof item === 'object' && !Array.isArray(item);
        }

        let i = 0;
        while(i < recipes.length) {
            const srcRecipe = recipes[i];
            if (!srcRecipe.template) {
                i++;
                continue;
            }
            // aditional validation & preprocessing
            if (!isItemTemplate(srcRecipe.result.item)) {
                throw 'error_template_result_is_not_template';
            }
            for(const key in srcRecipe.key) {
                const item = srcRecipe.key[key].item;
                if (!isItemTemplate(item)) {
                    continue;
                }
                item.prefix = this.preprocessTemplateList(item.prefix, '');
                item.suffix = this.preprocessTemplateList(item.suffix, '');
                item.ignore = this.preprocessTemplateList(item.ignore, true);
                for(const name of item.ignore) {
                    if (!BLOCK.fromNameOrNull(name)) {
                        throw 'Invalid block name in a template ' + name;
                    }
                }
                // ensure keys = capital block names; check that such blocks exist
                for(const map of [item.manual, item.additional]) {
                    if (map) {
                        for(let key in map) {
                            const oldKey = key;
                            if (key.startsWith("madcraft:")) {
                                key = key.substring(9);
                            }
                            key = key.toUpperCase();
                            if (key !== oldKey) {
                                if (map[key]) {
                                    throw ```Template keys conflict in "manual" or "additional": ${oldKey} ${key}```
                                }
                                map[key] = map[oldKey];
                                delete map[oldKey];
                            }
                            if (!BLOCK[key]) {
                                throw ```Unknown block in template: ${oldKey}```
                            }
                        }
                    }
                }
            }
            // replace this recipe with a group of generated recipes
            const newRecipes = [];
            const resultEntries = this.getResultTemplateEntries(srcRecipe.result.item, srcRecipe.name);
            for(const resultEntry of resultEntries) {
                const recipe = { ...srcRecipe };
                recipe.key = { ...recipe.key };
                // fill ingredients templates
                let empty = false;
                let hasTemplateIngredient = false;
                for(let key in recipe.key) {
                    const template = recipe.key[key].item;
                    if (isItemTemplate(template)) {
                        // generating an item based on a template
                        hasTemplateIngredient = true;
                        const item = this.getIngredientTemplateItem(resultEntry.block, resultEntry.nameBase, template);
                        if (item == null) {
                            empty = true;
                            break;
                        }
                        recipe.key[key] = { ...recipe.key[key], item };
                    }
                }
                // finalize the new recipe
                if (!hasTemplateIngredient) {
                    throw 'Template has no template ingredients: ' + srcRecipe.name;
                }
                if (!empty) {
                    const lowerName = resultEntry.block.name.toLowerCase();
                    // add themplate andme to the item name because there may be multiple templated for the item
                    recipe.id = this.md5s(recipe.template + ' ' + lowerName);
                    recipe.result = {
                        ...recipe.result,
                        item: "madcraft:" + lowerName
                    };
                    newRecipes.push(recipe);
                }
            }
            // replace the source recipe with generated ones
            recipes.splice(i, 1, ...newRecipes);
            i += newRecipes.length;
        }
    }

    replaceSpecialItems(recipes) {

        const that = this;
        function bySuffix(suffix, filter = it => true) {
            return that.preprocessItem(
                BLOCK.getBySuffix(suffix).filter(filter).map(it => it.name));
        }

        const specialItems = { 
            'special:planks':       bySuffix('_PLANKS'),
            'special:wooden_slab':  bySuffix('_SLAB', it => it.material.id === 'wood'),
            'special:log':          bySuffix('_LOG'),
            'special:stem':         bySuffix('_STEM'),
            'special:wood':         bySuffix('_WOOD'),
            'special:hyphae':       bySuffix('_HYPHAE')
        };
        for(let recipe of recipes) {
            for(let key in recipe.key) {
                let item = recipe.key[key].item;
                if (Array.isArray(item)) {
                    let i = 0;
                    while (i < item.length) {
                        const replacement = specialItems[item[i]];
                        if (replacement) {
                            item.splice(i, 1, ...replacement);
                        }
                        i++;
                    }
                } else {
                    item = specialItems[item] ?? item;
                }
                recipe.key[key].item = item;
            }
        }
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

    preprocessTemplateList(list, force = false) {
        if (list == null) {
            if (force === false) { // treat '' as true
                return null;
            }
            list = typeof force === 'string' ? [force] : [];
        }
        return ArrayHelpers.scalarToArray(list).map(it => it.toUpperCase());
    }

    isBlockConfigTemplateDisabled(conf) {
        return Array.isArray(conf) && conf.length === 0;
    }

}