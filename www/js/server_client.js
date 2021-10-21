import {Helpers, Vector} from "./helpers.js";
import PlayerModel from "./player_model.js";

export default class ServerClient {

    // System
    static CMD_HELO                     = 1;
    static CMD_PING                     = 3;
    static CMD_PONG                     = 4;
    static CMD_CONNECT                  = 34;
    static CMD_CONNECTED                = 62;
    // Cnunks and blocks
    static CMD_BLOCK_DESTROY            = 35;
    static CMD_BLOCK_SET                = 36;
    static CMD_CHUNK_ADD                = 37;
    static CMD_CHUNK_REMOVE             = 38;
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
    static CMD_WORLD_STATE              = 60;
    static CMD_CHANGE_POS_SPAWN         = 63;
    static CMD_TELEPORT_REQUEST         = 64; // запрос от игрока на телепорт в указанное уникальное место(spawn|random) или к точным координатам
    static CMD_TELEPORT                 = 65; // сервер телепортировал игрока
    static CMD_SAVE_INVENTORY           = 66;
    static CMD_NEARBY_MODIFIED_CHUNKS   = 67 // Чанки, находящиеся рядом с игроком, у которых есть модификаторы

    // Constructor
    constructor(url, session_id, onOpenCallback) {
        let that                          = this;
        this.chunks_added                 = 0;
        that.ping_time                    = null;
        that.ping_value                   = null;
        this.stat                         = {
            out_packets: {},
            in_packets: {}
        };
        this._loadID();
        this.ws = new WebSocket(url + '?session_id=' + session_id + '&skin=' + Game.skin.id /*, 'protocolOne'*/);
        this.ws.onmessage = function(e) {
            that._onMessage(e);
        };
        this.ws.onclose = function(event) {
            Game.world.saveToDB(function() {
                location.reload();
            });
        };
        this.ws.onopen = function(event) {
            onOpenCallback(event);
            this.t = setInterval(function() {
                that.ping_time = performance.now();
                that.Send({
                    name: ServerClient.CMD_PING,
                    data: null
                });
            }, (Helpers.isDev() ? 300 : 5) * 1000);
        };
    }

    // Restore local use ID or create it
    _loadID() {
        let id = localStorage.getItem('id');
        if(!id) {
            id = Helpers.generateID();
            localStorage.setItem('id', id)
        }
        this.id = id;
    }

    // New commands from server
    _onMessage(event) {
        let that = this;
        let cmds = JSON.parse(event.data);
        for(let cmd of cmds) {
            // stat
            if(!this.stat.in_packets[cmd.event]) {
                this.stat.in_packets[cmd.event] = {count: 0, size: 0}
            }
            let in_packets = this.stat.in_packets[cmd.event];
            in_packets.count++;
            in_packets.size += event.data.length;
            // parse command
            switch(cmd.event) {
                case ServerClient.CMD_CONNECTED: {
                    Game.world.onServerConnect(cmd.data);
                    break;
                }
                case ServerClient.CMD_BLOCK_SET: {
                    let pos = cmd.data.pos;
                    let item = cmd.data.item;
                    let block = BLOCK.fromId(item.id);
                    let extra_data = cmd.data.item.extra_data ? cmd.data.item.extra_data : null;
                    Game.world.chunkManager.setBlock(pos.x, pos.y, pos.z, block, false, item.power, item.rotate, item.entity_id, extra_data);
                    break;
                }
                case ServerClient.CMD_CHUNK_LOADED: {
                    Game.world.chunkManager.setChunkState(cmd.data);
                    break;
                }
                case ServerClient.CMD_PONG: {
                    that.ping_value = performance.now() - that.ping_time;
                    break;
                }
                case ServerClient.CMD_CHAT_SEND_MESSAGE: {
                    Game.world.localPlayer.chat.messages.add(cmd.data.nickname, cmd.data.text);
                    break;
                }
                case ServerClient.CMD_CHEST_CONTENT: {
                    Game.hud.wm.getWindow('frmChest').setData(cmd.data);
                    break;
                }
                case ServerClient.CMD_PLAYER_JOIN: {
                    let data = cmd.data;
                    Game.world.players[data.id] = new PlayerModel({
                        id:             data.id,
                        itsme:          data.nickname == Game.world.session.username,
                        pos:            data.pos,
                        pitch:          data.rotate.x,
                        yaw:            data.rotate.z,
                        skin:           Game.skins.getById(data.skin),
                        nick:           data.nickname
                    });
                    break;
                }
                case ServerClient.CMD_PLAYER_LEAVE: {
                    let data = cmd.data;
                    delete(Game.world.players[data.id]);
                    break;
                }
                case ServerClient.CMD_PLAYER_STATE: {
                    let data = cmd.data;
                    let pl = Game.world.players[data.id];
                    if(pl) {
                        if(Helpers.distance(data.pos, pl.pos) > 0.001) {
                            pl.moving = true;
                        }
                        pl.pos      = data.pos;
                        pl.pitch    = data.rotate.x;
                        pl.yaw      = data.rotate.z;
                        if(pl.moving_timeout) {
                            clearTimeout(pl.moving_timeout);
                        }
                        pl.moving_timeout = window.setTimeout(function() {
                            pl.moving = false
                        }, 100);
                    }
                    break;
                }
                case ServerClient.CMD_WORLD_STATE: {
                    let data = cmd.data;
                    Game.world.setServerState(data);
                    break;
                }
                case ServerClient.CMD_TELEPORT: {
                    Game.world.localPlayer.setPosition(cmd.data.pos);
                    break;
                }
                case ServerClient.CMD_NEARBY_MODIFIED_CHUNKS: {
                    Game.world.chunkManager.setNearbyModified(cmd.data);
                    break;
                }
            }
        }
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

    ChunkAdd(addr) {
        this.chunks_added++;
        this.Send({name: ServerClient.CMD_CHUNK_ADD, data: {pos: addr}});
    }

    ChunkRemove(addr) {
        this.Send({name: ServerClient.CMD_CHUNK_REMOVE, data: {pos: addr}});
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
            item: item
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

    // Save inventory
    SaveInventory(inventory_state) {
        this.Send({name: ServerClient.CMD_SAVE_INVENTORY, data: inventory_state});
    }

}
