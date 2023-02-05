import {ServerClient} from "../www/js/server_client.js";
import {DIRECTION, Vector} from "../www/js/helpers.js";
import {WorldAction} from "../www/js/world_action.js";
import { Weather } from "../www/js/block_type/weather.js";

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

    broadcastSystemChatMessage(text, as_table = false) {
        this.sendSystemChatMessageToSelectedPlayers(text, null, as_table)
    }

    // sendSystemChatMessageToSelectedPlayers...
    sendSystemChatMessageToSelectedPlayers(text, selected_players = null, as_table = false) {
        // send as table
        if(as_table) {
            let max_length = 0;
            for(let [k, v] of Object.entries(text)) {
                if(k.length > max_length) {
                    max_length = k.length;
                }
            }
            for(let [k, v] of Object.entries(text)) {
                k = k.padEnd(max_length + 5, '.');
                this.sendSystemChatMessageToSelectedPlayers(k + ': ' + v, selected_players);
            }
            return;
        }
        //
        if(typeof text == 'object' && 'message' in text) {
            text = text.message;
        }
        const packets = [
            {
                name: ServerClient.CMD_CHAT_SEND_MESSAGE,
                data: {
                    username: '<MadCraft>',
                    text: text,
                    is_system: true
                }
            }
        ];
        if (selected_players) {
            this.world.sendSelected(packets, selected_players, []);
        } else {
            this.world.sendAll(packets, []);
        }
    }

    // runCmd
    async runCmd(player, original_text) {

        const that = this
        function checkIsAdmin() {
            if(!that.world.admins.checkIsAdmin(player)) {
                throw 'error_not_permitted';
            }
        }

        const user_id = player.session.user_id
        let text = original_text.replace(/  +/g, ' ').trim();
        let args = text.split(' ');
        let cmd = args[0].toLowerCase();
        switch (cmd) {
            case "/kill": {
                args = this.parseCMD(args, ['string', 'string'])
                if (args[1] == 'mobs') {
                    this.world.mobs.kill()
                }
                break
            }
            case "/admin": {
                if (args.length < 2) {
                    throw 'Invalid arguments count';
                }
                if(!this.world.admins.checkIsAdmin(player)) {
                    throw 'error_not_permitted';
                }
                switch (args[1]) {
                    case 'list': {
                        const admin_list = this.world.admins.getList().join(', ');
                        this.sendSystemChatMessageToSelectedPlayers(`admin_list|${admin_list}`, [player.session.user_id]);
                        break;
                    }
                    case 'add': {
                        if (args.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.add(player, args[2]);
                        this.sendSystemChatMessageToSelectedPlayers('admin_added', [player.session.user_id]);
                        break;
                    }
                    case 'remove': {
                        if (args.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.remove(player, args[2]);
                        this.sendSystemChatMessageToSelectedPlayers('admin_removed', [player.session.user_id]);
                        break;
                    }
                    default: {
                        throw 'Invalid command argument';
                    }
                }
                break;
            }
            case '/seed': {
                this.sendSystemChatMessageToSelectedPlayers(`generator_seed|${this.world.info.seed}`, [player.session.user_id]);
                break;
            }
            case '/give':
                if(!player.game_mode.isCreative()) {
                    if(!this.world.admins.checkIsAdmin(player)) {
                        throw 'error_command_not_working_in_this_game_mode'
                    }
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
                const bm = this.world.block_manager
                cnt = Math.max(cnt | 0, 1);
                const b = bm.fromName(name.toUpperCase());
                if(b && b.id > 0) {
                    const block = bm.convertItemToInventoryItem(b, b, true);
                    block.count = cnt;
                    const ok = player.inventory.increment(block, true);
                    if(ok) {
                        this.sendSystemChatMessageToSelectedPlayers(`given|${b.name}`, [player.session.user_id]);
                    } else {
                        this.sendSystemChatMessageToSelectedPlayers(`error_no_place_in_inventory`, [player.session.user_id]);
                    }
                } else {
                    this.sendSystemChatMessageToSelectedPlayers(`error_unknown_item|${name}`, [player.session.user_id]);
                }
                break;
            case '/help': {
                let commands
                if (args[1] === 'admin') {
                    checkIsAdmin()
                    commands = [
                        '/admin (list | add <username> | remove <username>)',
                        '/time (add <int> | set (<int>|day|midnight|night|noon))',
                        'Server stats:',
                        '  /tps [chunk]',
                        '  /tps2 [chunk] [recent]',
                        '  /sysstat',
                        '  /astat [recent]',
                        '/shutdown [gentle | force]'
                    ]
                } else {
                    commands = [
                        '/weather (' + Weather.NAMES.join(' | ') + ')',
                        '/gamemode [world] (survival | creative | adventure | spectator | get)',
                        '/tp -> teleport',
                        '/stp -> safe teleport',
                        '/spawnpoint',
                        '/seed',
                        '/give <item> [<count>]',
                        '/help [admin]'
                    ]
                }
                this.sendSystemChatMessageToSelectedPlayers('!lang\n' + commands.join('\n'), [player.session.user_id]);
                break;
            }
            case '/gamemode':
                if(!this.world.admins.checkIsAdmin(player)) {
                    throw 'error_not_permitted';
                }
                args = this.parseCMD(args, ['string', 'string', 'string']);
                if (args.length < 2 || args.length > 3) {
                    throw 'Invalid arguments count';
                }
                const target = args.length == 3 ? args[1] : '';
                let game_mode_id = args[args.length - 1].toLowerCase();
                if (game_mode_id != 'get') {
                    const mode = player.game_mode.getById(game_mode_id);
                    if (mode == null) {
                        throw 'Invalid game mode';
                    }
                    if (target == '') {
                        player.game_mode.applyMode(game_mode_id, true);
                    } else if (target == 'world') {
                        this.world.info.game_mode = game_mode_id;
                        await this.world.db.setWorldGameMode(this.world.info.guid, game_mode_id);
                        this.sendSystemChatMessageToSelectedPlayers('Done', [player.session.user_id]);
                    } else {
                        throw 'Invalid target';
                    }
                } else {
                    if (target == '') {
                        this.sendSystemChatMessageToSelectedPlayers('Player game mode id: ' + player.game_mode.current.id, [player.session.user_id]);
                    } else if (target == 'world') {
                        this.sendSystemChatMessageToSelectedPlayers('World game mode id: ' + this.world.info.game_mode, [player.session.user_id]);
                    } else {
                        throw 'Invalid target';
                    }
                }
                break;
            case '/shutdown': {
                checkIsAdmin()
                let gentle = false
                if (args[1] === 'gentle') {
                    gentle = true
                } else if (args[1] !== 'force') {
                    this.sendSystemChatMessageToSelectedPlayers('Usage: /shutdown (gentle | force)\n"gentle" delays starting of shutdown until the actions queue is empty', [user_id])
                    break
                }
                const msg = 'shutdown_initiated_by|' + player.session.username
                const res = this.world.game.shutdown(msg, gentle)
                if (!res) {
                    this.sendSystemChatMessageToSelectedPlayers('!langThe game is already in the process of shutting down.', [user_id])
                }
                break
            }
            case '/tp': 
            case '/stp': {
                const safe = (args[0] == '/stp');
                if(args.length == 4) {
                    args = this.parseCMD(args, ['string', '?float', '?float', '?float']);
                    const pos = new Vector(args[1] ?? player.state.pos.x, args[2] ?? player.state.pos.y, args[3] ?? player.state.pos.z);
                    player.teleport({place_id: null, pos: pos, safe: safe});
                } else if (args.length == 2) {
                    args = this.parseCMD(args, ['string', 'string']);
                    if(args[1].startsWith('@')) {
                        // teleport to another player
                        player.teleport({p2p: {from: player.session.username, to: args[1].substring(1)}, pos: null, safe: safe});
                    } else {
                        // teleport by place id or to another player
                        player.teleport({place_id: args[1], pos: null, safe: safe});
                    }
                } else if (args.length == 3) {
                    // teleport to another player
                    if(!this.world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
                    args = this.parseCMD(args, ['string', 'string', 'string']);
                    if(args[1].startsWith('@') && args[2].startsWith('@')) {
                        player.teleport({p2p: {from: args[1].substring(1), to: args[2].substring(1)}, pos: null, safe: safe});
                    } else {
                        throw 'error_invalid_arguments';
                    }
                } else {
                    throw 'error_invalid_arguments_count';
                }
                break;
            }
            case '/tps': {
                const table = this.getTickStats(args)
                let temp = [];
                const keys = ['tps', 'last', 'total', 'count', 'max']
                for(let k of keys) {
                    const v = table[k]
                    temp.push(k + ': ' + Math.round(v * 1000) / 1000);
                }
                this.sendSystemChatMessageToSelectedPlayers(temp.join('; '), [player.session.user_id]);
                break;
            }
            case '/tps2': {
                const recent = args.includes('recent')
                const table = this.getTickStats(args).toTable(recent)
                this.sendSystemChatMessageToSelectedPlayers(table, [player.session.user_id], true);
                break;
            }
            case '/astat': { // async stats. They show what's happeing with DB queries and other async stuff
                const recent = args.includes('recent')
                const dbActor = this.world.dbActor
                const table = dbActor.asyncStats.toTable(recent)
                table['World transaction now'] = dbActor.savingWorldNow
                    ? `running for ${(performance.now() - dbActor.lastWorldTransactionStartTime | 0) * 0.001} sec`
                    : 'not running';
                this.sendSystemChatMessageToSelectedPlayers(table, [player.session.user_id], true);
                break;
            }
            case '/sysstat': {
                const world = this.world
                const stat = {
                    mobs_count:     world.mobs.count(),
                    drop_items:     world.all_drop_items.size,
                    players:        world.players.count,
                    chunks:         world.chunkManager.all.size,
                    actions_queue:  world.actions_queue.length,
                    dirty_actors:   world.dbActor.dirtyActors.size,
                    net_in:         world.network_stat.in.toLocaleString() + ` bytes (packets: ${world.network_stat.in_count})`,
                    net_out:        world.network_stat.out.toLocaleString() + ` bytes (packets: ${world.network_stat.out_count})`,
                    working_time:   Math.round((performance.now() - world.start_time) / 1000) + ' sec',
                    ticking_blocks: {total:0}
                };
                // ticking_blocks
                const pos = new Vector();
                for(let addr of world.chunks.ticking_chunks) {
                    const chunk = world.chunks.get(addr);
                    for(let flatIndex of chunk.ticking_blocks.blocks.values()) {
                        pos.fromFlatChunkIndex(flatIndex).addSelf(chunk.coord);
                        const ticking_block = chunk.getMaterial(pos);
                        const ttype = ticking_block.ticking.type;
                        if(!(ttype in stat.ticking_blocks)) {
                            stat.ticking_blocks[ttype] = 0;
                        }
                        stat.ticking_blocks[ttype]++;
                        stat.ticking_blocks.total++;
                    }
                }
                stat.ticking_blocks = JSON.stringify(stat.ticking_blocks);
                stat.ticking_blocks = stat.ticking_blocks.replaceAll('"', '');
                stat.ticking_blocks = stat.ticking_blocks.replaceAll(',', ', ');
                stat.ticking_blocks = stat.ticking_blocks.replaceAll('{', '');
                stat.ticking_blocks = stat.ticking_blocks.replaceAll('}', '');
                //
                this.sendSystemChatMessageToSelectedPlayers(stat, [player.session.user_id], true);
                break;
            }
            case '/spawnpoint': {
                player.changePosSpawn({pos: player.state.pos.round(3)});
                break;
            }
            case '/spawnmob': {
                args = this.parseCMD(args, ['string', '?float', '?float', '?float', 'string', 'string']);
                // @ParamMobAdd
                let params = {
                    type:   args[4],
                    skin:   args[5],
                    pos:    player.state.pos.clone(),
                    pos_spawn:    player.state.pos.clone(),
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
                // spawn
                this.world.mobs.spawn(player, params);
               break;
            }
            case '/stairs': {
                if(!this.world.admins.checkIsAdmin(player)) {
                    throw 'error_not_permitted';
                }
                const pos = player.state.pos.floored();
                const bm = this.world.block_manager
                const cd = bm.getCardinalDirection(player.rotateDegree.clone());
                let ax = 0, az = 0;
                switch(cd) {
                    case DIRECTION.WEST: {
                        ax = 1;
                        break;
                    }
                    case DIRECTION.EAST: {
                        ax = -1;
                        break;
                    }
                    case DIRECTION.SOUTH: {
                        az = 1;
                        break;
                    }
                    case DIRECTION.NORTH: {
                        az = -1;
                        break;
                    }
                }
                const actions = new WorldAction(null, this.world, false, false);
                const item = {id: bm.STONE.id};
                const action_id = ServerClient.BLOCK_ACTION_CREATE;
                pos.x += 1 * ax;
                pos.z += 1 * az;
                for(let i = 0; i < 20; i++) {
                    pos.x += 1 * ax;
                    pos.z += 1 * az;
                    actions.addBlocks([
                        {pos: pos.clone(), item, action_id},
                        {pos: pos.clone().addScalarSelf(1 * ax, 0, 1 * az), item, action_id}
                    ]);
                    pos.y++;
                }
                this.world.actions_queue.add(null, actions);
                break;
            }
            case '/clear':
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
        //if (args.length != format.length) {
        //    throw 'error_invalid_arguments_count';
        //}
        for(let i in args) {
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
                    if (isNaN(ch)) {
                        resp.push(ch);
                    } else {
                        resp.push(parseFloat(ch));
                    }
                    break;
                }
            }
        }
        return resp;
    }

    getTickStats(args) {
        return args.includes('chunk')
            ? this.world.chunkManager.ticks_stat
            : this.world.ticks_stat
    }
}