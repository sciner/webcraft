import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import {
    gzip,
    ungzip,
    inflate,
    deflate,
} from '../../www/vendors/pako.esm.min.mjs';

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
        for (let [user_id, packets] of this.list) {
            // Group mob update packets
            let mob_update_packet = null;
            const min_mob_pos = new Vector(Infinity, Infinity, Infinity);
            for (let i = 0; i < packets.length; i++) {
                const p = packets[i];
                if (p.name == ServerClient.CMD_MOB_UPDATE) {
                    const x = Math.round(p.data.pos.x);
                    const y = Math.round(p.data.pos.y);
                    const z = Math.round(p.data.pos.z);
                    if (x < min_mob_pos.x) min_mob_pos.x = x;
                    if (y < min_mob_pos.y) min_mob_pos.y = y;
                    if (z < min_mob_pos.z) min_mob_pos.z = z;
                }
            }
            packets = packets.filter((p) => {
                if (p.name == ServerClient.CMD_MOB_UPDATE) {
                    if (!mob_update_packet) {
                        mob_update_packet = {
                            name: p.name,
                            data: [min_mob_pos.x, min_mob_pos.y, min_mob_pos.z],
                        };
                    }
                    mob_update_packet.data.push(
                        p.data.id,
                        Math.round((p.data.pos.x - min_mob_pos.x) * 1000) /
                            1000,
                        Math.round((p.data.pos.y - min_mob_pos.y) * 1000) /
                            1000,
                        Math.round((p.data.pos.z - min_mob_pos.z) * 1000) /
                            1000,
                        // p.data.rotate.x, p.data.rotate.y,
                        Math.round(p.data.rotate.z * 1000) / 1000,
                        p.data.extra_data,
                    );
                    return false;
                }
                return true;
            });
            if (mob_update_packet) {
                // // perf checker
                // if(!globalThis.mpsz) globalThis.mpsz = {
                //     total_size: 0,
                //     total_gzipped: 0,
                //     avg_size: 0,
                //     avg_size_per_sec: 0,
                //     avg_gzipped_size_per_sec: 0,
                //     count: 0
                // }
                // const test_packet = JSON.parse(JSON.stringify(mob_update_packet))
                // while(test_packet.data.length < 600) {
                //     test_packet.data.push(...test_packet.data.slice(3, 9))
                // }
                // const mpsz = globalThis.mpsz
                // const mdt = JSON.stringify(test_packet)
                // const psz = mdt.length
                // let buf = gzip(mdt)
                // mpsz.count++
                // mpsz.total_size += psz
                // mpsz.total_gzipped += buf.length
                // mpsz.avg_size = Math.round(mpsz.total_size / mpsz.count)
                // mpsz.avg_size_per_sec = Math.round(mpsz.total_size / mpsz.count * 20)
                // mpsz.avg_gzipped_size_per_sec = Math.round(mpsz.total_gzipped / mpsz.count * 20)
                // console.log('mob packet', JSON.stringify(mpsz, null, 4))

                packets.push(mob_update_packet);
            }
            this.world.sendSelected(packets, [user_id]);
        }
        this.list.clear();
    }
}
