import { Vector } from "./helpers.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";
import {MobModel, TMobModelConstructorProps} from "./mob_model.js";
import { Resources } from "./resources.js";
import { ServerClient } from "./server_client.js";
import type {World} from "./world.js";

export class MobManager {

    #world              : World
    models              : Map<string, Mesh_Object_BBModel> = new Map()
    list                = new Map<int, MobModel>()
    draw_debug_grid     : boolean
    sendStateInterval   : any // number

    constructor(world: World) {
        this.#world = world;
        this.draw_debug_grid = world.settings.mobs_draw_debug_grid;
        // Interval functions
        this.sendStateInterval = setInterval(() => {
            this.playSounds();
        }, 50);
    }

    // Client side method
    init() {

        for(let name of ['pig']) {
            const model = Resources._bbmodels.get(`mob/${name}`)
            const mesh = new Mesh_Object_BBModel(Qubatch.render, new Vector(0, 0, 0), new Vector(0, 0, -Math.PI/2), model, undefined, true)
            mesh.parts = {
                'head': [],
                'legs': [],
                'arms': [],
                'wings': [],
                'body': [],
            }
            for(let group of model.groups.values()) {
                if(group.name.startsWith('leg')) {
                    mesh.parts.legs.push(group)
                } else if(group.name.startsWith('wing')) {
                    mesh.parts.wings.push(group)
                } else if(['leftLeg', 'rightLeg'].includes(group.name)) {
                    mesh.parts.legs.push(group)
                } else if(['leftArm', 'rightArm'].includes(group.name)) {
                    mesh.parts.arms.push(group)
                } else if(group.name == 'head') {
                    mesh.parts.head.push(group)
                } else if(group.name == 'body') {
                    mesh.parts.body.push(group)
                }
            }
            this.models.set(name, mesh)
        }

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
                                if (new_state.extra_data && !new_state.extra_data.is_alive) {
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
    add(data: TMobModelConstructorProps): void {
        data.pitch  = data.rotate.x
        data.yaw    = data.rotate.z
        data.skin   ??= 'base'
        data.extra_data ??= null

        const mob = new MobModel(data, this.#world)

        mob.pos.y += 1/200;

        this.list.set(data.id, mob);
        this.#world.drivingManager.onMobModelAdded(mob)
    }

    // get
    get(id: int): MobModel | null {
        return this.list.get(id) ?? null;
    }

    // delete
    delete(id) {
        const mob = this.list.get(id);
        if(mob) {
            mob.onUnload();
            this.list.delete(id);
            mob.driving?.onModelDeleted(mob)
        }
    }

    // Play mob idle or step sounds
    playSounds() {
        for(const mob of this.list.values()) {
            if(Math.random() < .01) {
                const effect = Math.random() > .75 ? 'idle' : 'step';
                if(Qubatch.sounds.play('madcraft:block.' + mob.type, effect, mob.pos)) {
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