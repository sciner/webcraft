import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

export default class Ticker {

    static type = 'tnt';
    
    //
    static func(world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();

        // only every ~1 sec
        if(v.ticks % 10 != 0) {
            return;
        }
        
        const updated_blocks = [];
        actions.makeExplosion(mobPosCenter, rad, true, 1/3, 6);
        return updated_blocks;
    }
    
}