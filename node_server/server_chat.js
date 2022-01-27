import {ServerClient} from "../www/js/server_client.js";
import {Vector} from "../www/js/helpers.js";
import {BLOCK} from "../www/js/blocks.js";

export class ServerChat {

    constructor(world) {
        this.world = world;
        this.onCmdCallbacks = [];
        plugins.initPlugins('chat', this);
    }

    onCmd(callback) {
        this.onCmdCallbacks.push(callback)
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
                if(!player.game_mode.isCreative()) {
                    // throw 'error_command_not_working_in_this_game_mode';
                }
                args = this.parseCMD(args, ['string', 'string', '?int']);
                let name = null;
                let cnt = 1;
                if(!args[2]) {
                    name = args[1];
                    cnt = 1;
                } else {
                    name = args[1];
                    cnt = args[2];
                }
                cnt = Math.max(cnt | 0, 1);
                let block = BLOCK[name.toUpperCase()];
                if(block) {
                    block = {...block};
                    delete(block.texture);
                    block.count = cnt;
                    player.inventory.increment(block);
                    this.sendSystemChatMessageToSelectedPlayers('Выдан: ' + block.name, [player.session.user_id]);
                } else {
                    this.sendSystemChatMessageToSelectedPlayers(`error_unknown_item|${name}`, [player.session.user_id]);
                }
                break;
            case '/help':
                let commands = [
                    '/weather (clear | rain)',
                    '/gamemode (survival | creative | adventure | spectator)',
                    '/tp -> teleport',
                    '/spawnpoint',
                    '/seed',
                    '/give <item> [<count>]',
                ];
                this.sendSystemChatMessageToSelectedPlayers('\n' + commands.join('\n'), [player.session.user_id]);
                break;
            case '/gamemode':
                args = this.parseCMD(args, ['string', 'string']);
                let game_mode_id = args[1].toLowerCase();
                for(let mode of player.game_mode.modes) {
                    if(mode.id == game_mode_id) {
                        player.game_mode.applyMode(game_mode_id, true);
                    }
                }
                break;
            case '/obj':
            case '/weather':
            case '/tp': {
                try {
                    args = this.parseCMD(args, ['string', '?float', '?float', '?float']);
                    const pos = new Vector(args[1], args[2], args[3]);
                    this.world.teleportPlayer(player, {place_id: null, pos: pos});
                } catch(e) {
                    args = this.parseCMD(args, ['string', 'string']);
                    this.world.teleportPlayer(player, {place_id: args[1], pos: null});
                }
                break;
            }
            case '/tps': {
                let temp = [];
                for(let [k, v] of Object.entries(this.world.ticks_stat)) {
                    if(['start', 'add', 'values', 'pn_values', 'pn', 'end'].indexOf(k) >= 0) continue;
                    temp.push(k + ': ' + Math.round(v * 1000) / 1000);
                }
                this.sendSystemChatMessageToSelectedPlayers(temp.join('; '), [player.session.user_id]);
                break;
            }
            case '/tps2': {
                console.log(this.world.ticks_stat);
                for(let [k, v] of Object.entries(this.world.ticks_stat.values)) {
                    let temp = [];
                    for(let [vk, vv] of Object.entries(v)) {
                        temp.push(vk + ': ' + Math.round(vv * 1000) / 1000);
                    }
                    this.sendSystemChatMessageToSelectedPlayers(k + ': ' + temp.join('; '), [player.session.user_id]);
                }
                break;
            }
            case '/sysstat': {
                const stat = {
                    mobs_count: this.world.mobs.size,
                    drop_items: this.world.all_drop_items.size,
                    players: this.world.players.size,
                };
                let temp = [];
                for(let [k, v] of Object.entries(stat)) {
                    temp.push(k + ': ' + v);
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
                let ok = false;
                for(let plugin_callback of this.onCmdCallbacks) {
                    if(await plugin_callback(player, cmd, args)) {
                        ok = true;
                    }
                }
                if(!ok) {
                    throw 'error_invalid_command';
                }
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