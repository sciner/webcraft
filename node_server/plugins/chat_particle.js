import { ServerClient } from '../../www/js/server_client.js';
import { Vector } from '../../www/js/helpers.js';

export default class ParticlePlugin {
    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    sendMessage(text, player) {
        let packets = [
            {
                name: ServerClient.CMD_CHAT_SEND_MESSAGE,
                data: {
                    username: '<MadCraft>',
                    text: text,
                },
            },
        ];
        player.sendPackets(packets, [player], []);
    }

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            if (cmd == '/particle') {
                args = chat.parseCMD(args, ['string', 'string']);
                const type = args[1];
                const pos = player.state.pos.add(
                    new Vector(
                        2 * Math.sin(player.state.rotate.z),
                        0,
                        2 * Math.cos(player.state.rotate.z),
                    ),
                );
                player.world.sendSelected(
                    [
                        {
                            name: ServerClient.CMD_GENERATE_PARTICLE,
                            data: {
                                type: type,
                                pos: pos,
                            },
                        },
                    ],
                    player,
                );
                return true;
            }
            return false;
        });
    }
}
