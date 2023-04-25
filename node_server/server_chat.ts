import {ServerClient} from "@client/server_client.js";
import {ArrayHelpers, ArrayOrScalar, DIRECTION, Vector} from "@client/helpers.js";
import {WorldAction} from "@client/world_action.js";
import { Weather } from "@client/block_type/weather.js";
import { MobSpawnParams } from "./mob.js";
import type { ServerWorld } from "./server_world.js";
import type { WorldTickStat } from "./world/tick_stat.js";
import type { ServerPlayer } from "./server_player.js";
import { BLOCK_FLAG } from "@client/constant.js";
import {EnumDamage} from "@client/enums/enum_damage.js";

const MAX_LINE_LENGTH = 100 // TODO based on the cleint's screen size

type CmdCallback = (player: ServerPlayer, cmd: string, args: string[]) => Promise<boolean>

export class ServerChat {
    world: ServerWorld;
    onCmdCallbacks: CmdCallback[];
    onCmdCallbacksByName = new Map<string, CmdCallback[]>();

    static XYZ_HELP = '<x>, <y>, <z> can be: ~ (it means empty), +<number> (it means relative to the player, e.g. +-5)'

    constructor(world : ServerWorld) {
        this.world = world;
        this.onCmdCallbacks = [];
        plugins.initPlugins('chat', this);
    }

    /**
     * Registers a callback for one or more commands.
     * Unlike {@link onCmd}, if any of the callbacks registered by this method returns true,
     * no other callbacks are executed.
     * It's preferable over {@link onCmd}:
     *  - it's called only for the registered commnd(s) - slightly faster, less async calls
     *  - {@link callback} doesn't have to check the commnd name - slightly simpler code
     */
    registerCmd(cmdNames : string | string[], callback: CmdCallback) {
        for(const cmdName of ArrayOrScalar.values(cmdNames)) {
            let list = this.onCmdCallbacksByName.get(cmdName)
            if (list == null) {
                list = []
                this.onCmdCallbacksByName.set(cmdName, list)
            }
            list.push(callback)
        }
    }

