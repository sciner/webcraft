import {BLOCK} from "./blocks.js";
import {ServerClient} from "./server_client.js";

export class PlayerInventory {

    constructor(player, state) {
        this.player         = player;
        this.current        = state.current;
        this.items          = state.items;
        this.current_item   = null;
        this.max_count      = 36;
        this.hotbar_count   = 9;
        this.onSelect       = (item) => {};
    }

    refresh() {
        const data = {
            current: this.current,
            items: this.items
        };
        this.current.index = isNaN(data.current.index) ? 0 : data.current.index;
        this.current.index2 = isNaN(data.current.index2) ? 0 : data.current.index2;
        this.player.updateHands();
        this.player.world.db.savePlayerInventory(this.player, data);
        let packets = [{
            name: ServerClient.CMD_PLAYER_STATE,
            data: this.player.exportState()
        }];
        this.player.world.sendAll(packets, [this.player.session.user_id]);
        // Send new inventory to player
        this.player.world.sendSelected([{name: ServerClient.CMD_SAVE_INVENTORY, data: data}], [this.player.session.user_id], []);
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
        // @todo inventory Нужно обновить this.player.buildMaterial на клиенте
        this.current_item = this.items[index];
        this.refresh(false);
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
                    if(this.player.game_mode.isCreative()) {
                        return;
                    }
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
    decrement() {
        if(!this.current_item || this.player.game_mode.isCreative()) {
            return;
        }
        this.current_item.count = Math.max(this.current_item.count - 1, 0);
        if(this.current_item.count < 1) {
            // @todo inventory Нужно обновить this.player.buildMaterial на клиенте
            this.current_item = this.items[this.current.index] = null;
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

    // Return current active item in hotbar
    getCurrent() {
        return this.current_item;
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