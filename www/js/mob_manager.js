import {MobModel} from "./mob_model.js";

export class MobManager {
	
    constructor(world) {
        this.world = world;
        this.list = new Map();
    }

    // add
    add(data) {
        let mob = new MobModel({
            id:             data.id,
            type:           data.type,
            name:           data.name,
            indicators:     data.indicators,
            pos:            data.pos,
            rotate:         data.rotate,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            skin:           data.skin || 'base'
        });
        mob.pos.y += 1/200; 
        this.list.set(data.id, mob);
    }

    // get
    get(id) {
        if(!this.list.has(id)) {
            return null;
        }
        return this.list.get(id);
    }

    // delete
    delete(id) {
        this.list.delete(id);
    }

}