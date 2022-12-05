import { Vector } from "./helpers.js";
import { MobModel } from "./mob_model.js";
import { ServerClient } from "./server_client.js";

export class MobManager {

    #world;
	
    constructor(world) {
        this.#world = world;
        this.list = new Map();
        this.draw_debug_grid = world.settings.mobs_draw_debug_grid;
        // Interval functions
        this.sendStateInterval = setInterval(() => {
            this.playSounds();
        }, 50);
    }

    // Client side method
    init() {
        // On server message
        this.#world.server.AddCmdListener([ServerClient.CMD_MOB_ADD, ServerClient.CMD_MOB_DELETE, ServerClient.CMD_MOB_UPDATE], (cmd) => {
            switch(cmd.name) {
                case ServerClient.CMD_MOB_ADD: {
                    for(let mob of cmd.data) {
                        // console.log('Mob added: ' + mob.id, mob.pos);
                        this.add(mob);
                    }
                    break;
                }
                case ServerClient.CMD_MOB_UPDATE: {
                    if(Array.isArray(cmd.data)) {
                        for(let i = 0; i < cmd.data.length; i += 6) {
                            const mob = this.list.get(cmd.data[i]);
                            if(mob) {
                                const new_state = {
                                    pos: new Vector(cmd.data[i + 1], cmd.data[i + 2], cmd.data[i + 3]),
                                    rotate: new Vector(0, 0, cmd.data[i + 4]), // new Vector(cmd.data[i + 4], cmd.data[i + 5], cmd.data[i + 6]),
                                    extra_data: cmd.data[i + 5],
                                    time: cmd.time
                                };
                                mob.applyNetState(new_state);
                                // частицы смерти
                                if (!new_state.extra_data.is_alive) {
                                    Qubatch.render.addParticles({type: 'cloud', pos: new_state.pos});
                                }
                            } else {
                                // Mob not found
                            }
                        }
                    } else {
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
                    }
                    break;
                }
                case ServerClient.CMD_MOB_DELETE: {
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
            width:          data.width,
            height:         data.height,
            pos:            data.pos,
            rotate:         data.rotate,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            skin:           data.skin || 'base',
            extra_data:     data.extra_data || null
        });

        mob.world = this.#world;
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
        const mob = this.list.get(id);
        if(mob) {
            mob.onUnload();
            this.list.delete(id);
        }
    }

    // Play mob idle or step sounds
    playSounds() {
        for(const [_, mob] of this.list.entries()) {
            if(Math.random() < .01) {
                const effect = Math.random() > .75 ? 'idle' : 'step';
                if(Qubatch.sounds.play('madcraft:block.' + mob.type, effect, mob._pos)) {
                    break;
                }
            }
        }
    }

    // Toggle grid
    toggleDebugGrid() {
        this.draw_debug_grid = !this.draw_debug_grid;
        Qubatch.setSetting('mobs_draw_debug_grid', this.draw_debug_grid);
    }

    // Set debug grid visibility
    setDebugGridVisibility(value) {
        this.draw_debug_grid = !value;
        this.toggleDebugGrid();
    }

}