    /** An old method for registering commnds. Consider using {@link registerCmd} instead. */
    onCmd(callback: CmdCallback) {
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
            this.sendSystemChatMessageToSelectedPlayers(e, player)
        }
    }

    broadcastSystemChatMessage(text: string | { [key: string]: any }, as_table: boolean | string = false) {
        this.sendSystemChatMessageToSelectedPlayers(text, null, as_table)
    }

    /**
     * @param {boolean | string} as_table - if it's not false, {@link text} is treated as a table.
     *   If {@link as_table} is string, it's used as the table title.
     */
    sendSystemChatMessageToSelectedPlayers(text: string | { [key: string]: any },
        selected_players: number[] | ServerPlayer | null = null,
        as_table: boolean | string = false
    ) {
        // convert to a table
        if (as_table) {
            const lines = typeof as_table === 'string' ? ['!lang' + as_table] : ['!lang']
            const max_length = ArrayHelpers.max(Object.keys(text), 0, key => key.length)
            for(let [k, v] of Object.entries(text)) {
                k = k.padEnd(max_length + 5, '.')
                lines.push(`${k}: ${v}`)
            }
            text = lines.join('\n')
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
            this.world.sendSelected(packets, selected_players);
        } else {
            this.world.sendAll(packets);
        }
    }

    checkIsAdmin(player: ServerPlayer): void {
        if (!this.world.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted'
        }
    }

    // runCmd
    async runCmd(player: ServerPlayer, original_text: string) {
        const {fromFlatChunkIndex} = this.world.chunks.grid.math;
        const that = this
        function checkIsAdmin() {
            that.checkIsAdmin(player)
        }

        const world = this.world
        let text = original_text.replace(/  +/g, ' ').trim();
        let args = text.split(' ') as any[]; // any[] - because after they are parsed, args also contain int and null
        let cmd = args[0].toLowerCase();
        switch (cmd) {
            case "/kill": {
                args = this.parseCMD(args, ['string', 'string'])
                switch (args[1]) {
                    case 'mobs':
                        checkIsAdmin()
                        this.world.mobs.kill()
                        break
                    case 'me':
                        player.setDamage(999999, EnumDamage.OTHER, player)
                        break
                    default:
                        this.sendSystemChatMessageToSelectedPlayers('!langUsage: /kill (me|mobs)', player)
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
                        this.sendSystemChatMessageToSelectedPlayers(`admin_list|${admin_list}`, player);
                        break;
                    }
                    case 'add': {
                        if (args.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.add(player, args[2]);
                        this.sendSystemChatMessageToSelectedPlayers('admin_added', player);
                        break;
                    }
                    case 'remove': {
                        if (args.length < 3) {
                            throw 'Invalid arguments count';
                        }
                        await this.world.admins.remove(player, args[2]);
                        this.sendSystemChatMessageToSelectedPlayers('admin_removed', player);
                        break;
                    }
                    default: {
                        throw 'Invalid command argument';
                    }
                }
                break;
            }
            case '/seed': {
                this.sendSystemChatMessageToSelectedPlayers(`generator_seed|${this.world.info.seed}`, player);
                break;
            }
            case '/give': {
                const is_admin = this.world.admins.checkIsAdmin(player)
                if(!player.game_mode.isCreative()) {
                    if(!is_admin) {
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
                    cnt = args[2] as any;
                }
                const bm = this.world.block_manager
                cnt = Math.max(cnt | 0, 1);
                const b = bm.fromName(name.toUpperCase());
                if(b && b.id > 0) {
                    // TODO: check admin rights
                    if(!is_admin) {
                        const blockFlags = bm.flags
                        if(!this.world.isBuildingWorld() && (blockFlags[b.id] & BLOCK_FLAG.NOT_CREATABLE)) {
                            this.sendSystemChatMessageToSelectedPlayers(`error_unknown_item|${name}`, player)
                            return true
                        }
                    }
                    const block = bm.convertItemToInventoryItem(b, b, true);
                    block.count = cnt;
                    const ok = player.inventory.increment(block, true);
                    if(ok) {
                        this.sendSystemChatMessageToSelectedPlayers(`given|${b.name}`, player);
                    } else {
                        this.sendSystemChatMessageToSelectedPlayers(`error_no_place_in_inventory`, player);
                    }
                } else {
                    this.sendSystemChatMessageToSelectedPlayers(`error_unknown_item|${name}`, player);
                }
                break;
            }
            case '/help': {
                let commands
                if (args[1] === 'admin') {
                    checkIsAdmin()
                    commands = [
                        '/admin (list | add <username> | remove <username>)',
                        '/time (add <int> | set (<int>|day|midnight|night|noon))',
                        '/gamerule [<name> [<value>]]',
                        '/spawnmob <x> <y> <z> <type> [<skin>]',
                        'Server stats:',
                        '  /tps [chunk|mob|<mob_name>]',
                        '  /tps2 [chunk|mob|mobtype|<mob_name>] [recent]',
                        '  /sysstat',
                        '  /netstat (in|out|all) [off|count|size|reset]',
                        '  /astat [recent]',
                        '/shutdown [gentle|force]',
                        ServerChat.XYZ_HELP
                    ]
                } else {
                    commands = [
                        '/weather (' + Weather.NAMES.join(' | ') + ')',
                        '/gamemode [world] (survival | creative | adventure | spectator | get)',
                        '/tp ([@<teleported_username>] @<target_username> | <place_name> | <x> <y> <z>) -> teleport',
                        '/stp -> safe teleport, same arguments as /tp',
                        '/spawnpoint',
                        '/seed',
                        '/give <item> [<count>]',
                        '/kill (me|mobs)',
                        '/help [admin]',
                        ServerChat.XYZ_HELP
                    ]
                }
                this.sendSystemChatMessageToSelectedPlayers('!lang\n' + commands.join('\n'), player);
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
                        this.sendSystemChatMessageToSelectedPlayers('Done', player);
                    } else {
                        throw 'Invalid target';
                    }
                } else {
                    if (target == '') {
                        this.sendSystemChatMessageToSelectedPlayers('Player game mode id: ' + player.game_mode.current.id, player);
                    } else if (target == 'world') {
                        this.sendSystemChatMessageToSelectedPlayers('World game mode id: ' + this.world.info.game_mode, player);
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
                } else if (args[1] === 'force') {
                    // continue
                } else if (this.world.actions_queue.length === 0) {
                    // The action queue is empty, so we can proceed without bothering the user with questions.
                    // Choose "gentle" in case a lot of actions suddenly happen, to be conpletely safe.
                    gentle = true
                } else {
                    this.sendSystemChatMessageToSelectedPlayers('Usage: /shutdown (gentle | force)]\n' +
                        '"gentle" delays starting of shutdown until the actions queue is empty.\n' +
                        `There are ${this.world.actions_queue.length} actions queued.`, player)
                    break
                }
                const msg = 'shutdown_initiated_by|' + player.session.username
                const res = this.world.game.shutdown(msg, gentle)
                if (!res) {
                    this.sendSystemChatMessageToSelectedPlayers('!langThe game is already in the process of shutting down.', player)
                }
                break
            }
            case '/tp':
            case '/stp': {
                const safe = (args[0] == '/stp');
                if(args.length == 4) {
                    args = this.parseCMD(args, ['string', 'x', 'y', 'z'], player);
                    const pos = new Vector(args[1], args[2], args[3]);
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
                const stats = this.getTickStats(args[1] ?? 'world')
                if (stats === null) {
                    this.sendSystemChatMessageToSelectedPlayers('Usage: /tps [chunk|mob|<mob_name>]', player)
                    return
                }
                let temp = [];
                const keys = ['tps', 'last', 'total', 'count', 'max']
                for(let k of keys) {
                    const v = stats[k]
                    temp.push(k + ': ' + Math.round(v * 1000) / 1000);
                }
                this.sendSystemChatMessageToSelectedPlayers(temp.join('; '), player);
                break;
            }
            case '/tps2': {
                let statsName = null
                let stats = this.getTickStats('world')
                for(let i = 1; i < args.length; i++) {
                    const arg = args[i]
                    // chesk if it's a stat name
                    const statsFromArg = this.getTickStats(arg)
                    if (statsFromArg) {
                        stats = statsFromArg
                        statsName = arg
                    } else if (!['/tps2', 'recent'].includes(arg)) {
                        const USAGE = '!lang/tps2 [chunk|mob|mobtype|<mob_name>] [recent]'
                        this.sendSystemChatMessageToSelectedPlayers(USAGE, player)
                        return
                    }
                }
                const recent = args.includes('recent')
                let table: object
                if (statsName === 'mobtype' || statsName === 'mobtypes') {
                    table = {}
                    for(const [name, stats] of this.world.mobs.ticks_stat_by_mob_type.entries()) {
                        table[name] = stats.sum(recent).toFixed(3).padStart(11)
                    }
                } else {
                    table = stats.toTable(recent)
                }
                const title = recent ? 'Recent stats:' : 'All-time stats:'
                this.sendSystemChatMessageToSelectedPlayers(table, player, title)
                break;
            }
            case '/astat': { // async stats. They show what's happeing with DB queries and other async stuff
                const recent = args.includes('recent')
                const dbActor = this.world.dbActor
                const table = dbActor.asyncStats.toTable(recent)
                Object.assign(table, this.world.db.fluid.asyncStats.toTable(recent))
                table['World transaction now'] = dbActor.savingWorldNow
                    ? `running for ${(performance.now() - dbActor.lastWorldTransactionStartTime | 0) * 0.001} sec`
                    : 'not running';
                const title = (recent ? 'Recent' : 'All-time') + ' stats for asynchronous operations:'
                this.sendSystemChatMessageToSelectedPlayers(table, player, title);
                break;
            }
            case '/netstat': {
                checkIsAdmin()
                const USAGE = '!langUsage: /netstat (in|out|all) [off|count|size|reset]' +
                    '\n  Network stats by packet type.' +
                    '\n  - with 2 arguments: the command prints the stats' +
                    '\n  - with 3 arguments: the command changes how the stats are collected' +
                    '\n  Enabling "size" also enables "count".' +
                    '\n  Warning: enabling "size" net stats for "out" or "all" directions causes slowdown!'
                let isOut = false, isIn = false
                switch(args[1]) {
                    case 'in':  isIn = true;    break
                    case 'out': isOut = true;   break
                    case 'all':
                        isIn = true
                        isOut = true
                        break
                    default:
                        this.sendSystemChatMessageToSelectedPlayers(USAGE, player)
                        return
                }
                const ns = world.network_stat
                if (args.length === 2) {
                    let sentAny = false
                    if (isIn && ns.in_count_by_type) {
                        sentAny = true
                        let res = ns.in_size_by_type
                            ? '!langIncoming message type: size *count\n'
                            : '!langIncoming message type: count\n'
                        res += this.netStatsTable(ns.in_count_by_type, ns.in_size_by_type)
                        this.sendSystemChatMessageToSelectedPlayers(res, player)
                    }
                    if (isOut && ns.out_count_by_type) {
                        sentAny = true
                        let res = ns.out_size_by_type
                            ? '!langOutgoing message type: size *count\n'
                            : '!langOutgoing message type: count\n'
                        res += this.netStatsTable(ns.out_count_by_type, ns.out_size_by_type)
                        this.sendSystemChatMessageToSelectedPlayers(res, player)
                    }
                    if (!sentAny) {
                        this.sendSystemChatMessageToSelectedPlayers("!langTo view stats, first enable collecting them. Call /netstat without arguments for more information.", player)
                    }
                    return
                }
                switch(args[2]) {
                    case 'off':
                        if (isIn) {
                            ns.in_count_by_type     = null
                            ns.in_size_by_type      = null
                        }
                        if (isOut) {
                            ns.out_count_by_type    = null
                            ns.out_size_by_type     = null
                        }
                        break
                    case 'count':
                        if (isIn) {
                            ns.in_count_by_type     ??= []
                            ns.in_size_by_type      = null
                        }
                        if (isOut) {
                            ns.out_count_by_type    ??= []
                            ns.out_size_by_type     = null
                        }
                        break
                    case 'size':
                        if (isIn) {
                            ns.in_count_by_type     ??= []
                            ns.in_size_by_type      ??= []
                        }
                        if (isOut) {
                            ns.out_count_by_type    ??= []
                            ns.out_size_by_type     ??= []
                        }
                        break
                    case 'reset':
                        if (isIn) {
                            ns.in_count_by_type &&= []
                            ns.in_size_by_type  &&= []
                            ns.in_count = 0
                            ns.in       = 0
                        }
                        if (isOut) {
                            ns.out_count_by_type &&= []
                            ns.out_size_by_type  &&= []
                            ns.out_count    = 0
                            ns.out          = 0
                        }
                        break
                    default:
                        this.sendSystemChatMessageToSelectedPlayers(USAGE, player)
                        return
                }
                break
            }
            case '/sysstat': {
                const chunkManager = world.chunkManager
                const stat = {
                    mobs_count:     world.mobs.count(),
                    drop_items:     world.all_drop_items.size,
                    players:        world.players.count,
                    chunks:         chunkManager.all.size,
                    unloading_chunks_size:  chunkManager.unloading_chunks.size,
                    unloading_state_count:  chunkManager.unloading_state_count,
                    actions_queue:  world.actions_queue.length,
                    dirty_actors:   world.dbActor.dirtyActors.size,
                    net_in:         world.network_stat.in.toLocaleString() + ` bytes (packets: ${world.network_stat.in_count})`,
                    net_out:        world.network_stat.out.toLocaleString() + ` bytes (packets: ${world.network_stat.out_count})`,
                    working_time:   Math.round((performance.now() - world.start_time) / 1000) + ' sec',
                    ticking_blocks: {total: 0} as any
                };
                // ticking_blocks
                const pos = new Vector();
                for(let addr of world.chunks.ticking_chunks) {
                    const chunk = world.chunks.get(addr);
                    for(let flatIndex of chunk.ticking_blocks.blockFlatIndices) {
                        fromFlatChunkIndex(pos, flatIndex).addSelf(chunk.coord);
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
                this.sendSystemChatMessageToSelectedPlayers(stat, player, true);
                break;
            }
            case '/spawnpoint': {
                player.changePosSpawn({pos: player.state.pos.round(3)});
                break;
            }
            case '/spawnmob': {
                checkIsAdmin()
                if (args.length < 5) {
                    const spawnMobHelp = '!lang/spawnmob <x> <y> <z> <type> [<skin>]\n' +
                        `  <type> values: ${world.brains.getArrayOfNames().join(', ')}\n` +
                        `  ${ServerChat.XYZ_HELP}`
                    this.sendSystemChatMessageToSelectedPlayers(spawnMobHelp, player)
                    break
                }
                args = this.parseCMD(args, ['string', 'x', 'y', 'z', 'string', '?string'], player);
                const type_orig = args[4]
                const type = world.mobs.findTypeFullName(type_orig)
                if (!type) {
                    this.sendSystemChatMessageToSelectedPlayers(`!langUnknown mob type ${type_orig}`, player)
                    break
                }
                // @ParamMobAdd
                const params = new MobSpawnParams(
                    new Vector(args[1], args[2], args[3]),
                    new Vector(0, 0, player.state.rotate.z),
                    type,
                    args[5] ?? 'base',
                )
                // spawn
                if (!world.mobs.spawn(player, params)) {
                    this.sendSystemChatMessageToSelectedPlayers(`!langCan't spawn mob ${type}`, player)
                }
                break;
            }
            case '/stairs': {
                checkIsAdmin()
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
                const registeredCallbacks = this.onCmdCallbacksByName.get(cmd)
                if (registeredCallbacks) {
                    for(const plugin_callback of registeredCallbacks) {
                        if (await plugin_callback(player, cmd, args)) {
                            ok = true
                            break
                        }
                    }
                }
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

    /**
     * Supported formats:
     * - 'int', '?int', 'float', '?float'
     * - 'string', '?string' - either string or undefined
     * - 'string|float', '?string|float' - the same semantics as old 'string' - if it's a number, it's parsed as a number
     * - 'x', 'y', 'z', '?x', '?y', '?z' - similar to 'float' and '?float', but have an additional feature:
     *   if '+' is before the number, then it's relative to the player's position.
     * @returns {(number | string | null)[]} - parsed arguments. To avoid re-writing a lot of code,
     *  we declare the result as any[]
     */
    parseCMD(args: string[], format: string[], player?: ServerPlayer): any[] {

        function parseArgFloat(arg: string): float | null {
            let value = parseFloat(arg);
            if (isNaN(value)) {
                if (format[i].startsWith('?') && arg === '~') {
                    value = null
                } else {
                    throw 'Invalid arg pos = ' + i;
                }
            }
            return value
        }

        function parseArgCoord(arg: string, playerCoord?: float): float | null {
            if (playerCoord == null) {
                throw "player is not defined. Don't forget the 3rd argument in parseCMD."
            }
            if (arg === '~') {
                return format[i].startsWith('?') ? null : playerCoord
            }
            return arg[0] === '+'
                ? playerCoord + parseArgFloat(arg.substring(1))
                : parseArgFloat(arg)
        }

        let resp = [];
        //if (args.length != format.length) {
        //    throw 'error_invalid_arguments_count';
        //}
        let i: int
        for(i = 0; i < args.length; i++) {
            let ch = args[i];
            let value: any
            switch (format[i]) {
                case 'int':
                case '?int':
                    value = parseInt(ch);
                    if (isNaN(value)) {
                        if (format[i].startsWith('?') && ch == '~') {
                            value = null
                        } else {
                            throw 'Invalid arg pos = ' + i;
                        }
                    }
                    break;
                case 'float':
                case '?float':
                    value = parseArgFloat(ch)
                    break
                case 'x':
                case '?x':
                    value = parseArgCoord(ch, player?.state.pos.x)
                    break
                case 'y':
                case '?y':
                    value = parseArgCoord(ch, player?.state.pos.y)
                    break
                case 'z':
                case '?z':
                    value = parseArgCoord(ch, player?.state.pos.z)
                    break
                case '?string|float':
                case 'string|float': // that mode was formerly 'string'
                    value = isNaN(ch as any) || !isFinite(ch as any)
                        ? ch
                        : parseFloat(ch)
                    break
                case '?string':
                case 'string':
                    value = ch
                    break
                default: throw `Unknown argument format ${format[i]}`
            }
            resp.push(value)
        }
        return resp;
    }

    getTickStats(type: string): WorldTickStat | null {
        switch(type) {
            case 'world':
                return this.world.ticks_stat
            case 'chunk':
            case 'chunks':
                return this.world.chunkManager.ticks_stat
            case 'mob':
            case 'mobs':
            case 'mobtype':
            case 'mobtypes':
                return this.world.mobs.ticks_stat
        }
        return this.world.mobs.ticks_stat_by_mob_type.get(type)
    }

    /**
     * Converts an array of [name, value] tupes to a multi-line text table.
     * The elements are split into columns, so that their total width doesn't exceed {@link maxLength}.
     * The minimum with for name and value in each column is selected.
     * The 1st column is filled, then the 2nd column, etc. (not by rows)
     */
    static toTableColumns(text: [name: any, value: any, ...unused: any][], maxLength = MAX_LINE_LENGTH, columnSeparator = '   '): string {

        function calcColsWidth(): int {
            rows = Math.ceil(entries.length / cols)
            maxNameLength.fill(0)
            maxValueLength.fill(0)
            let entryInd = 0
            for(let col = 0; col < cols; col++) {
                const rowsInCol = Math.min(rows, entries.length - entryInd)
                for(let row = 0; row < rowsInCol; row++) {
                    const [name, value] = entries[entryInd++]
                    maxNameLength[col] = Math.max(maxNameLength[col] ?? 0, name.length)
                    maxValueLength[col] = Math.max(maxValueLength[col] ?? 0, value.length)
                }
            }
            return ArrayHelpers.sum(maxNameLength) + ArrayHelpers.sum(maxValueLength)
                + 2 * cols
                + columnSeparator.length * (cols - 1)
        }

        if (!text.length) {
            return ''
        }
        const entries: [string, string][] = text.map(v => [v[0].toString(), v[1].toString()])
        let cols = 1
        let rows: int
        const maxNameLength: int[] = []
        const maxValueLength: int[] = []

        // determine the number of columns
        while (cols <= entries.length && calcColsWidth() <= maxLength) {
            cols++
        }
        cols = Math.max(cols - 1, 1) // revert the last wrong increase
        calcColsWidth()

        // Iterate by columns, collect by rows
        const byRow = ArrayHelpers.create(rows, () => [] as string[])
        let entryInd = 0
        for(let col = 0; col < cols; col++) {
            const rowsInCol = Math.min(rows, entries.length - entryInd)
            for(let row = 0; row < rowsInCol; row++) {
                if (col) {
                    byRow[row].push(columnSeparator)
                }
                const [name, value] = entries[entryInd++]
                byRow[row].push(`${name.padEnd(maxNameLength[col], '.')}: ${value.padEnd(maxValueLength[col])}`)
            }
        }
        for(let row = 0; row < rows - 1; row++) {
            byRow[row].push('\n')
        }
        return byRow.flat().join('')
    }

    netStatsTable(countByType: int[], sizeByType?: int[]): string {
        const entries: [string, string, int][] = []
        for(let type = 0; type < countByType.length; type++) {
            const count = countByType[type]
            if (count) {
                const name = ServerClient.getCommandTitle(type).toString()
                let valueStr: string
                let valueInt: int
                if (sizeByType) {
                    valueInt = sizeByType[type]
                    valueStr = `${sizeByType[type]} *${count}`
                } else {
                    valueInt = count
                    valueStr = count.toString()
                }
                entries.push([name, valueStr, valueInt])
            }
        }
        entries.sort((a, b) => b[2] - a[2])
        return ServerChat.toTableColumns(entries)
    }
}