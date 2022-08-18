import { BLOCK } from '../../www/js/blocks.js';
import { Vector, DIRECTION } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

export default class Ticker {

    static type = 'beacon'
    
    //
    static func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();
        if(v.ticks % 40 != 0) {
            return;
        }
        
        const isPrecious = (n) => {
            for (let i = -n; i <= n; i++) {
                for (let j = -n; j <= n; j++) {
                    const block = world.getBlock(pos.add(new Vector(i, -n, j)));
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
            if (isPrecious(2)) {
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
            for (let i = 1; i < 310; i++) {
                const block = world.getBlock(pos.add(new Vector(0, i, 0)));
                if (block && block.id != BLOCK.AIR.id) {
                    extra_data.level = 0;
                    break;
                }
            }
        }
        
        const updated_blocks = [];
        if (level != extra_data.level) {
            updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
        }
        return updated_blocks;
    }
    
}
