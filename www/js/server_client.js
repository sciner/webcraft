import {Vector} from "./helpers.js";

export class ServerClient {

    static cmd_titles               = null;

    // System
    static CMD_HELLO                    = 1;
    static CMD_PING                     = 3;
    static CMD_PONG                     = 4;
    static CMD_SYNC_TIME                = 5;
	static CMD_ERROR                    = 7; // какая-то ошибка (ИСХ)
    static CMD_CHANGE_RENDER_DIST       = 10;
    static CMD_CONNECT                  = 34;
    static CMD_CONNECTED                = 62;
    // Cnunks and blocks
    static CMD_BLOCK_DESTROY            = 35;
    static CMD_BLOCK_SET                = 36;
    static CMD_CHUNK_LOAD               = 37;
    static CMD_CHUNK_LOADED             = 39;
    // Chat
    static CMD_CHAT_SEND_MESSAGE        = 40;
    // Players
    static CMD_PLAYER_JOIN              = 41;
    static CMD_PLAYER_LEAVE             = 42;
    static CMD_PLAYER_STATE             = 43;
    // Entities
    static CMD_CREATE_ENTITY            = 44;
    static CMD_LOAD_CHEST               = 45;
    static CMD_CHEST_CONTENT            = 46;
    static CMD_SET_CHEST_SLOT_ITEM      = 47; // Отправка на сервер новых данных слота текущего сундука
    //
    static CMD_CHANGE_POS_SPAWN         = 63;
    static CMD_TELEPORT_REQUEST         = 64; // запрос от игрока на телепорт в указанное уникальное место(spawn|random) или к точным координатам
    static CMD_TELEPORT                 = 65; // сервер телепортировал игрока
    static CMD_SAVE_INVENTORY           = 66;
    static CMD_NEARBY_CHUNKS            = 67 // Чанки, находящиеся рядом с игроком
    static CMD_MODIFY_INDICATOR_REQUEST = 68; // Обновление одного из видов индикатора (здоровья, еды, кислорода)
    static CMD_ENTITY_INDICATORS        = 69;
	static CMD_WORLD_INFO               = 74;
    
    // Mobs    
	static CMD_MOB_ADD                  = 70;
	static CMD_MOB_ADDED                = 71;
	static CMD_MOB_DELETE               = 72;
	static CMD_MOB_DELETED              = 73;
    static CMD_MOB_UPDATE               = 75;

	static CMD_DROP_ITEM_ADDED          = 76;
	static CMD_DROP_ITEM_DELETED        = 77;
	static CMD_DROP_ITEM_UPDATE         = 78;

    // Block actions
    static BLOCK_ACTION_CREATE          = 1;
    static BLOCK_ACTION_DESTROY         = 2;
    static BLOCK_ACTION_REPLACE         = 3;
    static BLOCK_ACTION_MODIFY          = 4;

    // Constructor
    constructor(ws) {
        this.ws                         = ws;
        this.chunks_added               = 0;
        this.ping_time                  = null;
        this.ping_value                 = null;
        this.stat                       = {
            out_packets: {},
            in_packets: {}
        };
        // Commands listeners
        this.cmdListeners               = new Map();
        this.cmdListenersForPlayers     = new Map();
        // Add listeners for server commands
        this.AddCmdListener([ServerClient.CMD_PONG], (cmd) => {this.ping_value = performance.now() - this.ping_time;});
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
    AddCmdListener(cmd_list, listener, user_guid) {
        if(user_guid) {
            if(!this.cmdListenersForPlayers.has(user_guid)) {
                this.cmdListenersForPlayers.set(user_guid, new Map());
            }
            let listeners = this.cmdListenersForPlayers.get(user_guid);
            for(let cmd of cmd_list) {
                if(!listeners.has(cmd)) {
                    listeners.set(cmd, new Set());
                }
                listeners.get(cmd).add(listener);
            }
            return;
        }
        for(let cmd of cmd_list) {
            if(!this.cmdListeners.has(cmd)) {
                this.cmdListeners.set(cmd, new Set());
            }
            this.cmdListeners.get(cmd).add(listener);
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
                res();
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
        let cmds = JSON.parse(event.data);
        for(let cmd of cmds) {
            // console.log('server > ' + ServerClient.getCommandTitle(cmd.name));
            // stat
            if(!this.stat.in_packets[cmd.name]) {
                this.stat.in_packets[cmd.name] = {count: 0, size: 0}
            }
            let in_packets = this.stat.in_packets[cmd.name];
            in_packets.count++;
            in_packets.size += event.data.length;
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
                for(let listener of listeners.values()) {
                    listener(cmd);
                }
            }
        }
    }

    //
    static getCommandTitle(cmd_id) {
        //
        if(!this.cmd_titles) {
            this.cmd_titles = new Map();
            for(let title in ServerClient) {
                if(title.indexOf('CMD_') == 0) {
                    this.cmd_titles.set(ServerClient[title], title);
                }
            }
        }
        //
        if(this.cmd_titles.has(cmd_id)) {
            return this.cmd_titles.get(cmd_id)
        }
        return cmd_id;
    }

    Send(packet) {
        setTimeout(() => {
            let json = JSON.stringify(packet);
            if(!this.stat.out_packets[packet.name]) {
                this.stat.out_packets[packet.name] = {count: 0, size: 0}
            }
            let out_packets = this.stat.out_packets[packet.name];
            out_packets.count++;
            out_packets.size += json.length;
            this.ws.send(json);
        }, 0);
    }

    loadChunk(addr) {
        this.chunks_added++;
        this.Send({name: ServerClient.CMD_CHUNK_LOAD, data: {pos: addr}});
    }

    setRenderDist(value) {
        this.Send({name: ServerClient.CMD_CHANGE_RENDER_DIST, data: value});
    }

    SendMessage(text) {
        this.Send({name: ServerClient.CMD_CHAT_SEND_MESSAGE, data: {text: text}});
    }

    // Создание сундука | Create chest
    CreateEntity(id, pos, rotate) {
        let mul = new Vector(10, 10, 10);
        this.Send({name: ServerClient.CMD_CREATE_ENTITY, data: {
            pos: pos,
            item: {
                id: id,
                power: 1.0,
                rotate: rotate.mul(mul).round().div(mul)
            }
        }});
    }

    // Запрос содержимого сундука
    LoadChest(entity_id) {
        this.Send({name: ServerClient.CMD_LOAD_CHEST, data: {entity_id: entity_id}});
    }

    // Отправка на сервер новых данных слота текущего сундука
    SendChestSlotItem(entity_id, slot_index, item) {
        this.Send({name: ServerClient.CMD_SET_CHEST_SLOT_ITEM, data: {
            entity_id: entity_id,
            slot_index: slot_index,
            item: {
                id: item.id,
                entity_id: item.entity_id,
                count: item.count,
                power: item.power,
            }
        }});
    }

    // Смена точки спавна
    SetPosSpawn(pos) {
        this.Send({name: ServerClient.CMD_CHANGE_POS_SPAWN, data: {
            pos: pos
        }});
    }

    //
    Teleport(place_id, pos) {
        this.Send({name: ServerClient.CMD_TELEPORT_REQUEST, data: {
            place_id: place_id,
            pos: pos
        }});
    }

    // Modify indicator request
    ModifyIndicator(indicator, value, comment) {
        let data = {
            indicator: indicator,
            value: value,
            comment: comment
        }
        this.Send({name: ServerClient.CMD_MODIFY_INDICATOR_REQUEST, data: data});
    }

}