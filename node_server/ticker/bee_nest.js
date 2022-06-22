import { Vector } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'bee_nest'

    //
    static async func(world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(v.ticks % extra_data.max_ticks == 0) {
            if(extra_data.bees.length > 0) {
                const day_time = world.info.calendar.day_time;
                if (day_time > 6000 && day_time < 18000) {
                    const item = extra_data.bees.pop();
                    // позиция в центре, ближе передней стенки улья
                    // надо каждый раз пересчитывать, потому что улей могли перенести с пчелами на новое место
                    const spawn_pos = tblock.posworld
                        .clone()
                        .addSelf(new Vector(.5, .5, .5))
                        .addByCardinalDirectionSelf(new Vector(0, 0, .4), tblock.rotate.x);
                    // const spawn_tblock = world.getBlock(spawn_pos.floored());
                    if(item.entity_id) {
                        // активация ранее созданного моба
                        await world.mobs.activate(item.entity_id, spawn_pos, new Vector(0, 0, (tblock.rotate.x / 4) * -(2 * Math.PI)));
                    } else {
                        // первая генерация моба, если его ещё не было в БД
                        const params = {
                            type: 'bee',
                            skin: 'base',
                            pos: spawn_pos
                        };
                        // create new mob in world
                        await world.mobs.create(params);
                    }
                    // update this ticking block state
                    updated_blocks.push({
                        pos: tblock.posworld.clone(),
                        item: tblock.convertToDBItem(),
                        action_id: ServerClient.BLOCK_ACTION_MODIFY
                    });
                }
            }
        }
        return updated_blocks;
    }

}