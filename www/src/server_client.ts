import { getChunkAddr, Vector } from "./helpers.js";

type CmdListener = (INetworkMessage) => void
type CmdListenersSet = Set<CmdListener>
type CmdListenersMap = Map<int, CmdListenersSet>

export class ServerClient {
    [key: string]: any;

    static cmd_titles : Map<int, string> = null;

    // System
    static CMD_HELLO                    = 1; // server -> player
    static CMD_PING                     = 3; // player -> server
    static CMD_PONG                     = 4; // server -> player
    static CMD_SYNC_TIME                = 5; // two side
    static CMD_NOTHING                  = 111; // server -> player. It does nothing. It's sent periodically if no other commnas have been sent for a fwe seconds.
	static CMD_ERROR                    = 7; // server -> player (some error)
    static CMD_CHANGE_RENDER_DIST       = 10; // player -> server
    static CMD_CONNECT                  = 34; // player -> server
    static CMD_CONNECTED                = 62; // server -> player

    // Cnunks and blocks
    static CMD_BLOCK_DESTROY            = 35;
    static CMD_BLOCK_SET                = 36;
    static CMD_BLOCK_CLONE              = 84;
    static CMD_BLOCK_ROLLBACK           = 110; // server -> player: a client must rollback a block state using its own history
    static CMD_CHUNK_LOAD               = 37; // player -> server
    static CMD_CHUNK_LOADED             = 39;

    // Chat
    static CMD_CHAT_SEND_MESSAGE        = 40;

    // World
    static CMD_MODIFY_INDICATOR_REQUEST = 33;
    static CMD_SET_WEATHER              = 38;

    // Players (others, and optionally the current player)
    static CMD_PLAYER_JOIN              = 41;
    static CMD_PLAYER_LEAVE             = 42;
    static CMD_PLAYER_STATE             = 43; // server -> player, player -> server
    static CMD_PLAYER_CONTROL_SESSION   = 112 // p->s (a client stated a new physics session)
    static CMD_PLAYER_CONTROL_UPDATE    = 113 // p->s (c client sends input and output of the player controller in one or multiple ticks)
    static CMD_PLAYER_CONTROL_CORRECTION= 114 // s->p (a server doesn't accept the client's state, and tells the clint the correct state)
    static CMD_PLAYER_CONTROL_ACCEPTED  = 115 // s->p (a server notifies the client that is accepts its state)

    // The current player
    static CMD_STANDUP_STRAIGHT         = 48; // встать с дивана/кресла
    static CMD_PLAYER_WORLD_DATA        = 116 // s->p (an update to player.world_data)

    // Entities
    static CMD_LOAD_CHEST               = 45; // player -> server
    static CMD_CHEST_CONTENT            = 46; // server -> player (when player request chest content)
    static CMD_CHEST_CONFIRM            = 47; // player -> server (player change chest content)
    static CMD_CHEST_FORCE_CLOSE        = 108; // server -> player (a server tells the client to close the chest window)

    //
    static CMD_CHANGE_POS_SPAWN         = 63; // player -> server (request to change spawn point)
    static CMD_TELEPORT_REQUEST         = 64; // player -> server (запрос от игрока на телепорт в указанное уникальное место(spawn|random) или к точным координатам)
    static CMD_TELEPORT                 = 65; // server -> player (сервер телепортировал игрока)
    static CMD_NEARBY_CHUNKS            = 67 // server -> player (chunks around player)
    static CMD_ENTITY_INDICATORS        = 69; // server -> player (player indicators)
	static CMD_WORLD_INFO               = 74; // server -> player
	static CMD_GAMEMODE_NEXT            = 80; // player -> server (player switch to next game mode)
	static CMD_GAMEMODE_SET             = 81; // p->s, s->p (player switch to specific game mode)
	static CMD_PLAY_SOUND               = 85;
	static CMD_PARTICLE_BLOCK_DESTROY   = 87;
	static CMD_PICKAT_ACTION            = 88;
	static CMD_GENERATE_PARTICLE        = 89;
    static CMD_STOP_PLAY_DISC           = 91;
	static CMD_WORLD_UPDATE_INFO        = 92; // server -> player

