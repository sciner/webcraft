import { WorldAction } from '../../www/js/world_action.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

export default class Ticker {
    static type = 'bee_nest';

    //
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if (tick_number % extra_data.max_ticks == 0) {
            if (extra_data.bees.length > 0) {
                const day_time = world.info.calendar.day_time;
                if (day_time > 6000 && day_time < 18000) {
                    const item = extra_data.bees.pop();
                    // позиция в центре, ближе передней стенки улья
                    // надо каждый раз пересчитывать, потому что улей могли перенести с пчелами на новое место
                    const spawn_pos = tblock.posworld
                        .clone()
                        .addSelf(new Vector(0.5, 0.5, 0.5))
                        .addByCardinalDirectionSelf(
                            new Vector(0, 0, 0.4),
                            tblock.rotate.x,
                        );
                    // const spawn_tblock = world.getBlock(spawn_pos.floored());
                    if (item.entity_id) {
                        // активация ранее созданного моба
                        const params = {
                            entity_id: item.entity_id,
                            spawn_pos: spawn_pos,
                            rotate: new Vector(
                                0,
                                0,
                                (tblock.rotate.x / 4) * -(2 * Math.PI),
                            ),
                        };
                        Ticker.activateMob(world, params);
                    } else {
                        // первая генерация моба, если его ещё не было в БД
                        const params = {
                            type: 'bee',
                            skin: 'base',
                            pos: spawn_pos,
                        };
                        // create new mob in world
                        Ticker.spawnMob(world, params);
                    }
                    // update this ticking block state
                    updated_blocks.push({
                        pos: tblock.posworld.clone(),
                        item: tblock.convertToDBItem(),
                        action_id: ServerClient.BLOCK_ACTION_MODIFY,
                    });
                }
            }
        }
        return updated_blocks;
    }

    // Activate mob (активация ранее созданного моба)
    static activateMob(world, params) {
        console.log('Activate mob', params.spawn_pos.toHash());
        const actions = new WorldAction(null, world, false, false);
        actions.activateMob(params);
        world.actions_queue.add(null, actions);
    }

    // Spawn mob (первая генерация моба, если его ещё не было в БД)
    static spawnMob(world, params) {
        console.log('Spawn mob', params.pos.toHash());
        const actions = new WorldAction(null, world, false, false);
        actions.spawnMob(params);
        world.actions_queue.add(null, actions);
    }
}
