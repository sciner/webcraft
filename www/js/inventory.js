// Player inventory

function Inventory(player, hud, hotbar) {
    var that            = this;
    this.player         = player;
    this.hud            = hud;
    this.hotbar         = hotbar;
    this.all            = [];
    this.current        = null;
    this.index          = 0;
    this.max_count      = 36;
    this.hotbar_count   = 9;
    this.items          = []; // new Array(this.max_count);
    for(var i = 0; i < this.max_count; i++) {
        this.items.push(null);
    }
    for(var k in Game.world.saved_state.inventory.items) {
        if(k >= this.items.length) {
            console.error('Limit reach of inventory');
            break;
        }
        const item = Game.world.saved_state.inventory.items[k];
        if(item) {
            const world_block = BLOCK.fromId(item.id);
            if(world_block.inventory_icon_id) {
                item.inventory_icon_id = world_block.inventory_icon_id;
            }
            this.items[k] = item;
        }
    }
    // set inventory to user
    this.player.setInventory(this);
    // make default inventory
    for(var B of BLOCK.getAll()) {
        this.all.push(B);
    }
    //
    this.select(Game.world.saved_state.inventory.current.index);
    //
    var image = new Image(); // new Image(40, 40); // Размер изображения
    image.onload = function() {
        that.inventory_image = image;
        that.hud.add(that, 0);
    }
    image.src = './media/inventory2.png';
    // CraftTable
    this.ct = new CraftTable(10, 10, 352, 332, 'ct1', null, null, this);
    hud.wm.add(this.ct);
    // Inventory window
    this.frmInventory = new InventoryWindow(10, 10, 352, 332, 'frmInventory', null, null, this);
    hud.wm.add(this.frmInventory);
    // Chest window
    this.frmChest = new ChestWindow(10, 10, 352, 332, 'frmChest', null, null, this);
    hud.wm.add(this.frmChest);
}

Inventory.prototype.set = function(items) {
    this.items = new Array(this.max_count);
    this.index = 0;
    for(var i in items) {
        const item = items[i];
        if(i < this.max_count) {
            this.items[i] = item;
        }
    }
};

Inventory.prototype.getCurrent = function() {
    return this.current;
};

Inventory.prototype.increment = function(mat) {
    const MAX_COUNT = 64;
    // update cell if exists
    for(var i in this.items) {
        if(this.items[i]) {
            if(this.items[i].id == mat.id) {
                if(this.items[i].count < MAX_COUNT) {
                    if(this.items[i].count + mat.count <= MAX_COUNT) {
                        this.items[i].count = Math.min(this.items[i].count + mat.count, MAX_COUNT);
                        return;
                    } else {
                        var remains = (this.items[i].count + mat.count) - MAX_COUNT;
                        this.items[i].count = MAX_COUNT;
                        mat.count = remains;
                    }
                }
            }
        }
    }
    // start new slot
    for(var i = 0; i < this.items.length; i++) {
        if(!this.items[i]) {
            this.items[i] = Object.assign({}, mat);
            if(this.items[i].count > MAX_COUNT) {
                mat.count -= MAX_COUNT;
                this.items[i].count = MAX_COUNT;
            } else {
                mat.count = 0;
            }
            delete(this.items[i].texture);
            if(i == this.index) {
                this.select(i);
            }
            if(mat.count > 0) {
                this.increment(mat);
            }
            return;
        }
    }
}

Inventory.prototype.decrement = function() {
    if(!this.current) {
        return;
    }
    this.current.count = Math.max(this.current.count - 1, 0);
    if(this.current.count < 1) {
        this.current = this.player.buildMaterial = this.items[this.index] = null;
    }
}

//
Inventory.prototype.setItem = function(index, item) {
    this.items[index] = item;
    // Обновить текущий инструмент у игрока
    this.select(this.index);
}

//
Inventory.prototype.select = function(index) {
    if(index < 0) {
        index = this.hotbar_count - 1;
    }
    if(index >= this.hotbar_count) {
        index = 0;
    }
    this.index = index;
    this.current = this.player.buildMaterial = this.items[index];
}

Inventory.prototype.next = function() {
    this.select(++this.index);
}

Inventory.prototype.prev = function() {
    this.select(--this.index);
}

Inventory.prototype.cloneMaterial = function(mat) {
    const MAX = 64;
    // Search same material with count < max
    for(var index in this.items) {
        if(this.items[index]) {
            if(this.items[index].id == mat.id) {
                if(this.items[index].count < MAX) {
                    this.items[index].count = Math.min(this.items[index].count + 1, MAX);
                    if(index < this.hotbar_count) {
                        this.select(index);
                    }
                    return;
                }
            }
        }
    }
    // start new cell
    for(var index = 0; index < this.items.length; index++) {
        if(!this.items[index]) {
            this.items[index] = Object.assign({count: 1}, mat);
            delete(this.items[index].texture);
            if(index < this.hotbar_count) {
                this.select(index);
            }
            return;
        }
    }
    /*
    this.current = this.player.buildMaterial = this.items[this.index] = Object.assign({count: 1}, mat);
    delete(this.items[this.index].texture);
    */
}

Inventory.prototype.drawHUD = function(hud) {
    if(!this.index) {
        this.index = 0;
    }
    hud.wm.center(this.ct);
    hud.wm.center(this.frmInventory);
}

Inventory.prototype.drawHotbar = function(hud, cell_size, pos) {
    if(!this.inventory_image) {
        return;
    }
    hud.ctx.imageSmoothingEnabled = false;
    // 1. that.inventory_image
    // 2. inventory_selector
    // img,sx,sy,swidth,sheight,x,y,width,height
    const hud_pos = new Vector(pos.x, pos.y, 0);
    // style
    hud.ctx.font            = '18px Minecraftia';
    hud.ctx.textAlign       = 'right';
    hud.ctx.textBaseline    = 'bottom';
    for(const k in this.items) {
        const item = this.items[k];
        if(k >= this.hotbar_count) {
            break;
        }
        if(item) {
            if(!item.name) {
                console.error(item);
            }
            if(item.hasOwnProperty('inventory_icon_id')) {
                var icon = BLOCK.getInventoryIconPos(item.inventory_icon_id);
                hud.ctx.drawImage(
                    this.inventory_image,
                    icon.x,
                    icon.y,
                    icon.width,
                    icon.height,
                    hud_pos.x + cell_size / 2 - icon.width / 2 - 4,
                    hud_pos.y + cell_size / 2 - icon.height / 2,
                    48,
                    48
                );
            } else {
                hud.ctx.textBaseline    = 'top';
                hud.ctx.font            = '12px Minecraftia';
                var text = item.name.substring(0, 4);
                hud.ctx.fillStyle = '#000000ff';
                hud.ctx.fillText(text, hud_pos.x + cell_size - 5, hud_pos.y + 20);
                hud.ctx.fillStyle = '#ffffffff';
                hud.ctx.fillText(text, hud_pos.x + cell_size - 5, hud_pos.y + 20 - 2);
            }
            if(item.count > 1) {
                hud.ctx.textBaseline    = 'bottom';
                hud.ctx.font            = '18px Minecraftia';
                hud.ctx.fillStyle = '#000000ff';
                hud.ctx.fillText(item.count, hud_pos.x + cell_size - 5, hud_pos.y + cell_size);
                hud.ctx.fillStyle = '#ffffffff';
                hud.ctx.fillText(item.count, hud_pos.x + cell_size - 5, hud_pos.y + cell_size - 2);
            }
        }
        hud_pos.x += cell_size;
    }
}