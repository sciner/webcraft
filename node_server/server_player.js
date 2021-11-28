import {Player} from "../www/js/player.js";
import {ServerClient} from "../www/js/server_client.js";

export class ServerPlayer extends Player {

    constructor() {
        super();
    }

    //
    async joinToServerWorld(session_id, skin, conn, world) {
        this.conn = conn;
        this.world = world;
        conn.player = this;
        conn.on('message', async (req) => {
            let cmd = JSON.parse(req);
            switch(cmd.name) {
                case ServerClient.CMD_CHAT_SEND_MESSAGE: {
                    this.world.chat.sendMessage(this, cmd.data)
                    break;
                }
                case ServerClient.CMD_CONNECT: {
                    let world_guid = cmd.data.world_guid;
                    this.session = await Game.Db.GetPlayerSession(session_id);
                    world.onPlayer(this, skin);
                }
            }
        });
        //
        conn.on('close', async (e) => {
            this.world.onLeave(this);
        });
        //
        this.sendPackets([{
            name: ServerClient.CMD_HELLO,
            data: 'Welcome to MadCraft ver. 0.0.1'
        }]);
        this.sendPackets([{name: ServerClient.CMD_WORLD_INFO, data: world.info}]);
    }

    // sendPackets...
    sendPackets(packets) {
        this.conn.send(JSON.stringify(packets));
    }

    // onLeave...
    onLeave() {
    }

}