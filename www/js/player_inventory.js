import {BLOCK} from "./blocks.js";
import {Helpers, Vector} from "./helpers.js";
import {ServerClient} from "./server_client.js";

export class PlayerInventory {

    temp_vec = new Vector();

    constructor(player, state) {
        this.player         = player;
        this.current        = state.current;
        this.items          = state.items;
        this.max_count      = 36;
        this.hotbar_count   = 9;
        this.onSelect       = (item) => {};
    }

    refresh(send_state) {
        const data = {
            current: this.current,
            items: this.items
        };
        this.current.index = isNaN(data.current.index) ? 0 : data.current.index;
        this.current.index2 = isNaN(data.current.index2) ? -1 : data.current.index2;
        this.player.updateHands();
        this.player.world.db.savePlayerInventory(this.player, data);
        let packets = [{
            name: ServerClient.CMD_PLAYER_STATE,
            data: this.player.exportState()
        }];
        this.player.world.sendAll(packets, [this.player.session.user_id]);
        // Send new inventory to player
        if(send_state) {
            this.player.world.sendSelected([{name: ServerClient.CMD_INVENTORY_STATE, data: data}], [this.player.session.user_id], []);
        }
    }

    //
    setIndexes(data, send_state) {
        this.current.index = Helpers.clamp(data.index, 0, this.hotbar_count - 1);
        this.current.index2 = Helpers.clamp(data.index2, -1, this.max_count - 1);
        this.refresh(send_state);
    }

    // Return current active item in hotbar
    get current_item() {
        return this.items[this.current.index];
    }

    //
    select(index) {
        if(index < 0) {
            index = this.hotbar_count - 1;
        }
        if(index >= this.hotbar_count) {
            index = 0;
        }
        this.current.index = index;
        this.refresh(true);
        this.onSelect(this.current_item);
    }

    // Increment
    increment(mat) {
        if(!mat.id) {
            throw 'Empty mat ID';
        }
        let block = BLOCK.BLOCK_BY_ID.get(mat.id);
        if(!block) {
            throw 'Invalid mat ID';
        }
        // Restore material default properties
        mat = Object.assign({
            count:              mat?.count || 1,
            name:               block.name,
            tags:               block.tags,
            inventory_icon_id:  block.inventory_icon_id,
            max_in_stack:       block.max_in_stack,
        }, mat);
        let item_max_count = mat.max_in_stack;
        // Update cell if exists
        for(let i in this.items) {
            let item = this.items[i];
            if(item) {
                if(item.id == mat.id) {
                    /*if(this.player.game_mode.isCreative()) {
                        return;
                    }*/
                    if(item.count < item_max_count) {
                        if(item.count + mat.count <= item_max_count) {
                            item.count = Math.min(item.count + mat.count, item_max_count);
                            this.refresh(true);
                            return;
                        } else {
                            let remains = (item.count + mat.count) - item_max_count;
                            item.count = item_max_count;
                            mat.count = remains;
                            this.refresh(true);
                        }
                    }
                }
            }
        }
        // Start new slot
        for(let i = 0; i < this.items.length; i++) {
            if(!this.items[i]) {
                this.items[i] = {...mat};
                if(this.items[i].count > item_max_count) {
                    mat.count -= item_max_count;
                    this.items[i].count = item_max_count;
                } else {
                    mat.count = 0;
                }
                delete(this.items[i].texture);
                if(i == this.current.index) {
                    this.select(i);
                }
                if(mat.count > 0) {
                    this.increment(mat);
                }
                this.refresh(true);
                return;
            }
        }
    }
    
    // Decrement
    decrement(mining_block) {
        if(!this.current_item || this.player.game_mode.isCreative()) {
            return;
        }
        const current_item_material = BLOCK.fromId(this.current_item.id);
        if(current_item_material.item?.instrument_id) {
            this.current_item.power = Math.max(this.current_item.power - .01, 0);
            if(this.current_item.power < 0.001) {
                this.items[this.current.index] = null;
            }
        } else {
            this.current_item.count = Math.max(this.current_item.count - 1, 0);
            if(this.current_item.count < 1) {
                let matBlock = BLOCK.fromId(this.current_item.id);
                if(matBlock.item && matBlock.item?.name == 'bucket') {
                    if(matBlock.item.emit_on_set) {
                        const emptyBucket = BLOCK.BUCKET_EMPTY;
                        this.items[this.current.index] = {id: emptyBucket.id, count: 1};
                    }
                } else {
                    this.items[this.current.index] = null;
                }
            }
        }
        this.refresh(true);
    }

