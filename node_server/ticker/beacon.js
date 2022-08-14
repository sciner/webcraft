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
        const updated_blocks = [];
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
        // Проверка основания для включения
        extra_data.power = isPrecious(1);
        // to do пока отключим Проверяем бонусы
        if (extra_data.power && 1 == 2) {
            console.log("on");
            if (isPrecious(2)) {
                console.log("bonuse 2");
                if (isPrecious(3)) {
                    console.log("bonuse 3");
                    if (isPrecious(4)) {
                        console.log("bonuse 4");
                    }
                }
            }
        }
        
        // проверка преград на пути луча или стекла для раскраски
        if (extra_data.power) {
            for (let i = 0; i < 310; i++) {
                const block = world.getBlock(pos.add(Vector.YP));
                if (block.id != BLOCK.AIR.id) {
                    extra_data.power = false;
                    break;
                }
            }
        }
        
        return updated_blocks;
    }
    
}
