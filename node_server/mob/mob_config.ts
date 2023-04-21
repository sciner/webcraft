import type {TPrismarineOptions} from "@client/prismarine-physics/using.js";
import {addDefaultPhysicsOptions} from "@client/prismarine-physics/using.js";

export const DEFAULT_DRIVING_SOUND = {tag: 'madcraft:block.cloth', action: 'hit'}

/** Параметры того, как на мобе можно ездить */
export type TMobDrivingConfig = {
    /**
     * Для каждого места (не считая самого моба), т.е. водитель, пассажир 1, пассажир 2, и т.п.
     * это смещение относительно транспортного средства.
     * Должно быть как минимум одно место.
     */
    offsets: IVector[]

    /** Если оно задано, то при езде используется эта скорость, а не обычная скорость моба. */
    speed?: float

    /**
     * Если значение не определено, используется {@link DEFAULT_DRIVING_SOUND}.
     * Если null - то без звука.
     */
    sound?: {tag: string, action: string} | null
}

/**
 * Опции для одного типа мобов.
 *
 * Options for one type of mobs.
 */
export type TMobConfig = {
    physics         : TPrismarineOptions
    brain ?         : string    // the default is the mob name
    health ?        : int       // максимальное здоровье
    distance_view ? : int       // дистанция на которм виден игрок
    driving ?       : TMobDrivingConfig     // Параметры того, как на мобе можно ездить

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
    const configCopies: Dict<TMobConfig> = {}
    for(const [name, conf] of Object.entries(configs)) {
        const physics = conf.physics
        physics.stepHeight      ??= 1
        addDefaultPhysicsOptions(physics)

        conf.brain              ??= name
        conf.health             ??= 1
        conf.distance_view      ??= 0

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
        const nameOfCopy = name.startsWith('mob/')
            ? name.substring(4)
            : 'mob/' + name
        configCopies[nameOfCopy] = conf
    }
    Object.assign(configs, configCopies)
}