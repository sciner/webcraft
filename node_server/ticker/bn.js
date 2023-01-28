import { BLOCK } from '../../www/js/blocks.js'
import { Vector } from '../../www/js/helpers.js'
import { ServerClient } from '../../www/js/server_client.js'
import { Effect } from '../../www/js/block_type/effect.js';

const CHECK_MAX_BLOCKS_OVER_ME = 310;

export default class Ticker {

    static type = 'beacon'
    
    //
    static func(tick_number, world, chunk, v) {

        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();

        // only every ~4 sec
        if(tick_number % 80 != 0) {
            return;
        }

        let is_update = false;
        const level = extra_data.state.level

        //console.log(extra_data);
        /*
        // драгоценный блок или нет
        const isPrecious = (n) => {
            const vec = new Vector();
            for (let i = -n; i <= n; i++) {
                for (let j = -n; j <= n; j++) {
                    const block = world.getBlock(vec.copyFrom(pos).addScalarSelf(i, -n, j));
                    if(!block) {
                        return false;
                    }
                    // можно строить только из алмазных, изумрудных, золотых, железных, незеритовых
                    if (![BLOCK.GOLD_BLOCK.id, BLOCK.DIAMOND_BLOCK.id, BLOCK.EMERALD_BLOCK.id, BLOCK.IRON_BLOCK.id, BLOCK.NETHERITE_BLOCK.id].includes(block.id)) {
                        return false;
                    }
                }
            }
            return true;
        };

        // старые данные
        const level = extra_data.level;
        // проверяем бонусы и включение
        if (isPrecious(1)) {
            extra_data.level = 1;
            /*if (isPrecious(2)) {
                extra_data.level = 2;
                if (isPrecious(3)) {
                    extra_data.level = 3;
                    if (isPrecious(4)) {
                        extra_data.level = 4;
                    }
                }
            }
        } else {
            extra_data.level = 0;
        }
        
        // проверка преград на пути луча или стекла для раскраски
        if (extra_data.level > 0) {
            const check_vec = pos.clone();
            for(let i = 1; i < CHECK_MAX_BLOCKS_OVER_ME; i++) {
                check_vec.y++;
                const block = world.getBlock(check_vec);
                if (block && block.id != BLOCK.AIR.id) {
                    extra_data.level = 0;
                    break;
                }
            }
        }
        
        const updated_blocks = [];
        if(level != extra_data.level) {
            updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
        }
        return updated_blocks;
        */

        // драгоценный блок или нет
        const isPrecious = (n) => {
            for (let i = -n; i <= n; i++) {
                for (let j = -n; j <= n; j++) {
                    const block = world.getBlock(pos.offset(i, -n, j))
                    if(!block) {
                        return false
                    }
                    // можно строить только из алмазных, изумрудных, золотых, железных, незеритовых
                    if (![BLOCK.GOLD_BLOCK.id, BLOCK.DIAMOND_BLOCK.id, BLOCK.EMERALD_BLOCK.id, BLOCK.IRON_BLOCK.id, BLOCK.NETHERITE_BLOCK.id].includes(block.id)) {
                        return false
                    }
                }
            }
            return true
        }

        const state = extra_data.state

        if (isPrecious(1)) {
            state.level = 1
            if (isPrecious(2)) {
                state.level = 2
                if (isPrecious(3)) {
                    state.level = 3
                    if (isPrecious(4)) {
                        state.level = 4
                    }
                }
            }
        } else {
            state.level = 0
        }

        // Накладывания эффектов на игроков
        if (state.level != 0) {
            const max_distance = (state.level + 1) * 10
            const time = state.level  * 2 + 9
            const players = world.getPlayersNear(pos, max_distance, true, false)
            let effect = 0
            let level = 1
            if (state.level > 0 && (state.first == Effect.SPEED || state.first == Effect.HASTE) || (state.level > 1 && (state.first == Effect.RESISTANCE || state.first == Effect.JUMP_BOOST)) || (state.level > 2 && state.first == Effect.STRENGTH)) {
                effect = state.first
            }
            if (state.level > 3 && state.second == Effect.REGENERATION) {
                effect = Effect.REGENERATION
            }
            if (state.level > 3 && state.second == 0) {
                level = 2
            }
            for (const player of players) {
                player.effects.addEffects([{id: effect, time: time, level: level}])
            }
        }

        // если что-то обновилось, то шлём это игрокам
        if (state.level != level) {
            console.log('update')
            world.chests.sendChestToPlayers(tblock, null)
            return [{pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}]
        }
    }
    
}
