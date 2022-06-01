import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be puto to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_CHEST_CONFIRM;
    }

    // 
    static async read(player, packet) {
        const chests = player.world.chests;
        const pos = packet.data.chest.pos;
        const chest = await chests.get(pos);
        if (chest) {
            console.log('Chest state from ' + player.session.username, packet.data);
            await chests.confirmPlayerAction(player, pos, packet.data);
        } else {
            player.inventory.refresh(true);
            const pos_hash = pos.toHash();
            throw `Chest ${pos_hash} not found`;
        }
        return true;
    }

}