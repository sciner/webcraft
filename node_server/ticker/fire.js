import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

export default class Ticker {

    static type = 'fire';
    
    //
    static func(world, chunk, v) {
        console.log("fire");
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();

        // only every ~4 sec
       ////if(v.ticks % 40 != 0) {
          //  return;
        //}
        
        const updated_blocks = [];
        
        return updated_blocks;
    }
    
}
