import { ServerClient } from "../../www/js/server_client.js";

// Queue for packets
export class WorldPacketQueue {

    constructor(world) {
        this.world = world;
        this.list = new Map();
    }

    add(user_ids, packets) {
        for (let user_id of user_ids) {
            let arr = this.list.get(user_id);
            if (!arr) {
                arr = [];
                this.list.set(user_id, arr);
            }
            arr.push(...packets);
        }
    }

    send() {
        for(let [user_id, packets] of this.list) {
            // Group mob update packets
            let mob_update_packet = null;
            packets = packets.filter(p => {
                if (p.name == ServerClient.CMD_MOB_UPDATE) {
                    if (!mob_update_packet) {
                        mob_update_packet = { name: p.name, data: [] }
                    }
                    mob_update_packet.data.push(
                        p.data.id,
                        p.data.pos.x, p.data.pos.y, p.data.pos.z,
                        // p.data.rotate.x, p.data.rotate.y,
                        p.data.rotate.z,
                        p.data.extra_data
                    );
                    return false;
                }
                return true;
            });
            if (mob_update_packet) {
                packets.push(mob_update_packet);
            }
            this.world.sendSelected(packets, [user_id]);
        }
        this.list.clear();
    }

}