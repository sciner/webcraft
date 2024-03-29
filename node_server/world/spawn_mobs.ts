import { DEFAULT_MOB_TEXTURE_NAME, MOB_TYPE, PLAYER_STATUS } from "@client/constant.js"
import { FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js"
import { Vector } from "@client/helpers.js"
import type { TBlock } from "@client/typed_blocks3"
import { WorldAction } from "@client/world_action.js"
import { MobSpawnParams } from "mob.js"
import type { ServerWorld } from "server_world.js"

const RADIUS_DESPAWN = 128 // максимальное растояние проверки мобов
const SPAWN_DISTANCE = 81  // максимальное растояние спавна
const SAFE_DISTANCE  = 24  // Безопасная зона, где не спанятся мобы
const MAX_COUNT_MOBS = 70  // максимальное количество мобов в радиусе RADIUS_DESPAWN блоков
const FIND_SPAWN_POSITION_ATTEMPTS_COUNT = 50 // количество попыток найти подходящее место
const MAX_COUNT_IN_GROUP = 1 // количество мобов в группе

export class SpawnMobs {
    private world: ServerWorld
    private ambient_light: number
    
    constructor(world: ServerWorld) {
        this.world = world
        this.ambient_light = (this.world.info.rules.ambientLight || 0) * 255 / 15
    }

    // Спавн враждебных мобов в тёмных местах (пока тёмное время суток)
    autoSpawnHostileMobs() {
        const world = this.world
        const bad_world_for_spawn = world.isBuildingWorld()
        const auto_generate_mobs = world.getGeneratorOptions('auto_generate_mobs', true)
        const do_mob_spawning = world.rules.getValue('doMobSpawning')
        // не спавним мобов в мире-конструкторе и с отключенными опциями
        if (!auto_generate_mobs || bad_world_for_spawn || !do_mob_spawning) {
            return
        }
        // тип мобов
        const model_name = (Math.random() < .5) ? MOB_TYPE.ZOMBIE : MOB_TYPE.SKELETON;
        // находим игроков
        for (const player of world.players.values()) {
            if (player.game_mode.isSpectator() || player.status === PLAYER_STATUS.DEAD) {
                // console.log('spawn: PLAYER_STATUS.DEAD')
                continue
            }
            // находим позицию для спавна
            const spawn_pos = this.findPosition(player.state.pos)
            if (!spawn_pos) {
                // console.log('spawn: !spawn_pos')
                continue
            }
            // количество мобов не должно превышать максимума
            const mobs = world.getMobsNear(spawn_pos, RADIUS_DESPAWN, [model_name])
            if (mobs.length >= MAX_COUNT_MOBS) {
                // console.log('spawn: MAX_COUNT_MOBS')
                continue
            }
            // спавним центрального моба
            const actions = new WorldAction(null, this, false, false)
            actions.spawnMob(new MobSpawnParams(spawn_pos.offset(.5, 0, .5), Vector.ZERO.clone(), {model_name, texture_name: DEFAULT_MOB_TEXTURE_NAME}))
            let count_in_group = 1
            // попытка заспавнеить группу мобов
            for (let i = 0; i < MAX_COUNT_IN_GROUP - 1; i++) {
                if (count_in_group > 4) {
                    break
                }
                const x = spawn_pos.x + 5 * (Math.random() - Math.random())
                const y = spawn_pos.y
                const z = spawn_pos.z + 5 * (Math.random() - Math.random())
                const spawn_pos_shift = new Vector(x, y, z).flooredSelf()
                if (this.isValidPosition(spawn_pos_shift)) {
                    count_in_group++
                    actions.spawnMob(new MobSpawnParams(spawn_pos_shift.offset(.5, 0, .5), Vector.ZERO.clone(), {model_name, texture_name: DEFAULT_MOB_TEXTURE_NAME}))
                }
            }
            world.actions_queue.add(null, actions)
            console.log(`Auto spawn ${count_in_group} ${model_name} pos spawn: ${spawn_pos.toHash()}`)
        }
    }

    isValidPosition(pos: Vector): boolean {
        const world = this.world
        // check under block
        const under = world.getBlock(pos.offset(0, -1, 0))
        if (!under || (!under.material.is_solid && !under.material.layering)) {
            return false
        }
        //
        const checkBodyBlock = (tblock? : TBlock) : boolean => {
            if (!tblock || (tblock.id != 0 && tblock.material.style_name != 'planting')) return false
            if ((tblock.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID) return false
            if ((tblock.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) return false
            return true
        }
        // legs
        const legs = world.getBlock(pos)
        if(!checkBodyBlock(legs)) return false
        // check legs light value
        const lv = legs.lightValue
        const cave_light = lv & 255
        const day_light = 255 - (lv >> 8) & 255
        if (cave_light > this.ambient_light) {
            return false
        }
        if (world.getLight() > 6) {
            if (day_light > this.ambient_light) {
                return false
            }
        }
        // check over block
        if(!checkBodyBlock(world.getBlock(pos.offset(0, 1, 0)))) return false
        //
        return true
    }

    // случайна координата между двух сфер
    getRandomPosition(in_radius: number, out_radius: number) {
        const r = Math.random() * (out_radius - in_radius + 1) + in_radius
        const pi = Math.random() * 2 * Math.PI
        const fi = Math.random() * 2 * Math.PI
        const x = r * Math.sin(pi) * Math.cos(fi)
        const y = r * Math.sin(pi) * Math.sin(fi)
        const z = r * Math.cos(pi)
        return new Vector(x, y, z)
    }

    findPosition(pos: Vector) : Vector | null {
        for(let i = 0; i < FIND_SPAWN_POSITION_ATTEMPTS_COUNT; i++) {
            // выбираем рандомную позицию для спауна
            const spawn_pos = this.getRandomPosition(SAFE_DISTANCE, SPAWN_DISTANCE)
            spawn_pos.addSelf(pos).flooredSelf()
            if (this.isValidPosition(spawn_pos)) {
                const players = this.world.getPlayersNear(spawn_pos, SAFE_DISTANCE)
                if (players.length == 0) {
                    return spawn_pos
                } 
            }
        }
        return null
    }

}