    // decrementByItemID
    decrementByItemID(item_id, count) {
        for(let i in this.items) {
            let item = this.items[i];
            if(!item || item.count < 1) {
                continue;
            }
            if(item.id == item_id) {
                if(item.count >= count) {
                    item.count -= count;
                    if(item.count < 1) {
                        this.items[i] = null;
                    }
                    break;
                } else {
                    count -= item.count;
                    item.count = 0;
                    this.items[i] = null;
                }
            }
        }
    }

    // Клонирование материала в инвентарь
    cloneMaterial(mat) {
        if(mat.id < 2 || mat.deprecated) {
            return false;
        }
        while(mat.previous_part) {
            let b = BLOCK.fromId(mat.previous_part.id);
            mat = {id: b.id, previous_part: b.previous_part};
        }
        mat = BLOCK.convertItemToInventoryItem(mat);
        // Search same material with count < max
        for(let k in Object.keys(this.items)) {
            if(parseInt(k) >= this.hotbar_count) {
                break;
            }
            if(this.items[k]) {
                let item = this.items[k];
                if(item.id == mat.id) {
                    this.select(parseInt(k));
                    return this.refresh(false);
                }
            }
        }
        // Create in current cell if this empty
        if(this.current.index < this.hotbar_count) {
            let k = this.current.index;
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, mat);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Start new cell
        for(let k in Object.keys(this.items)) {
            if(parseInt(k) >= this.hotbar_count) {
                break;
            }
            if(!this.items[k]) {
                this.items[k] = Object.assign({count: 1}, mat);
                delete(this.items[k].texture);
                this.select(parseInt(k));
                return this.refresh(true);
            }
        }
        // Replace current cell
        if(this.current.index < this.hotbar_count) {
            let k = this.current.index;
            this.items[k] = Object.assign({count: 1}, mat);
            delete(this.items[k].texture);
            this.select(parseInt(k));
            return this.refresh(true);
        }
    }

    // Drop item from hand
    dropItem(data) {
        if(!this.current_item) {
            return false;
        }
        const item = {...this.current_item};
        item.count = 1;
        const pos = this.player.state.pos.clone();
        pos.addSelf(this.temp_vec.set(
            -Math.sin(this.player.state.rotate.z) * .15,
            this.player.height * .4,
            -Math.cos(this.player.state.rotate.z) * .15,
        ));
        // Add velocity for drop item
        this.temp_vec.set(
            Math.sin(this.player.state.rotate.z) *  .5,
            .5,
            Math.cos(this.player.state.rotate.z) * .5,
        );
        this.player.world.createDropItems(this.player, pos, [item], this.temp_vec);
        if(this.current_item.count == 1) {
            this.setItem(this.current.index, null);
        } else {
            this.decrement();
        }
        return true;
    }

    // Возвращает список того, чего и в каком количестве не хватает в текущем инвентаре по указанному списку
    hasResources(resources) {
        let resp = [];
        for(let resource of resources) {
            let r = {
                item_id: resource.item_id,
                count: resource.count
            };
            // Each all items in inventoryy
            for(var item of this.items) {
                if(!item) {
                    continue;
                }
                if(item.id == r.item_id) {
                    if(item.count > r.count) {
                        r.count = 0;
                    } else {
                        r.count -= item.count;
                    }
                    if(r.count == 0) {
                        break;
                    }
                }
            }
            if(r.count > 0) {
                resp.push(r);
            }
        }
        return resp;
    }

    // Return items from inventory
    exportItems() {
        let resp = {
            current: {
                index: this.current.index,
                index2: this.current.index2
            },
            items: []
        }
        for(var item of this.items) {
            let t = null;
            if(item) {
                t = {
                    id:         item.id,
                    count:      item.count,
                    power:      item.power
                };
                // Individual properties
                for(let prop of ['entity_id', 'entity_name']) {
                    t[prop] = null;
                    if(item.hasOwnProperty(prop)) {
                        t.entity_id = item[prop];
                    }
                }
            }
            resp.items.push(t);
        }
        return resp;
    }

    getLeftIndex() {
        return this.current.index2;
    }

    getRightIndex() {
        return this.current.index;
    }
    
    //
    setItem(index, item) {
        this.items[index] = item;
        // Обновить текущий инструмент у игрока
        this.select(this.current.index);
    }

    next() {
        this.select(++this.current.index);
    }
    
    prev() {
        this.select(--this.current.index);
    }

}