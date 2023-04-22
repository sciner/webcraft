import { FSMStack } from "./stack.js";
import {PrismarinePlayerControl, TPrismarineOptions} from "@client/prismarine-physics/using.js";
import { Vector } from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import type { Mob } from "../mob.js";
import type { EnumDamage } from "@client/enums/enum_damage.js";
import type {MobControlParams} from "@client/control/player_control.js";
import type {World} from "@client/world.js";

export class AI {
    #mob: Mob
    #chunk_addr = new Vector()
    pc: PrismarinePlayerControl
    #tasks: any = []

    constructor(mob: Mob) {
        this.#mob = mob
    }

    // Добавляем задачу на выполнение
    addTask(ai, args = null) {
        this.#tasks.push({ ai: ai, args: args });
    }

    addStat(name : string, allowAdding : boolean = false) {
        const mobs = this.#mob.getWorld().mobs
        mobs.getTickStatForMob(this.#mob).add(name, allowAdding)
        mobs.ticks_stat.add(name, allowAdding)
    }

    tick(delta) {
        const mob = this.#mob
        const world = mob.getWorld()
        this.#chunk_addr = world.chunkManager.grid.toChunkAddr(mob.pos, this.#chunk_addr);
        const chunk = world.chunks.get(this.#chunk_addr);
        if (chunk && chunk.isReady()) {
            for (const task of this.#tasks) {
                if (task.ai.call(this, task.args)) {
                    break;
                }
            }
        }
    }

    createPlayerControl(options: TPrismarineOptions): PrismarinePlayerControl {
        const mob = this.#mob
        const world = mob.getWorld() as any as World
        return new PrismarinePlayerControl(world, mob.pos, options)
    }

    // Send current mob state to players
    sendState() {
        const mob = this.#mob;
        const world = mob.getWorld();
        const chunk_over = world.chunks.get(mob.chunk_addr);
        if (!chunk_over) {
            return;
        }
        const new_state = mob.exportState(true)
        // if state not changed
        if(!new_state) {
            return
        }
        const packets = [{
            name: ServerClient.CMD_MOB_UPDATE,
            data: new_state
        }];
        world.packets_queue.add(Array.from(chunk_over.connections.keys()), packets);
    }

    /** Updates the control {@link pc} */
    updateControl(delta : float, new_states: MobControlParams): void {
        const pc = this.pc
        pc.updateMob(new_states)
        const mob = this.#mob
        pc.tick(delta)
        mob.pos.copyFrom(pc.getPos())
    }

    /**
    * Нанесен урон по мобу
    * val - количество урона
    * type_damage - от чего умер[упал, сгорел, утонул]
    * actor - игрок или пероснаж
    */
    onDamage(val : number, type_damage : EnumDamage, actor) {
        
    }

    /**
    * Моба убили
    * actor - игрок или пероснаж
    * type_damage - от чего умер[упал, сгорел, утонул]
    */
    onKill(actor, type_damage) {
    }

    /**
     * Использовать предмет на мобе
     * @param actor игрок
     * @param item item
     */
    onUse(actor : any, item : any) : boolean{
        return false
    }

}