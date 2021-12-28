import {MobModel} from "./mob_model.js";
import {ServerClient} from "./server_client.js";

export class MobManager {
	
    constructor(world) {
        this.world = world;
        this.list = new Map();
    }

    // Client side method
    init() {
        // On server message
        this.world.server.AddCmdListener([ServerClient.CMD_MOB_ADDED, ServerClient.CMD_MOB_DELETED, ServerClient.CMD_MOB_UPDATE], (cmd) => {
            switch(cmd.name) {
                case ServerClient.CMD_MOB_ADDED: {
                    for(let mob of cmd.data) {
                        // console.log('Mob added: ' + mob.id, mob.pos);
                        this.add(mob);
                    }
                    break;
                }
                case ServerClient.CMD_MOB_UPDATE: {
                    let mob = this.list.get(cmd.data.id);
                    if(mob) {
                        mob.applyNetState({
                            pos: cmd.data.pos,
                            rotate: cmd.data.rotate,
                            time: cmd.time
                        });
                    } else {
                        // Mob not found
                    }
                    break;
                }
                case ServerClient.CMD_MOB_DELETED: {
                    for(let mob_id of cmd.data) {
                        this.delete(mob_id);
                    }
                    break;
                }
            }
        });
    }

    // add
    add(data) {
        const mob = new MobModel({
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

        mob.world = this.world;
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