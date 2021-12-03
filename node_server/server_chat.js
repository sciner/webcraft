import {ServerClient} from "../www/js/server_client.js";
import {Vector} from "../www/js/helpers.js";

export class ServerChat {

    constructor(world) {
        this.world = world;
    }

    // Send message
    async sendMessage(player, params) {
        try {
            // Command
            if (params.text.substring(0, 1) == '/') {
                return await this.runCmd(player, params.text);
            }
            // Simple message
            params.username = player.session.username
            let packets = [{
                name: ServerClient.CMD_CHAT_SEND_MESSAGE,
                data: params
            }];
            this.world.db.insertChatMessage(player, params);
            this.world.sendAll(packets, [player.session.user_id]);
        } catch(e) {
            let players = [player.session.user_id];
            this.sendSystemChatMessageToSelectedPlayers(e, players)
        }
    }

    // sendSystemChatMessageToSelectedPlayers...
    sendSystemChatMessageToSelectedPlayers(text, selected_players) {
        if(typeof text == 'object' && 'message' in text) {
            text = text.message;
        }
        let packets = [
            {
                name: ServerClient.CMD_CHAT_SEND_MESSAGE,
                data: {
                    username: '<MadCraft>',
                    text: text
                }
            }
        ];
        this.world.sendSelected(packets, selected_players, []);
    }

    // runCmd
    async runCmd(player, original_text) {
        let text = original_text.replace(/  +/g, ' ').trim();
        let args = text.split(' ');
        let cmd = args[0].toLowerCase();
        switch (cmd) {
            case "/admin": {
                if (args.length < 2) {
                    throw 'Invalid arguments count';
                }
                switch (args[1]) {
                    case 'list': {
                        let admin_list = this.world.admins.getList().join(', ');
                        this.sendSystemChatMessageToSelectedPlayers(admin_list, [player.session.user_id]);
                        break;
                    }
                    case 'add': {
                        if (args.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.add(player, args[2]);
                        this.sendSystemChatMessageToSelectedPlayers('Admin added', [player.session.user_id]);
                        break;
                    }
                    case 'remove': {
                        if (args.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.remove(player, args[2]);
                        this.sendSystemChatMessageToSelectedPlayers('Admin removed', [player.session.user_id]);
                        break;
                    }
                    default: {
                        throw 'Invalid command argument';
                    }
                }
                break;
            }
            case '/seed': {
                this.sendSystemChatMessageToSelectedPlayers('Ключ генератора: ' + this.world.info.seed, [player.session.user_id]);
                break;
            }
            case '/give':
            case '/help':
            case '/obj':
            case '/weather':
            case '/gamemode':
            case '/tp': {
                // @todo Команда пока выполняется на клиенте
                break;
            }
            case '/tps': {
                let temp = [];
                for(let [k, v] of Object.entries(this.world.ticks_stat)) {
                    temp.push(k + ': ' + Math.round(v*1000)/1000);
                }
                this.sendSystemChatMessageToSelectedPlayers(temp.join('; '), [player.session.user_id]);
                break;
            }
            case '/spawnpoint': {
                player.changePosSpawn({pos: player.state.pos.clone().multiplyScalar(1000).floored().divScalar(1000)});
                break;
            }
            case '/spawnmob': {
                args = this.parseCMD(args, ['string', '?float', '?float', '?float', 'string', 'string']);
                // @ParamMobAdd
                let params = {
                    type:   args[4],
                    skin:   args[5],
                    pos:    player.state.pos.clone(),
                    rotate: new Vector(0, 0, player.state.rotate.z)
                }; 
                // x
                if (args[1] !== null) {
                    params.pos.x = args[1];
                }
                // y
                if (args[2] !== null) {
                    params.pos.y = args[2];
                }
                // z
                if (args[3] !== null) {
                    params.pos.z = args[3];
                }
                // add
                this.world.spawnMob(player, params);
               break;
            }
            default: {
                throw 'error_invalid_command';
                break;
            }
        }
        return true;
    }

    // parseCMD...
    parseCMD(args, format) {
        let resp = [];
        if (args.legth != args.legth) {
            throw 'error_invalid_arguments_count';
        }
        for (let i in args) {
            let ch = args[i];
            switch (format[i]) {
                case 'int': {
                    let value = parseInt(ch);
                    if (isNaN(value)) {
                        throw 'Invalid arg pos = ' + i;
                    }
                    resp.push(value);
                    break;
                }
                case '?int': {
                    let value = parseInt(ch);
                    if (isNaN(value)) {
                        if (ch == '~') {
                            resp.push(null);
                        } else {
                            throw 'Invalid arg pos = ' + i;
                        }
                    } else {
                        resp.push(value);
                    }
                    break;
                }
                case 'float': {
                    let value = parseFloat(ch);
                    if (isNaN(value)) {
                        throw 'Invalid arg pos = ' + i;
                    }
                    resp.push(value);
                    break;
                }
                case '?float': {
                    let value = parseFloat(ch);
                    if (isNaN(value)) {
                        if (ch == '~') {
                            resp.push(null);
                        } else {
                            throw 'Invalid arg pos = ' + i;
                        }
                    } else {
                        resp.push(value);
                    }
                    break;
                }
                case 'string': {
                    let value = parseFloat(ch);
                    if (isNaN(value)) {
                        resp.push(ch);
                    } else {
                        resp.push(value);
                    }
                    break;
                }
            }
        }
        return resp;
    }

}