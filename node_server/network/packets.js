import {ServerClient} from "../../www/js/server_client.js";
import {CMD_MODIFY_INDICATOR_REQUEST} from "./clientpackets/cmd_modify_indicator_request.js";
import {CMD_SYNC_TIME} from "./clientpackets/cmd_sync_time.js";
import {CMD_PLAYER_STATE} from "./clientpackets/cmd_player_state.js";
import {CMD_STATS} from "./clientpackets/cmd_stats.js";
import {CMD_PICKAT_ACTION} from "./clientpackets/cmd_pickat_action.js";
import { CMD_RESURRECTION } from "./clientpackets/cmd_resurrection.js";

export class Packet {
    constructor(){
        
    }

    ReadPacket(player, packet) {
        if (player.is_die && packet.name != ServerClient.CMD_RESURRECTION)
        {
            return;
		}
        if (packet.name < 96 && packet.name != ServerClient.CMD_MODIFY_INDICATOR_REQUEST && packet.name != ServerClient.CMD_SYNC_TIME && packet.name != ServerClient.CMD_PLAYER_STATE && packet.name != ServerClient.CMD_PICKAT_ACTION) {
            return;
        }
        try {
            switch (packet.name) {

                case ServerClient.CMD_MODIFY_INDICATOR_REQUEST:
                    new CMD_MODIFY_INDICATOR_REQUEST(player, packet.data);
                    break;
                case ServerClient.CMD_SYNC_TIME:
                    new CMD_SYNC_TIME(player, packet.data);
                    break;
                case ServerClient.CMD_PLAYER_STATE:
                    new CMD_PLAYER_STATE(player, packet.data);
                    break;
                case ServerClient.CMD_STATS:
                    new CMD_STATS(player, packet.data);
                    break;
                case ServerClient.CMD_PICKAT_ACTION:
                    new CMD_PICKAT_ACTION(player, packet.data);
                    break;
                case ServerClient.CMD_RESURRECTION:
                    new CMD_RESURRECTION(player, packet.data);
                    break;
                default:
                    console.log(packet.name + " not found code");
            }
        } catch(e) {
            console.log(e);
        }
    }
}