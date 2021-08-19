import DB from './db.js';

export default class Saves {

    // Constructor
    constructor(callback) {
        let that = this;
        this.table_name = 'worlds';
        DB.open(this.table_name, function(instance) {
            that.DB = instance;
            callback(that);
        });    
    }

    // Load
    load(world_name, callback, callback_error) {
        let that = this;
        if(!that.DB) {
            throw('DB not inited');
        }
        try {
            that.DB.get(this.table_name, world_name, function(row) {
                callback(row);
            }, function(err) {     
                callback_error(err);
            });
            return true;
        } catch(e) {
            console.error(e);
            return false;
        }
    }

    // Add new
    addNew(row, callback) {
        DB.put(this.table_name, row);
        if(callback) {
            callback();
        }
    };

    // Save
    save(world, callback) {
        let that = this;
        if(!that.DB) {
            throw('DB not inited');
        }
        let t = performance.now();
        world.exportJSON(function(row) {
            DB.put(that.table_name, row);
            t = performance.now() - t;
            if(callback) {
                callback();
            }
        });
    }

}