    // Quests
    static CMD_QUEST_GET_ENABLED        = 93
	static CMD_QUEST_ALL                = 94;

    static CMD_STATS                    = 96;
    static CMD_DIE                      = 97;
    static CMD_RESURRECTION             = 98;  // p->s
    static CMD_SET_STATUS_WAITING_DATA  = 103; // s->p: changes player.status to PLAYER_STATUS.WAITING_DATA
    static CMD_SET_STATUS_ALIVE         = 104; // s->p: changes player.status to PLAYER_STATUS.ALIVE

    // Inventory
    static CMD_INVENTORY_STATE          = 66; // server -> player (when player inventory changed)
    static CMD_INVENTORY_SELECT         = 79; // Изменение текущего инструмента в руках
    static CMD_INVENTORY_NEW_STATE      = 90; // player -> server

    // Mobs
	static CMD_MOB_ADD                  = 70;
	static CMD_MOB_DELETE               = 71;
    static CMD_MOB_UPDATE               = 72;

    // Drop items
	static CMD_DROP_ITEM_ADDED          = 76;
	static CMD_DROP_ITEM_DELETED        = 77;
	static CMD_DROP_ITEM_UPDATE         = 78;
    static CMD_DROP_ITEM_FULL_UPDATE    = 109;
	static CMD_DROP_ITEM                = 86;
	static CMD_DROP_ITEM_PICKUP         = 99;

    // Use items
    static CMD_USE_ITEM                 = 100;

    // Use effects
    static CMD_EFFECTS_STATE            = 101;

    // Fluid
	static CMD_FLUID_UPDATE             = 102;
    static CMD_FLUID_DELTA              = 105;

    static CMD_BUILDING_SCHEMA_ADD      = 107;

    // NEXT UNUSED COMMAND INDEX        = 117

    // Block actions
    static BLOCK_ACTION_CREATE          = 1;
    static BLOCK_ACTION_DESTROY         = 2;
    static BLOCK_ACTION_MODIFY          = 3;
    static BLOCK_ACTION_REPLACE         = 4;

    ws                                  : WebSocket
    lastPacketReceivedTime              = Infinity; // set to performance.now() when a packet is received

    cmdListeners                        : CmdListenersMap
    cmdListenersForPlayers              : Map<string, CmdListenersMap>
    /** If i-th element is true, then if a listener of i-th command throws an exception, the connection is closed. */
    cmdTerminateOnException             : boolean[] = []

    // Constructor
    constructor(ws: WebSocket) {
        this.ws                         = ws;
        this.chunks_added               = 0;
        this.ping_time                  = null;
        this.ping_value                 = null;
        this.stat                       = {
            out_packets: {
                total: 0
            },
            in_packets: {
                size: 0,
                physical: 0,
                total: 0
            }
        };
        // Commands listeners
        this.cmdListeners               = new Map();
        this.cmdListenersForPlayers     = new Map();
        // Add listeners for server commands
        this.AddCmdListener([ServerClient.CMD_PONG], (cmd) => {this.ping_value = performance.now() - this.ping_time;});
        this.AddCmdListener([ServerClient.CMD_NOTHING], () => {})
    }

    //
    RemovePlayerListeners(user_guid) {
        if(this.cmdListenersForPlayers.has(user_guid)) {
            this.cmdListenersForPlayers.delete(user_guid);
            return true;
        }
        return false;
    }

    // Add listeners for server commands
    AddCmdListener(cmd_list: int[], listener: CmdListener, user_guid? : string | null, terminateOnException?: boolean) {
        let listeners = this.cmdListeners
        if(user_guid) {
            if(!this.cmdListenersForPlayers.has(user_guid)) {
                this.cmdListenersForPlayers.set(user_guid, new Map());
            }
            listeners = this.cmdListenersForPlayers.get(user_guid);
        }
        for(let cmd of cmd_list) {
            if(!listeners.has(cmd)) {
                listeners.set(cmd, new Set())
            }
            listeners.get(cmd).add(listener)
            if (terminateOnException) {
                this.cmdTerminateOnException[cmd] = true
            }
        }
    }

