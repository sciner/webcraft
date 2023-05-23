import { BLOCK } from '@client/blocks.js'
import { BLOCK_ACTION } from '@client/server_client.js'
import { Effect } from '@client/block_type/effect.js'
import type { ServerWorld } from '../server_world.js';
import type { ServerChunk } from '../server_chunk.js';
import type { TickingBlockManager } from "../server_chunk.js";

export default class Ticker {

    static type = 'beacon'

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk : ServerChunk, v) {

        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();
        // only every ~4 sec
        if(tick_number % 80 != 0) {
            return;
        }
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
        const state = extra_data.state ?? {}
        const level = extra_data.state?.level ?? 0
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
            world.chests.sendChestToPlayers(tblock, null)
            return [{pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: BLOCK_ACTION.MODIFY}]
        }

    }

}
