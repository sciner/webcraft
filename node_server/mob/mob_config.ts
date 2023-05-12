import type {TPrismarineOptions} from "@client/prismarine-physics/using.js";
import {addDefaultPhysicsOptions} from "@client/prismarine-physics/using.js";
import type {TDrivingConfig} from "@client/control/driving.js";

export const DEFAULT_DRIVING_SOUND = {tag: 'madcraft:block.cloth', action: 'hit'}

/**
 * Опции для одного типа мобов.
 *
 * Options for one type of mobs.
 */
export type TMobConfig = {
    drop_on_kill?   : string    // block name
    physics         : TPrismarineOptions
    brain ?         : string    // the default is the mob name
    health ?        : int       // максимальное здоровье
    distance_view ? : int       // дистанция на которм виден игрок
    driving ?       : TDrivingConfig     // Параметры того, как на мобе можно ездить
    damagePushes ?  : boolean   // если true, то при нанесении урона актером, моба отбрасывает назад
    can_asphyxiate? : boolean   // если true, то может задохнуться под водой
    timer_panic ?   : number    // занчение FSMBrain.timer_panic при ударе. 0 отключает режим паники

    /**
     * Если это true то левый клик на мобе имеет эфеект независимо от предмета в руке.
     * Это несовместимо с {@link driving}.
     * @see Brain.onUse
     *
     * If it's true, then left-click has an effect regardless of the item.
     * It's incompatible with {@link driving}
     * @see Brain.onUse
     */
    hasUse ?        : boolean
}

/** Производит препроцесинг конфигов мобов, добавлет им значения свойств по умолчанию. */
export function preprocessMobConfigs(configs: Dict<TMobConfig>): void {
    for(const [name, conf] of Object.entries(configs)) {
        const physics = conf.physics
        physics.stepHeight      ??= 1
        addDefaultPhysicsOptions(physics)

        conf.brain              ??= name.substring(name.indexOf('/') + 1) // часть имени после '/'
        conf.health             ??= 1
        conf.distance_view      ??= 0
        conf.damagePushes       ??= true
        conf.can_asphyxiate     ??= true

        const driving = conf.driving
        if (driving) {
            if (conf.hasUse) {
                throw `Mob ${name}: driving and hasUse are incompatible`
            }
            if (driving.offsets.length == 0) {
                throw `Mob ${name}: driving.places.length == 0`
            }
            if (driving.sound === undefined) {
                driving.sound = DEFAULT_DRIVING_SOUND
            }
        }
    }
}