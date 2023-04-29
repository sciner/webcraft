import { Vector } from "./helpers.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";
import { MobModel } from "./mob_model.js";
import { Resources } from "./resources.js";
import { ServerClient } from "./server_client.js";
import type { PlayerSkin } from "./player.js";
import type { World } from "./world.js";

export declare type TMobProps = {
    health?:        float
    username?:      any
    id:             int
    type:           string
    name?:          string
    indicators:     any
    width:          float
    height:         float
    pos:            Vector
    rotate:         Vector
    pitch:          float
    yaw:            float
    skin?:          PlayerSkin // | string
    skin_id?:       string
    extra_data?:    any
    hands?:         any
}

export class MobManager {
    #world:             World
    list:               Map<number, MobModel> = new Map()
    sendStateInterval:  any
    draw_debug_grid:    boolean = false

    private models:     Map<string, Mesh_Object_BBModel> = new Map()

    constructor(world : World) {
        this.#world = world
        this.list = new Map()
        this.draw_debug_grid = world.settings.mobs_draw_debug_grid
        // Interval functions
        this.sendStateInterval = setInterval(() => {
            this.playSounds()
        }, 50)
    }

    // Client side method
    init(render? : null) {

        render = render ?? Qubatch.render

        for(let [name, model] of Resources._bbmodels.entries()) {
            if(!name.startsWith('mob/')) {
                continue
            }
            name = name.substring(4)
            const mesh = new Mesh_Object_BBModel(render, new Vector(0, 0, 0), new Vector(0, 0, -Math.PI/2), model, undefined, true)
            this.models.set(name, mesh)
        }

        // On server message
        if(this.#world.server) {
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
                            const add_pos = cmd.data.slice(0, 3)
                            for(let i = 3; i < cmd.data.length; i += 6) {
                                const mob = this.list.get(cmd.data[i]);
                                if(mob) {
                                    const new_state = {
                                        pos: new Vector(
                                            cmd.data[i + 1] + add_pos[0],
                                            cmd.data[i + 2] + add_pos[1],
                                            cmd.data[i + 3] + add_pos[2]
                                        ),
                                        rotate: new Vector(0, 0, cmd.data[i + 4]), // new Vector(cmd.data[i + 4], cmd.data[i + 5], cmd.data[i + 6]),
                                        extra_data: cmd.data[i + 5],
                                        time: cmd.time
                                    };
                                    mob.applyNetState(new_state);
                                    // частицы смерти
                                    if (new_state.extra_data && !new_state.extra_data.is_alive && new_state.extra_data.play_death_animation) {
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

    }

    // add
    add(data : TMobProps) {
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
            skin:           data.skin,
            extra_data:     data.extra_data || null
        } as TMobProps, this.#world)

        mob.pos.y += 1/200

        this.list.set(data.id, mob)
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
        for(const mob of this.list.values()) {
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