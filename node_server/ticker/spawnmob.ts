import {Vector} from "@client/helpers.js";
import {BLOCK} from "@client/blocks.js";
import {ServerClient} from "@client/server_client.js";
import { WorldAction } from "@client/world_action.js";
import type { TickingBlockManager } from "../server_chunk.js";
import { MOB_TYPE } from "@client/constant.js";

const SPAWN_PLAYER_DISTANCE     = 16;
const SPAWN_RAD_HOR             = 4;
const SPAWN_RAD_VERT            = 2;
const SPAWN_ATTEMPTS            = 4;

export default class Ticker {

    static type = 'spawnmob'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        if (world.info.title == 'BLDGFYT') {
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
            const npc_extra_data = bm.calculateExtraData(extra_data, spawn_pos)
            const params = {
                type: npc_extra_data.type,
                skin: npc_extra_data.skin,
                pos: spawn_pos,
                pos_spawn: spawn_pos.clone(),
                rotate: new Vector(0, 0, 0).toAngles()
            }
            if (auto_generate_mobs) {
                Ticker.spawnMob(world, params)
            }
            updated_blocks.push({ pos: pos.clone(), item: { id: bm.AIR.id }, action_id: ServerClient.BLOCK_ACTION_MODIFY });
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

            // Место спауна моба, 4 попытки. Если на координатак моб, игрок или блок, то не спауним
            for(let i = 0; i < SPAWN_ATTEMPTS - mobs.length; i++) {
                const x = Math.floor(Math.random() * (SPAWN_RAD_HOR * 2 + 1) + -SPAWN_RAD_HOR);
                const z = Math.floor(Math.random() * (SPAWN_RAD_HOR * 2 + 1) + -SPAWN_RAD_HOR);
                const y = Math.random() * SPAWN_RAD_VERT | 0;
                const spawn_pos = pos.clone().addScalarSelf(x, y, z).floored()
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
                    // проверяем освещенность для нежети
                    if ((body.lightValue & 0xFF) > 160 || ((body.lightValue >> 8) < 100)) {
                        if (extra_data.type == MOB_TYPE.ZOMBIE || extra_data.type == MOB_TYPE.SKELETON) {
                            spawn_disabled = true
                        }
                    }
                    if(!spawn_disabled) {
                        const params = {
                            type:       extra_data.type,
                            skin:       extra_data.skin,
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
            updated_blocks.push({pos: v.pos.clone(), item: {id: tblock.id, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            return updated_blocks;
        }
    }

    //
    static spawnMob(world, params) {
        console.log('Spawn mob', params.pos.toHash());
        const actions = new WorldAction(null, world, false, false);
        actions.spawnMob(params);
        world.actions_queue.add(null, actions);
    }

}