    //
    async connect(onOpen, onClose) {

        let that = this;

        return new Promise(res => {
            that.ws.onmessage = function(e) {
                that._onMessage(e);
            };
            that.ws.onclose = function(event) {
                onClose();
            };
            that.ws.onopen = function(event) {
                onOpen(event);
                res(event);
                that.t = setInterval(function() {
                    that.ping_time = performance.now();
                    that.Send({
                        name: ServerClient.CMD_PING,
                        data: null
                    });
                }, 60000);
            };
        });

    }

    close(code) {
        if(this.ws) {
            this.ws.close(code);
            this.ws = null;
            if(this.t) {
                clearInterval(this.t);
            }
        }
    }

    // New commands from server
    _onMessage(event) {

        const cmds              = JSON.parse(event.data);
        // time is the same for all commands, so it's saved once in the 1st of them
        const cmdsTime          = cmds[0]?.time;
        const chunkManager      = Qubatch.world.chunkManager;
        const chunk_modifiers   = chunkManager.chunk_modifiers;
        const prev_chunk_addr   = new Vector(Infinity, Infinity, Infinity);
        const set_block_list    = [];
        let arr                 = [];
        let chunk_addr          = new Vector(Infinity, Infinity, Infinity);
        this.lastPacketReceivedTime = performance.now();
        if(!chunkManager) debugger
        for(let i = cmds.length - 1; i >= 0; i--) {
            const cmd = cmds[i];
            cmd.time = cmdsTime;
            // CMD_BLOCK_SET
            if(cmd.name == ServerClient.CMD_BLOCK_SET) {
                chunkManager.block_sets++;
                const pos = cmd.data.pos;
                chunk_addr = Vector.toChunkAddr(pos, chunk_addr);
                if(!prev_chunk_addr.equal(chunk_addr)) {
                    prev_chunk_addr.copyFrom(chunk_addr);
                    arr = chunk_modifiers.get(chunk_addr);
                    if(!arr) {
                        arr = [];
                        chunk_modifiers.set(chunk_addr, arr);
                    }
                }
                arr.push(cmd.data);
                delete(cmds[i]);
            }
        }
        // Only set blocks
        if(chunk_modifiers.size > 0) {
            for(const [chunk_addr, arr] of chunk_modifiers.entries()) {
                const chunk = chunkManager.getChunk(chunk_addr);
                if(chunk?.tblocks) {
                    chunk_modifiers.delete(chunk_addr);
                    chunk.newModifiers(arr, set_block_list);
                }
            }
            if(set_block_list.length > 0) {
                chunkManager.postWorkerMessage(['setBlock', set_block_list]);
            }
        }
        //
        this.stat.in_packets.physical++;
        this.stat.in_packets.size += event.data.length;
        for(let i = 0; i < cmds.length; i++) {
            const cmd = cmds[i];
            if(!cmd) {
                continue;
            }
            // stat
            if(!this.stat.in_packets[cmd.name]) {
                this.stat.in_packets[cmd.name] = {count: 0, size: 0}
            }
            const in_packets = this.stat.in_packets[cmd.name];
            in_packets.count++;
            this.stat.in_packets.total++;
            in_packets.size += JSON.stringify(cmd).length;
            //
            let listeners = null;
            if('user_guid' in cmd) {
                if(this.cmdListenersForPlayers.has(cmd.user_guid)) {
                    listeners = this.cmdListenersForPlayers
                        .get(cmd.user_guid)
                        .get(cmd.name);
                }
            } else {
                listeners = this.cmdListeners.get(cmd.name);
            }
            if(listeners) {
                try {
                    for(let listener of listeners.values()) {
                        listener(cmd);
                    }
                } catch (e) {
                    if (this.cmdTerminateOnException[cmd.name]) {
                        console.error(`Connection is closed due to unrecoverable error in command ${cmd.name} ${e}`)
                        this.ws.close(1000)
                    }
                    throw e
                }
            }
        }
    }

