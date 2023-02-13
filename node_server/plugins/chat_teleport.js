import { ServerClient } from '../../www/js/server_client.js';
import { Vector } from '../../www/js/helpers.js';

const reg = /[^a-z0-9\s]/gi;

export default class TeleportPlugin {
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

    chTitle(title) {
        return !title.match(reg) && title.length < 50;
    }

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            let world = player.world;
            switch (cmd) {
                case '/teleport': {
                    let subcmd = args[1];
                    let id = player.session.user_id;
                    if (args.length == 5) {
                        if (subcmd == 'go') {
                            let x = parseFloat(args[2]);
                            let y = parseFloat(args[3]);
                            let z = parseFloat(args[4]);
                            let pos = new Vector(x, y, z);
                            player.teleport({ place_id: null, pos: pos });
                            return true;
                        }
                    } else if (args.length == 3) {
                        let title = args[2].trim();
                        if (subcmd == 'add') {
                            if (this.chTitle(title)) {
                                let x =
                                    Math.round(player.state.pos.x * 1000) /
                                    1000;
                                let y =
                                    Math.round(player.state.pos.y * 1000) /
                                    1000;
                                let z =
                                    Math.round(player.state.pos.z * 1000) /
                                    1000;
                                let row = await world.db.getTeleportPoint(
                                    id,
                                    title,
                                );
                                if (!row) {
                                    await world.db.addTeleportPoint(
                                        id,
                                        title,
                                        x,
                                        y,
                                        z,
                                    );
                                    this.sendMessage(
                                        `teleport_point_added|${title}`,
                                        player,
                                    );
                                } else {
                                    this.sendMessage(
                                        'Точка с именем ' +
                                            title +
                                            ' уже существует',
                                        player,
                                    );
                                }
                            } else {
                                this.sendMessage(
                                    'Имя может состоять только из букв английского алфавита и цифр',
                                    player,
                                );
                            }
                            return true;
                        } else if (subcmd == 'go') {
                            if (this.chTitle(title)) {
                                const row = await world.db.getTeleportPoint(
                                    id,
                                    title,
                                );
                                if (row) {
                                    const pos = new Vector(row.x, row.y, row.z);
                                    player.teleport({
                                        place_id: null,
                                        pos: pos,
                                    });
                                } else {
                                    this.sendMessage(
                                        'Точка с именем ' +
                                            title +
                                            ' не найдена',
                                        player,
                                    );
                                }
                            } else {
                                this.sendMessage(
                                    'Имя может состоять только из букв английского алфавита и цифр',
                                    player,
                                );
                            }
                            return true;
                        }
                    } else if (args.length == 2) {
                        if (subcmd == 'list') {
                            let points = await world.db.getListTeleportPoints(
                                player.session.user_id,
                            );
                            if (points && points.length > 0) {
                                let text = '\n';
                                for (let point of points) {
                                    text +=
                                        point.title +
                                        ' ' +
                                        point.x +
                                        ' ' +
                                        point.y +
                                        ' ' +
                                        point.z +
                                        '\n';
                                }
                                this.sendMessage(text, player);
                            } else {
                                this.sendMessage(
                                    'Точки телепортации отсутствуют',
                                    player,
                                );
                            }
                            return true;
                        }
                    }
                    break;
                }
            }
            return false;
        });
    }
}
