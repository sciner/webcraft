import {ServerClient} from "../www/js/server_client.js";

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
            this.world.Db.insertChatMessage(player, params);
            this.world.sendAll(packets, [player.session.user_id]);
        } catch(e) {
            let players = [player.session.user_id];
            this.sendSystemChatMessageToSelectedPlayers(e, players)
        }
    }

    // sendSystemChatMessageToSelectedPlayers...
    sendSystemChatMessageToSelectedPlayers(text, selected_players) {
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
        let tmp = text.split(' ');
        let cmd = tmp[0].toLowerCase();
        switch (cmd) {
            case "/admin": {
                if (tmp.length < 2) {
                    throw 'Invalid arguments count';
                }
                switch (tmp[1]) {
                    case 'list': {
                        let admin_list = this.world.admins.getList().join(', ');
                        this.sendSystemChatMessageToSelectedPlayers(admin_list, [player.session.user_id]);
                        break;
                    }
                    case 'add': {
                        if (tmp.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.add(player, tmp[2]);
                        this.sendSystemChatMessageToSelectedPlayers('Admin added', [player.session.user_id]);
                        break;
                    }
                    case 'remove': {
                        if (tmp.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.remove(player, tmp[2]);
                        this.sendSystemChatMessageToSelectedPlayers('Admin removed', [player.session.user_id]);
                        break;
                    }
                    default: {
                        throw 'Invalid command argument';
                    }
                }
                break;
            }
        case "/spawnmob":
            {
                /*err := world.Admins.CheckIsAdmin(conn)
                if err != nil {
                    return err
                }
                args, err := this.parseCMD(tmp, []string{"string", "?float", "?float", "?float", "string", "string"})
                if err != nil {
                    return err
                }
                // Correct format
                log.Println("Correct format", args)
                params := &Struct.ParamMobAdd{}
                // X
                if args[1] == nil {
                    params.Pos.X = conn.Pos.X
                } else {
                    params.Pos.X, _ = strconv.ParseFloat(fmt.Sprint(args[1]), 64)
                }
                // Y
                if args[2] == nil {
                    params.Pos.Y = conn.Pos.Y
                } else {
                    params.Pos.Y, _ = strconv.ParseFloat(fmt.Sprint(args[2]), 64)
                }
                // Z
                if args[3] == nil {
                    params.Pos.Z = conn.Pos.Z
                } else {
                    params.Pos.Z, _ = strconv.ParseFloat(fmt.Sprint(args[3]), 64)
                }
                //
                params.Rotate.Z = conn.Rotate.Z
                params.Type = fmt.Sprint(args[4])
                params.Skin = fmt.Sprint(args[5])
                err = world.AddMob(conn, params)
                if err != nil {
                    return err
                }
                */
            }
        }
        return true
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
        return resp, nil
    }

}