    //
    static getCommandTitle(cmd_id: int): string | int {
        //
        if(!this.cmd_titles) {
            this.cmd_titles = new Map();
            for(let title in ServerClient) {
                if(title.startsWith('CMD_')) {
                    this.cmd_titles.set(ServerClient[title], title);
                }
            }
        }
        //
        return this.cmd_titles.get(cmd_id) ?? cmd_id;
    }

    Send(packet) {
        setTimeout(() => {
            let json = JSON.stringify(packet);
            if(!this.stat.out_packets[packet.name]) {
                this.stat.out_packets[packet.name] = {count: 0, size: 0}
            }
            let out_packets = this.stat.out_packets[packet.name];
            out_packets.count++;
            this.stat.out_packets.total++;
            out_packets.size += json.length;
            this.ws.send(json);
        }, 0);
    }

    loadChunk(addr : Vector) {
        this.chunks_added++;
        this.Send({name: ServerClient.CMD_CHUNK_LOAD, data: {pos: addr}});
    }

    setRenderDist(value : int) {
        this.Send({name: ServerClient.CMD_CHANGE_RENDER_DIST, data: value});
    }

    SendMessage(text : string) {
        this.Send({name: ServerClient.CMD_CHAT_SEND_MESSAGE, data: {text: text}});
    }

    // Запрос содержимого сундука
    LoadChest(info) {
        this.Send({name: ServerClient.CMD_LOAD_CHEST, data: info});
    }

    //
    ChestConfirm(params) {
        this.Send({name: ServerClient.CMD_CHEST_CONFIRM, data: params});
    }

    // Смена точки спавна
    SetPosSpawn(pos) {
        this.Send({name: ServerClient.CMD_CHANGE_POS_SPAWN, data: {
            pos: pos
        }});
    }

    //
    Teleport(place_id : string, pos : Vector, safe : boolean) {
        this.Send({name: ServerClient.CMD_TELEPORT_REQUEST, data: {
            place_id: place_id,
            pos: pos,
            safe: safe
        }});
    }

    // Modify indicator request
    ModifyIndicator(indicator, value, comment) {
        const data = {indicator, value, comment}
        this.Send({name: ServerClient.CMD_MODIFY_INDICATOR_REQUEST, data: data});
    }

    // Изменение текущего инструмента в руках
    InventorySelect(data) {
        this.Send({name: ServerClient.CMD_INVENTORY_SELECT, data: data});
    }

    // Save inventory
    InventoryNewState(state, used_recipes, recipe_manager_type = null, dont_check_equal = false) {
        this.Send({name: ServerClient.CMD_INVENTORY_NEW_STATE,
            data: {state, used_recipes, recipe_manager_type, dont_check_equal}
        });
    }

    // Switch to next game mode
    GameModeNext() {
        this.Send({name: ServerClient.CMD_GAMEMODE_NEXT, data: null});
    }

    // Switch to specific game mode
    GameModeSet(mode_id) {
        this.Send({name: ServerClient.CMD_GAMEMODE_SET, data: {id: mode_id}});
    }

    // Clone block from pos
    CloneBlock(pos) {
        this.Send({name: ServerClient.CMD_BLOCK_CLONE, data: pos});
    }

    DropItem() {
        this.Send({name: ServerClient.CMD_DROP_ITEM, data: {
            hand: 1
        }});
    }

    LoadQuests() {
        this.Send({name: ServerClient.CMD_QUEST_GET_ENABLED, data: null});
    }

    PickupDropItem(entity_ids) {
        this.Send({name: ServerClient.CMD_DROP_ITEM_PICKUP, data: entity_ids});
    }

}