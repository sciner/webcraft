import { FSMBrain } from "../brain.js"
import type { EnumDamage } from "@client/enums/enum_damage.js"

export class Brain extends FSMBrain {

    #mode : number = 0

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
        if (this.#mode++ > 2) {
            this.#mode = 0    
        }
        const world = this.mob.getWorld()
        if (this.#mode == 0) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим бесмертия', actor)
        } else if (this.#mode == 1) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим бесмертия + информация', actor)
        } else if (this.#mode == 2) {
            world.chat.sendSystemChatMessageToSelectedPlayers('Режим одного удара', actor)
        }
        return false
    }

    /**
    * Нанесен урон по мобу
    * val - количество урона
    * type_damage - от чего умер[упал, сгорел, утонул]
    * actor - игрок или пероснаж
    */
    onDamage(val : number, type_damage : EnumDamage, actor) {
        const world = this.mob.getWorld()
        if (this.#mode == 0) {
            return
        }
        world.chat.sendSystemChatMessageToSelectedPlayers('Урон: ' + val + ' тип: ' + type_damage, actor);
        if (this.#mode == 1) {
            return
        }
        const mob = this.mob
        mob.kill()
    }
}