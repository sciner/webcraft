import {Player} from "../www/js/player.js";
import {ServerClient} from "../www/js/server_client.js";

export class ServerPlayer extends Player {

    constructor() {
        super();
    }

    //
    async joinToServerWorld(session_id, conn, world) {
        this.conn = conn;
        this.world = world;
        conn.player = this;
        conn.on('message', async (req) => {
            let cmd = JSON.parse(req);
            switch(cmd.name) {
                case ServerClient.CMD_CONNECT: {
                    let world_guid = cmd.data.world_guid;
                    this.session = await Game.Db.GetPlayerSession(session_id);
                    let player_state = await world.Db.RegisterUser(world, this);
                    let data = {
                        session: this.session,
                        state:   player_state,
                    }
                    conn.sendMixed([{name: ServerClient.CMD_CONNECTED, data: data}]);
                    conn.sendMixed([{name: ServerClient.CMD_NEARBY_MODIFIED_CHUNKS, data: []}]);
                    // @todo Send to all about new players
                    /*let player_world_state = Game.Db.
                    params := &Struct.ParamPlayerJoin{
                        ID:       c.ID,
                        Skin:     c.Skin,
                        Username: c.Session.Username,
                        Pos:      c.Pos,
                        Rotate:   c.Rotate,
                    }
                    packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_JOIN, Data: params, ID: nil}
                    */
                }
            }
        });
        conn.sendMixed = (packets) => {
            conn.send(JSON.stringify(packets));
        };
        conn.sendMixed([{
            name: ServerClient.CMD_HELLO,
            data: 'Welcome to madcraft ver. 0.0.1'
        }]);
        conn.sendMixed([{name: ServerClient.CMD_WORLD_INFO, data: world.info}]);
    }

}