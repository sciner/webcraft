import type { Vector } from "@client/helpers.js"
import { FSMBrain } from "../brain.js"
import type { EnumDamage } from "@client/enums/enum_damage.js"

export class Brain extends FSMBrain {

    #mode : number = 3

    constructor(mob) {
        super(mob)
        this.stack.pushState(this.doNothing)
    }

    onLive() {

    }

    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob
        mob.kill()
        return true
    }
    
    // если использовали предмет
    onUse(actor, id) {
        if (this.#mode++ > 3) {
            this.#mode = 0    
        }
        const world = this.mob.getWorld()
        if (this.#mode == 0) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим бесмертия', actor)
        } else if (this.#mode == 1) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим бесмертия + информация', actor)
        } else if (this.#mode == 2) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим одного удара', actor)
        } else if (this.#mode == 3) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим отбрасывания от взрыва', actor)
        }
        return false
    }

    /**
    * Нанесен урон по мобу
    * val - количество урона
    * type_damage - от чего умер[упал, сгорел, утонул]
    * actor - игрок или пероснаж
    */
    onDamage(val : number, type_damage : EnumDamage, actor, pos: Vector) {
        const mob = this.mob
        if (this.#mode == 0) {
            return
        }
        if (this.#mode == 1) {
            this.sendMessage('Урон: ' + val + ' тип: ' + type_damage, actor)
            return
        }
        if (this.#mode == 3) { 
            if (pos) {
                const velocity = mob.pos.clone()
                velocity.subSelf(pos).normSelf().mulScalarSelf(.75)
                velocity.y = .2
                mob.addVelocity(velocity)
                this.sendMessage('Урон: ' + val + ' тип: ' + type_damage + ' вектор: ' + JSON.stringify(velocity), actor)
            }
            return
        }
        mob.kill()
    }

    sendMessage(msg: string, actor) {
        const mob = this.mob
        const world = mob.getWorld()
        if (actor) {
            world.chat.sendSystemChatMessageToSelectedPlayers(msg, actor);
        } else {
            console.log(msg)
        }
    }
}