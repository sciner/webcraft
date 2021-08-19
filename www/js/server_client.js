import {Helpers, Vector} from "./helpers.js";
import PlayerModel from "./player_model.js";
import {BLOCK} from "./blocks.js";

export default class ServerClient {

    // System
    static EVENT_HELO                   = 1;
    static EVENT_PING                   = 3;
    static EVENT_PONG                   = 4;
    static EVENT_CONNECT                = 34;
    // Cnunks and blocks
    static EVENT_BLOCK_DESTROY          = 35;
    static EVENT_BLOCK_SET              = 36;
    static EVENT_CHUNK_ADD              = 37;
    static EVENT_CHUNK_REMOVE           = 38;
    static EVENT_CHUNK_LOADED           = 39;
    // Chat
    static EVENT_CHAT_SEND_MESSAGE      = 40;
    // Players
    static EVENT_PLAYER_JOIN            = 41;
    static EVENT_PLAYER_LEAVE           = 42;
    static EVENT_PLAYER_STATE           = 43;
    // Entities
    static CLIENT_CREATE_ENTITY         = 44;
    static CLIENT_LOAD_CHEST            = 45;
    static COMMAND_CHEST                = 46;
    static CLIENT_SET_CHEST_SLOT_ITEM   = 47; // Отправка на сервер новых данных слота текущего сундука

    // Constructor
    constructor(url, onOpenCallback) {
        let that = this;
        that.ping_time                    = null;
        that.ping_value                   = null;
        this._loadID();
        this.ws = new WebSocket(url + '?token=' + this.id + '&username=' + Game.username + '&skin=' + Game.skin.id /*, 'protocolOne'*/);
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
                    name: ServerClient.EVENT_PING,
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
            switch(cmd.event) {
                case ServerClient.EVENT_BLOCK_SET: {
                    let pos = cmd.data.pos;
                    let item = cmd.data.item;
                    let block = BLOCK.fromId(item.id);
                    Game.world.chunkManager.setBlock(pos.x, pos.y, pos.z, block, false, item.power, item.rotate, item.entity_id);
                    break;
                }
                case ServerClient.EVENT_CHUNK_LOADED: {
                    Game.world.chunkManager.setChunkState(cmd.data);
                    break;
                }
                case ServerClient.EVENT_PONG: {
                    that.ping_value = performance.now() - that.ping_time;
                    break;
                }
                case ServerClient.EVENT_CHAT_SEND_MESSAGE: {
                    Game.world.localPlayer.chat.messages.add(cmd.data.nickname, cmd.data.text);
                    break;
                }
                case ServerClient.COMMAND_CHEST: {
                    Game.hud.wm.getWindow('frmChest').setData(cmd.data);
                    break;
                }
                case ServerClient.EVENT_PLAYER_JOIN: {
                    let data = cmd.data;
                    Game.world.players[data.id] = new PlayerModel({
                        id:             data.id,
                        itsme:          data.id == Game.world.server.id,
                        pos:            data.pos,
                        pitch:          data.angles ? data.angles[0] : 0,
                        yaw:            data.angles ? data.angles[2] : 0,
                        skin:           Game.skins.getById(data.skin),
                        nick:           data.nickname
                    });
                    break;
                }
                case ServerClient.EVENT_PLAYER_LEAVE: {
                    let data = cmd.data;
                    delete(Game.world.players[data.id]);
                    break;
                }
                case ServerClient.EVENT_PLAYER_STATE: {
                    let data = cmd.data;
                    let pl = Game.world.players[data.id];
                    if(pl) {
                        if(Helpers.distance(data.pos, pl.pos) > 0.001) {
                            pl.moving = true;
                        }
                        pl.pos      = data.pos;
                        pl.pitch    = data.angles[0];
                        pl.yaw      = data.angles[2];
                        if(pl.moving_timeout) {
                            clearTimeout(pl.moving_timeout);
                        }
                        pl.moving_timeout = window.setTimeout(function() {
                            pl.moving = false
                        }, 100);
                    }
                    break;
                }
            }
        }
    }

    Send(packet) {
        let that = this;
        setTimeout(function() {
            that.ws.send(JSON.stringify(packet));
        }, 0);
    }

    ChunkAdd(pos) {
        // #3dchunk
        // Game.world.chunkManager.setChunkState({"pos":pos,"modify_list":{}});
        this.Send({name: ServerClient.EVENT_CHUNK_ADD, data: {pos: pos}});
    }

    ChunkRemove(pos) {
        this.Send({name: ServerClient.EVENT_CHUNK_REMOVE, data: {pos: pos}});
    }

    SendMessage(text) {
        this.Send({name: ServerClient.EVENT_CHAT_SEND_MESSAGE, data: {text: text}});
    }

    // Создание сундука | Create chest
    CreateEntity(id, pos, rotate) {
        this.Send({name: ServerClient.CLIENT_CREATE_ENTITY, data: {
            pos: pos,
            item: {
                id: id,
                power: 1.0,
                rotate: new Vector(
                    Math.round(rotate.x * 10) / 10,
                    Math.round(rotate.y * 10) / 10,
                    Math.round(rotate.z * 10) / 10
                )
            }
        }});
    }

    // Запрос содержимого сундука
    LoadChest(entity_id) {
        this.Send({name: ServerClient.CLIENT_LOAD_CHEST, data: {entity_id: entity_id}});
    }

    // Запрос содержимого сундука
    LoadChest(entity_id) {
        this.Send({name: ServerClient.CLIENT_LOAD_CHEST, data: {entity_id: entity_id}});
    }

    // Отправка на сервер новых данных слота текущего сундука
    SendChestSlotItem(entity_id, slot_index, item) {
        this.Send({name: ServerClient.CLIENT_SET_CHEST_SLOT_ITEM, data: {
            entity_id: entity_id,
            slot_index: slot_index,
            item: item
        }});
    }

}
