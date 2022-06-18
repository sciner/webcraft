import { Vec3, Vector } from "../../../www/js/helpers.js";
import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_DROP_ITEM;
    }

    // Drop item from hand
    static async read(player, packet) {
        if(!player.game_mode.canDropItems()) {
            return true;
        }
        
        let perf = performance.now();
        let addr = new Vector(-0.5, -0.5, -0.5);
        const size = new Vector(160000000, 400000000, 100000006);
        //for(let i = 0; i < 0; i++) {
            let mobs = await player.world.db.mobs.loadInChunk(addr, size);
        //}
        console.log(performance.now() - perf, mobs.size)
        //
        player.inventory.dropItem();
        return true;
    }

}