import {BLOCK, ITEM_INVENTORY_PROPS} from "./blocks.js";
import {RecipeManager} from "./recipes.js";

export class InventoryComparator {

    static rm = null;

    static async checkEqual(old_items, new_items) {

        const rm = await InventoryComparator.getRecipeManager();

        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

        /*
            console.log('>>>>>>>>>>>>>>>>>>>');
            for(let [k, v] of new_simple.entries()) {
                console.log(' ' + k, JSON.stringify(v));
            }
            console.log('<<<<<<<<<<<<<<<<<<<');

            console.log('>>>>>>>>>>>>>>>>>>>');
            for(let [k, v] of old_simple.entries()) {
                console.log(' ' + k, JSON.stringify(v));
            }
            console.log('<<<<<<<<<<<<<<<<<<<');
        */

        // 1. Check full equal
        let equal = InventoryComparator.compareSimpleItems(old_simple, new_simple);

        // 2. Check if converted|crafted
        if(!equal) {
            // Find crafted items
            const crafts = [];
            // console.log('\n' + Array.from(old_simple.keys()).join('\n -') + '\n');
            for(let [key, item] of new_simple) {
                if(!old_simple.has(key)) {
                    // new item, not exists in old state
                    const recipe = rm.getRecipe(item.id);
                    // if item has no recipe
                    if(!recipe) {
                        break;
                    }
                    crafts.push({item, recipe});
                    new_simple.delete(key);
                }
            }
            // Compare crafted items with recipes
            equal = true;
            try {
                for(let cr of crafts) {
                    // Проверка количества нового предмета оно должно быть кратным количеству указанному в рецепте
                    if(cr.item.count < 1 || cr.item.count % cr.recipe.result.count != 0) {
                        throw 'error_invalid_count';
                    }
                    // Проверка мощности (если это используется в скрафченном предмете)
                    let b = BLOCK.fromId(cr.item.id);
                    if(b.power !== 1) {
                        if('power' in cr.item) {
                            if(b.power != cr.item.power) {
                                throw 'error_invalid_start_power';
                            }
                        } else {
                            throw 'error_empty_sytart_power';
                        }
                    }
                    // Проверка extra_data (если это используется в скрафченном предмете)
                    if('extra_data' in b) {
                        if('extra_data' in cr.item && typeof cr.item.extra_data == 'object') {
                            if(!InventoryComparator.itemsIsEqual(b.extra_data, cr.item.extra_data)) {
                                throw 'error_invalid_extra_data';
                            }
                        } else {
                            throw 'error_empty_extra_data';
                        }
                    } else {
                        if('extra_data' in cr.item) {
                            throw 'error_nonempty_extra_data';
                        }
                    }
                    // Восстанавливаем использованные для крафта ресурсы
                    for(let nr of cr.recipe.need_resources) {
                        let used_item = new_simple.get(nr.item_id);
                        if(!used_item) {
                            let cb = BLOCK.fromId(nr.item_id);
                            used_item = BLOCK.convertItemToInventoryItem(cb, cb);
                            used_item.count = 0;
                            new_simple.set(nr.item_id, used_item);
                        }
                        used_item.count += nr.count;
                    }
                    // Еще раз перепроверяем новое(но уже восстановленное с учетов обратного отката крафта) состояние инвентаря с прошлым
                    equal = InventoryComparator.compareSimpleItems(old_simple, new_simple);
                }
            } catch(e) {
                equal = false;
                console.log(`* ${e}`);
            }
        }

        return equal;

    }

    // compareSimpleItems...
    static compareSimpleItems(old_simple, new_simple) {
        let equal = new_simple.size == old_simple.size;
        if(equal) {
            for(let [key, item] of new_simple) {
                let old_item = old_simple.get(key);
                if(!old_item) {
                    console.log('* Item not found', JSON.stringify(item));
                    equal = false;
                    break;
                }
                if(!InventoryComparator.itemsIsEqual(item, old_item)) {
                    console.log('* Comparator not equal', JSON.stringify([item, old_item]));
                    equal = false;
                    break;
                }
            }
        }
        return equal;
    }

    // getRecipeManager
    static async getRecipeManager() {
        if(InventoryComparator.rm) {
            return InventoryComparator.rm;
        }
        InventoryComparator.rm = new RecipeManager();
        await InventoryComparator.rm.load(() => {});
        return InventoryComparator.rm;
    }

    //
    static itemsIsEqual(a, b) {
        //
        function isObject(object) {
            return object != null && typeof object === 'object';
        }
        //
        function deepEqual(object1, object2) {
            const keys1 = Object.keys(object1);
            const keys2 = Object.keys(object2);
            if (keys1.length !== keys2.length) {
                return false;
            }
            for (const key of keys1) {
                const val1 = object1[key];
                const val2 = object2[key];
                const areObjects = isObject(val1) && isObject(val2);
                if (areObjects && !deepEqual(val1, val2) || !areObjects && val1 !== val2) {
                    return false;
                }
            }
            return true;
        }
        return deepEqual(a, b);
    }

    //
    static groupToSimpleItems(items) {
        let resp = new Map();
        let entities = new Map();
        for(let item of items) {
            if(item) {
                if('id' in item && 'count' in item) {
                    let b = BLOCK.fromId(item.id);
                    if(!b || b.id < 0) {
                        continue;
                    }
                    const new_item = BLOCK.convertItemToInventoryItem(item, b);
                    // let is_item = (typeof b?.item !== 'undefined') && (b?.item !== null);
                    // generate key
                    let key = new_item.id;
                    let entity_key = false;
                    for(let prop of ['entity_name', 'entity_id', 'power', 'extra_data']) {
                        if(prop in b) {
                            if(prop != 'power' || b.power != 1) {
                                if(prop in new_item) {
                                    let jvalue = JSON.stringify(new_item[prop]);
                                    key += `|${prop}:${jvalue}`;
                                    entity_key = new_item.id;
                                }
                            }
                        }
                    }
                    //
                    if(entity_key) {
                        let counter = entities.get(entity_key);
                        if(!counter) {
                            counter = 0;
                        }
                        entities.set(entity_key, counter + 1);
                        key += `|_:${counter}`;
                    }
                    //
                    if(resp.has(key)) {
                        resp.get(key).count += new_item.count;
                    } else {
                        resp.set(key, new_item);
                    }
                }
            }
        }
        return resp;
    }

}