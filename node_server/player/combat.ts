import { ATTACK_COOLDOWN } from "@client/constant.js";
import type { ServerPlayer } from "../server_player.js";
import { EnumDamage } from "@client/enums/enum_damage.js";

const TIME_CRIT_DELAY = 1000

export class ServerPlayerCombat {
    
    #player: ServerPlayer
    #cooldowm: number
    #time: number
    #mob_id: any
    #player_id: any
    #item: any

    constructor(player : ServerPlayer) {
        this.#player = player
        this.#cooldowm = performance.now()
        this.#time = performance.now()
    }

    Attack(mob_id, player_id) {
        const player = this.#player
        const world = player.world
        if (player.state.attack) {
            return
        }
        this.#time = performance.now()
        this.#mob_id = mob_id
        this.#player_id = player_id
        this.#item = world.block_manager.fromId(player.state.hands.right.id)
        const speed = this.#item?.speed ? this.#item.speed : 1
        player.state.attack = {title: 'attack', speed: speed}
    }

    setDamage(tick) {
        const player = this.#player
        if (player.state.attack) {
            const speed = this.#item?.speed ? this.#item.speed : 1
            const time = (performance.now() - this.#time) * speed
            if (time >= ATTACK_COOLDOWN) {
                let damage = this.#item?.damage ? this.#item.damage : 1
                let enum_damage = EnumDamage.PUNCH
                //if (player.controlManager.prismarine.player_state.control.jump && time < (TIME_1_SEC + TIME_CRIT_DELAY)) {
                if (Math.random() < .2) {  
                    damage += Math.max(2, Math.floor(damage * Math.random() / 2))
                    enum_damage = EnumDamage.CRIT
                }
                const world = player.world
                if (this.#player_id && world.rules.getValue('pvp')) {
                    // наносим урон по игроку
                    const target = world.players.get(this.#player_id)
                    if (!target) {
                        return
                    }
                    target.setDamage(damage, enum_damage, player)
                    // уменьшаем прочнось предмета
                    if (this.#item?.power) {
                        player.inventory.decrement_instrument()
                    }
                }
                if (this.#mob_id) {
                    // наносим урон по мобу
                    const target = world.mobs.get(this.#mob_id)
                    if (!target) {
                        return
                    }
                    target.setDamage(damage, enum_damage, player)
                    // уменьшаем прочнось предмета
                    if (this.#item?.power) {
                        player.inventory.decrement_instrument()
                    }
                }
                player.state.attack = false
            }
        }
    }


    // урон от оружия
    onAttack(mob_id, player_id) {
        const player = this.#player
        const world = player.world
        const item = world.block_manager.fromId(player.state.hands.right.id)
        const speed = item?.speed ? item.speed : 1
        const time = (performance.now() - this.#cooldowm) * speed
        if (time > ATTACK_COOLDOWN) {
            let damage = item?.damage ? item.damage : 1
            let enum_damage = EnumDamage.PUNCH
            //if (player.controlManager.prismarine.player_state.control.jump && time < (TIME_1_SEC + TIME_CRIT_DELAY)) {
            if (Math.random() < .2 && time < 2 * ATTACK_COOLDOWN) {  
                damage += Math.max(2, Math.floor(damage * Math.random() / 2))
                enum_damage = EnumDamage.CRIT
            }
            if (player_id && world.rules.getValue('pvp')) {
                // наносим урон по игроку
                const target = world.players.get(player_id)
                if (!target) {
                    return
                }
                target.setDamage(damage, enum_damage, player)
                // уменьшаем прочнось предмета
                if (item?.power) {
                    player.inventory.decrement_instrument()
                }
            }
            if (mob_id) {
                // наносим урон по мобу
                const target = world.mobs.get(mob_id)
                if (!target) {
                    return
                }
                target.setDamage(damage, enum_damage, player)
                // уменьшаем прочнось предмета
                if (item?.power) {
                    player.inventory.decrement_instrument()
                }
            }
            this.#cooldowm = performance.now()
        }
    }

    // @todo пока не удалть, может пригодится
    onAttack_old(mob_id, player_id) {
        const player = this.#player
        const world = player.world
        const item = world.block_manager.fromId(player.state.hands.right.id)
        const time = performance.now() - this.#cooldowm
        if (time < 200) {
            return
        } 
        this.#cooldowm = performance.now()
        let damage = item?.damage ? item.damage : 1
        const speed = item?.speed ? item.speed : 1
        const strength = Math.min(Math.max(time * speed, 0), 1000) / 1000
        damage = damage * (.2 + strength * strength * .8)
        const crit = strength > .9 // @todo crit нельзя посчитать, так как нет информации о игроке (находится в воде, летит, бежит)
        if (player_id && world.rules.getValue('pvp')) {
            // наносим урон по игроку
            const target = world.players.get(player_id)
            if (!target) {
                return
            }
            target.setDamage(damage, EnumDamage.PUNCH, player)
            // уменьшаем прочнось предмета
            if (item?.power) {
                player.inventory.decrement_instrument()
            }
        }
        if (mob_id) {
            // наносим урон по мобу
            const target = world.mobs.get(mob_id)
            if (!target) {
                return
            }
            target.setDamage(damage, EnumDamage.PUNCH, player)
            // уменьшаем прочнось предмета
            if (item?.power) {
                player.inventory.decrement_instrument()
            }
        }
    }
}