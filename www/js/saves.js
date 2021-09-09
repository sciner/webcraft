export default class Saves {

    // Constructor
    constructor(callback) {
        this.table_name = 'worlds';
        callback(this);
    }

    // Load
    load(world_id, callback, callback_error) {
        let key = this.table_name + '_' + world_id;
        let world = localStorage.getItem(key);
        if(world) {
            world = JSON.parse(world);
            // @Migrate to new version
            if(!world.hasOwnProperty('id')) {
                world.id = world._id;
                delete(world._id);
            }
            callback(world);
            return true;
        }
        let err = {message: 'Not found'};
        callback_error(err);
        return false;
    }

    // Add new
    addNew(world, callback) {
        let key = this.table_name + '_' + world.id;
        localStorage.setItem(key, JSON.stringify(world));
        if(callback) {
            callback();
        }
    };

    // Save
    save(world, callback) {
        let table_name = this.table_name;
        world.exportJSON(function(row) {
            let key = table_name + '_' + row.id;
            localStorage.setItem(key, JSON.stringify(row));
            if(callback) {
                callback();
            }
        });
    }

}