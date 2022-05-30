import { ServerClient } from "../../www/js/server_client.js";
import fs from 'fs';
import path from "path";

export class PacketReader {

    constructor() {

        // packet queue
        this.queue = {
            list: [],
            add: function() {},
            run: function() {}
        };

        //
        this.registered_readers = new Map();

        // Load all packet readers from directory
        const packets_dir = path.join(__dirname, '/network/clientpackets');
        fs.readdir(packets_dir, (err, files) => {
            files.forEach(file => {
                const file_path = path.join(packets_dir, file).replace(path.join(__dirname, '/network'), '.').replace('\\', '/');
                import(file_path).then(module => {
                    this.registered_readers.set(module.default.command, module.default);
                    console.info(`Registered client packet reader: ${module.default.command}`)
                });
            });
        });

    }

    // Read packet
    async read(player, packet) {

        if (player.is_dead && [ServerClient.CMD_RESURRECTION, ServerClient.CMD_CHUNK_LOAD].indexOf(packet.name) < 0) {
            return;
        }

        try {
            const reader = this.registered_readers.get(packet?.name);
            if(reader) {
                await reader.read(player, packet);
            } else {
                console.log(`ERROR: Not found packet reader for command: ${packet.name}`);
            }
        } catch(e) {
            console.log(e);
            const packets = [{
                name: ServerClient.CMD_ERROR,
                data: {
                    message: e
                }
            }];
            player.world.sendSelected(packets, [player.session.user_id], []);
        }

    }

}