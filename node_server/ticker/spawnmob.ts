import {Vector} from "@client/helpers.js";
import { BLOCK_ACTION } from "@client/server_client.js";
import { WorldAction } from "@client/world_action.js";
import type { TickingBlockManager } from "../server_chunk.js";
import { MOB_TYPE, WORLD_TYPE_BUILDING_SCHEMAS } from "@client/constant.js";
import type { PlayerSkin } from "@client/player.js";
import type { MobSpawnParams } from "mob.js";
import type { ServerWorld } from "server_world.js";
import type { TBlock } from "@client/typed_blocks3.js";

const SPAWN_PLAYER_DISTANCE     = 16;
const SPAWN_RAD_HOR             = 4;
const SPAWN_RAD_VERT            = 2;
const SPAWN_ATTEMPTS            = 4;

export default class Ticker {

    static type = 'spawnmob'

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk, v : {pos: Vector, tblock : TBlock}) {
        if (world.info.world_type_id == WORLD_TYPE_BUILDING_SCHEMAS) {
            return
        }
        const bm = world.block_manager
        const tblock = v.tblock
        const extra_data = tblock.extra_data
        const updated_blocks = []
        const pos = v.pos.clone()
        const auto_generate_mobs = world.getGeneratorOptions('auto_generate_mobs', false)

        // Одноразовый спавнер
        if (extra_data?.limit?.count === 1) {
            const spawn_pos = pos.clone().addScalarSelf(.5, 0, .5)
            const mob_extra_data = bm.calculateExtraData(extra_data, spawn_pos)
            const skin : PlayerSkin = Ticker.hotFixSkin(world, mob_extra_data)
            if(!skin) {
                console.error('error_spawnmob_invalid_extra_data', mob_extra_data)
                return
            }
            //
            const params : MobSpawnParams = {
                skin:       skin,
                pos:        spawn_pos,
                pos_spawn:  spawn_pos.clone(),
                rotate:     new Vector(0, 0, 0).toAngles()
            }
            if (auto_generate_mobs) {
                Ticker.spawnMob(world, params)
            }
            updated_blocks.push({ pos: pos.clone(), item: { id: bm.AIR.id }, action_id: BLOCK_ACTION.MODIFY });
            // Delete completed block from tickings
            this.delete(v.pos)
            return updated_blocks
        }

        if(tick_number % extra_data.max_ticks == 0) {
            // Проверяем наличие игроков в указанном радиусе
            const players = world.getPlayersNear(pos, SPAWN_PLAYER_DISTANCE, false, true);
            if (players.length == 0) {
                return;
            }

            // Спаунер перестает создавать мобов, если в зоне размером 17x9x17 находятся шесть или более мобов одного типа.
            // Проверяем количество мобов в радиусе(в радиусе 4 блоков не должно быть больше 5 мобов)
            const mobs = world.getMobsNear(pos, SPAWN_PLAYER_DISTANCE, [extra_data.type]);
            if (mobs.length > 5) {
                console.warn('mobs.length >= 6');
                return;
            }

            // Место спауна моба, 4 попытки. Если на координатак моб, игрок или блок, то не спавним
            for(let i = 0; i < SPAWN_ATTEMPTS - mobs.length; i++) {
                const x = Math.floor(Math.random() * (SPAWN_RAD_HOR * 2 + 1) + -SPAWN_RAD_HOR);
                const z = Math.floor(Math.random() * (SPAWN_RAD_HOR * 2 + 1) + -SPAWN_RAD_HOR);
                const y = (Math.random() * SPAWN_RAD_VERT) | 0
                const spawn_pos = pos.clone().addScalarSelf(x, y, z).flooredSelf()
                let spawn_disabled = false;
                //
                for(const player of players) {
                    const check_pos = player.state.pos.floored();
                    if (check_pos.x == spawn_pos.x && check_pos.z == spawn_pos.z) {
                        spawn_disabled = true;
                        break;
                    }
                }
                if(!spawn_disabled) {
                    // check mobs
                    for(const mob of mobs) {
                        const check_pos = mob.pos.floored();
                        if (check_pos.x == spawn_pos.x && check_pos.z == spawn_pos.z) {
                            spawn_disabled = true;
                            break;
                        }
                    }
                    // Проверяем есть ли блок на пути и что под ногами для нейтральных мобов
                    const body = world.getBlock(spawn_pos);
                    // const legs = world.getBlock(spawn_pos.sub(Vector.YP));
                    if (body.id != 0) {
                        spawn_disabled = true;
                    }
                    // проверяем освещенность для нежити
                    if ((body.lightValue & 0xFF) > 160 || ((body.lightValue >> 8) < 100)) {
                        if (extra_data.type == MOB_TYPE.ZOMBIE || extra_data.type == MOB_TYPE.SKELETON) {
                            spawn_disabled = true
                        }
                    }
                    if(!spawn_disabled) {
                        spawn_pos.addScalarSelf(.5, 0, .5)
                        const params = {
                            skin:       Ticker.hotFixSkin(world, extra_data),
                            pos:        spawn_pos,
                            pos_spawn:  spawn_pos.clone(),
                            rotate:     new Vector(0, 0, 0).toAngles()
                        };
                        Ticker.spawnMob(world, params);
                    }
                }
            }
            // между попытками создания мобов спаунер ждёт случайно выбранный промежуток времени от 200 до 799
            extra_data.max_ticks = ((Math.random() * 600) | 0) + 200;
            updated_blocks.push({pos: v.pos.clone(), item: {id: tblock.id, extra_data: extra_data}, action_id: BLOCK_ACTION.MODIFY});
            return updated_blocks;
        }
    }

    //
    static spawnMob(world : ServerWorld, params : MobSpawnParams) {
        console.log(`Spawn mob ${params.pos.toHash()}`)
        const actions = new WorldAction(null, world, false, false)
        actions.spawnMob(params)
        world.actions_queue.add(null, actions)
    }

    // hotfix skin
    static hotFixSkin(world : ServerWorld, extra_data: any) : PlayerSkin | null {
        const skin : PlayerSkin = {
            model_name: extra_data.type,
            texture_name: extra_data.skin
        }
        let exists_skin = null
        for(const skin_item of world.worker_world.skin_list) {
            if([skin.model_name, `mob/${skin.model_name}`].includes(skin_item.model_name)) {
                if(!exists_skin) {
                    exists_skin = skin_item
                }
                if(skin_item.texture_name == skin.texture_name) {
                    exists_skin = skin_item
                    break
                }
            }
        }
        if(!exists_skin) {
            return null
        }
        skin.model_name = exists_skin.model_name
        skin.texture_name = exists_skin.texture_name
        return skin
    }

}