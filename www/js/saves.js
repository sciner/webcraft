function Saves(callback) {
    var that = this;
    this.table_name = 'worlds';
    DB.open(this.table_name, function(instance) {
        that.DB = instance;
        callback(that);
    });
}

Saves.prototype.load = function(world_name, callback, callback_error) {
    var that = this;
    if(!that.DB) {
        throw('DB not inited');
    }
    try {
        that.DB.get(this.table_name, world_name, function(row) {
            callback(row);
        }, function(err) {     
            // console.error(err);
            callback_error(err);
        });
        return true;
    } catch(e) {
        console.error(e);
        return false;
    }
}

Saves.prototype.addNew = function(row, callback) {
    DB.put(this.table_name, row);
    if(callback) {
        callback();
    }
};

Saves.prototype.save = function(world, callback) {
    var that = this;
    if(!that.DB) {
        throw('DB not inited');
    }
    var t = performance.now();
    world.exportJSON(function(row) {
        DB.put(that.table_name, row);
        t = performance.now() - t;
        console.info('Save for ' + (Math.round(t * 1000) / 1000) + 'ms');
        if(callback) {
            callback();
        }
    });
}