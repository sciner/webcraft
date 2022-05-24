import {Vector, VectorCollector} from "../www/js/helpers.js";
import {Player} from "../www/js/player.js";
import {GameMode} from "../www/js/game_mode.js";
import {ServerClient} from "../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../www/js/Raycaster.js";
import { ServerWorld } from "./server_world.js";
import { PlayerInventory } from "../www/js/player_inventory.js";
import { getChunkAddr } from "../www/js/chunk.js";
import {PlayerEvent} from "./player_event.js";
import config from "./config.js";
import {QuestPlayer} from "./quest/player.js";
import {Packet} from "./network/packets.js";

const MAX_PICK_UP_DROP_ITEMS_PER_TICK = 16;

const CHECK_DROP_ITEM_CHUNK_OFFSETS = [
    new Vector(-1, 0, -1),
    new Vector(0, 0, -1),
    new Vector(1, 0, -1),
    new Vector(-1, 0, 0),
    new Vector(0, 0, 0),
    new Vector(1, 0, 0),
    new Vector(-1, 0, 1),
    new Vector(0, 0, 1),
    new Vector(1, 0, 1)
];

export class NetworkMessage {
    constructor({
        time = Date.now(),
        name = '',
        data = {}
    }) {
        this.time = time;
        this.name = name;
        this.data = data;
    }
}

const EMULATED_PING = config.Debug ? Math.random() * 100 : 0;

async function waitPing() {
    return new Promise((res) => setTimeout(res, EMULATED_PING));
}

export class ServerPlayer extends Player {

    #forward;
    #_rotateDegree;

    constructor() {
        super();
        this.indicators_changed     = true;
        this.position_changed       = false;
        this.chunk_addr             = new Vector(0, 0, 0);
        this.chunk_addr_o           = new Vector(0, 0, 0);
        this._eye_pos               = new Vector(0, 0, 0);
        this.#_rotateDegree         = new Vector(0, 0, 0);
        this.chunks                 = new VectorCollector();
        this.nearby_chunk_addrs     = new VectorCollector();
        this.#forward               = new Vector(0, 1, 0);
        this.game_mode              = new GameMode(null, this);
        this.game_mode.onSelect     = async (mode) => {
            await this.world.db.changeGameMode(this, mode.id);
            this.sendPackets([{name: ServerClient.CMD_GAMEMODE_SET, data: mode}]);
            this.world.chat.sendSystemChatMessageToSelectedPlayers('Game mode changed to ... ' + mode.title, [this.session.user_id]);
        };
        /**
         * @type {ServerWorld}
         */
        this.world;
        this.session_id             = '';
        this.skin                   = '';
        this.checkDropItemIndex     = 0;
        this.checkDropItemTempVec   = new Vector();
        this.newInventoryStates     = [];
        this.dt_connect             = new Date();
        this.packet = new Packet();
        this.is_dead = false;
    }

    init(init_info) {
        this.state = init_info.state;
        this.inventory = new PlayerInventory(this, init_info.inventory);
        this.game_mode.applyMode(init_info.state.game_mode, false);
    }

    // On crafted listener
    onCrafted(recipe, item) {
        PlayerEvent.trigger({
            type: PlayerEvent.CRAFT,
            player: this,
            data: {recipe, item}
        });
    }

    // On
    onPutInventoryItems(item) {
        PlayerEvent.trigger({
            type: PlayerEvent.PUT_ITEM_TO_INVENTORY,
            player: this,
            data: {item}
        });
    }

    /**
     * 
     * @param {string} session_id 
     * @param {string} skin 
     * @param {WebSocket} conn 
     * @param {ServerWorld} world 
     */
    async onJoin(session_id, skin, conn, world) {
        
        if (EMULATED_PING) {
            console.log('Connect user with emulated ping:', EMULATED_PING);
        }

        this.conn               = conn;
        this.world              = world;
        this.raycaster          = new Raycaster(world);
        this.session_id         = session_id;
        this.skin               = skin;
        //
        conn.player = this;
        conn.on('message', this.onMessage.bind(this));
        //
        conn.on('close', async (e) => {
            this.world.onLeave(this);
        });
        //
        this.sendPackets([{
            name: ServerClient.CMD_HELLO,
            data: `Welcome to MadCraft ver. 0.0.4 (${world.info.guid})`
        }]);

        this.sendWorldInfo(false);
    }

    // sendWorldInfo
    sendWorldInfo(update) {
        this.sendPackets([{name: update ? ServerClient.CMD_WORLD_UPDATE_INFO : ServerClient.CMD_WORLD_INFO, data: this.world.getInfo()}]);
    }

    async onMessage(response) {

        if (EMULATED_PING) {
            await waitPing();
        }

        const {
            skin,
            session_id,
            world
        } = this;

        const cmd = JSON.parse(response);
        
        this.packet.ReadPacket(this, cmd);

        try {
            if (this.is_dead && cmd.name != ServerClient.CMD_RESURRECTION) {
                return;
            }
            switch(cmd.name) {
                // Connect
                case ServerClient.CMD_CONNECT: {
                    let world_guid = cmd.data.world_guid;
                    this.session = await Game.db.GetPlayerSession(session_id);
                    Log.append('CmdConnect', {world_guid, session: this.session});
                    world.onPlayer(this, skin);
                    break;
                }

                case ServerClient.CMD_SYNC_TIME: {
                    break;
                    this.sendPackets([{
                        name: ServerClient.CMD_SYNC_TIME,
                        data: { clientTime: cmd.data.clientTime },
                    }]);
                    break;
                }

                // Send message to chat
                case ServerClient.CMD_CHAT_SEND_MESSAGE: {
                    this.world.chat.sendMessage(this, cmd.data);
                    break;
                }

                // Change spawn position
                case ServerClient.CMD_CHANGE_POS_SPAWN: {
                    this.changePosSpawn(cmd.data);
                    break;
                }

                case ServerClient.CMD_TELEPORT_REQUEST: {
                    this.world.teleportPlayer(this, cmd.data);
                    break;
                }

                // Player state
                case ServerClient.CMD_PLAYER_STATE: {
                    // Update local position
                    this.world.changePlayerPosition(this, cmd.data);
                    // Send new position to other players
                    /*
                    let packets = [{
                        name: ServerClient.CMD_PLAYER_STATE,
                        data: this.exportState()
                    }];
                    this.world.sendAll(packets, [this.session.user_id]);
                    */
                    /*const pick = this.raycastFromHead();
                    if (pick) {
                        let block = this.world.chunkManager.getBlock(pick.x, pick.y, pick.z);
                        // let dist = mob.pos.distance(new Vector(pick.x + .5, pick.y, pick.z + .5));
                        if(block) {
                            console.log('Player pick at block: ', block.material.name);
                        }
                    }
                    */
                    break;
                }

                // Request chest content
                case ServerClient.CMD_LOAD_CHEST: {
                    this.world.chest_load_queue.add(this, cmd.data);
                    break;
                }
            
                case ServerClient.CMD_CHEST_CONFIRM: {
                    this.world.chest_confirm_queue.add(this, cmd.data);
                    break;
                }
                    
                // Пользователь подгрузил чанк
                case ServerClient.CMD_CHUNK_LOAD: {
                    let addr = new Vector(cmd.data.pos);
                    if(this.nearby_chunk_addrs.has(addr)) {
                        this.world.loadChunkForPlayer(this, addr);
                    }
                    break;
                }

                case ServerClient.CMD_PICKAT_ACTION: {
                    //this.world.pickAtAction(this, cmd.data);
                    break;
                }

                case ServerClient.CMD_QUEST_GET_ENABLED: {
                    this.quests.sendAll();
                    break;
                }

                case ServerClient.CMD_INVENTORY_SELECT: {
                    this.inventory.setIndexes(cmd.data, false);
                    break;
                }

                case ServerClient.CMD_INVENTORY_NEW_STATE: {
                    this.newInventoryStates.push(cmd.data);
                    break;
                }

                case ServerClient.CMD_CREATE_ENTITY: {
                    this.world.createEntity(this, cmd.data);
                    break;
                }

                case ServerClient.CMD_CHANGE_RENDER_DIST: {
                    this.changeRenderDist(parseInt(cmd.data));
                    break;
                }

                case ServerClient.CMD_GAMEMODE_NEXT: {
                    if(!this.world.admins.checkIsAdmin(this)) {
                        throw 'error_not_permitted';
                    }
                    this.game_mode.next();
                    break;
                }

                case ServerClient.CMD_GAMEMODE_SET: {
                    if(!this.world.admins.checkIsAdmin(this)) {
                        throw 'error_not_permitted';
                    }
                    this.game_mode.applyMode(cmd.data.id, true);
                    break;
                }

                case ServerClient.CMD_BLOCK_CLONE: {
                    const pos = new Vector(cmd.data);
                    const chunk_addr = getChunkAddr(pos);
                    let chunk = this.world.chunks.get(chunk_addr);
                    if(!chunk) {
                        throw 'error_invalid_block_position';
                    }
                    const block = chunk.getBlock(pos);
                    this.inventory.cloneMaterial(block.material, this.game_mode.getCurrent().block_clone);
                    break;
                }

                case ServerClient.CMD_DROP_ITEM: {
                    this.inventory.dropItem(cmd.data);
                    break;
                }

            }
        } catch(e) {
            console.log(e);
            let packets = [{
                name: ServerClient.CMD_ERROR,
                data: {
                    message: e
                }
            }];
            this.world.sendSelected(packets, [this.session.user_id], []);
        }
    }

    // onLeave...
    async onLeave() {
        for(let addr of this.chunks) {
            this.world.chunks.get(addr)?.removePlayer(this);
        }
        PlayerEvent.removeHandler(this.session.user_id);
        //
        //try {
        //    this.conn.close();
        //} catch(e) {
        //    console.error(e);
        //}
    }

    // Change live value
    // Die checked in tick()
    changeLive(value) {
        if(this.is_dead) {
            return false;
        }
        const ind = this.state.indicators.live;
        const prev_value = ind.value;
        ind.value = Math.max(prev_value + value, 0);
        console.log(`Player live ${prev_value} -> ${ind.value}`);
        this.indicators_changed = true;
        return true;
    }

    /**
     * sendPackets
     * @param {NetworkMessage[]} packets 
     */
    sendPackets(packets) {
        packets.forEach(e => {
            e.time = this.world.serverTime;
        });

        if (!EMULATED_PING) {            
            this.conn.send(JSON.stringify(packets));
            return;
        }

        setTimeout(()=>{                
            this.conn.send(JSON.stringify(packets));
        }, EMULATED_PING);
    }

    // changePosSpawn...
    changePosSpawn(params) {
        this.world.db.changePosSpawn(this, params);
        this.state.pos_spawn = new Vector(params.pos);
        let message = 'Установлена точка возрождения ' + params.pos.x + ", " + params.pos.y + ", " + params.pos.z;
        this.world.chat.sendSystemChatMessageToSelectedPlayers(message, [this.session.user_id]);
    }
    
    // Change render dist
    // 0(1chunk), 1(9), 2(25chunks), 3(45), 4(69), 5(109), 6(145), 7(193), 8(249) 9(305) 10(373) 11(437) 12(517)
    changeRenderDist(value) {
        if(Number.isNaN(value)) {
            value = 4;
        }
        value = Math.max(value, 2);
        value = Math.min(value, 16);
        this.state.chunk_render_dist = value;
        this.world.chunks.checkPlayerVisibleChunks(this, true);
        this.world.db.changeRenderDist(this, value);
    }

    // Update hands material
    updateHands() {
        let inventory = this.inventory;
        if(!this.state.hands) {
            this.state.hands = {};
        }
        //
        let makeHand = (material) => {
            return {
                id: material ? material.id : null
            };
        };
        // Get materials
        let left_hand_material = inventory.current.index2 >= 0 ? inventory.items[inventory.current.index2] : null;
        let right_hand_material = inventory.items[inventory.current.index];
        this.state.hands.left = makeHand(left_hand_material);
        this.state.hands.right = makeHand(right_hand_material);
    }

    /**
     * @param {ServerChunk} chunk 
     */
    addChunk(chunk) {
        this.chunks.set(chunk.addr, chunk.addr);
    }

    get rotateDegree() {
        // Rad to degree
        return this.#_rotateDegree.set(
            (this.state.rotate.x / Math.PI) * 180,
            (this.state.rotate.y - Math.PI) * 180 % 360,
            (this.state.rotate.z / (Math.PI * 2) * 360 + 180) % 360
        );
    }

    get forward() {
        return this.#forward.set(
            Math.sin(this.state.rotate.z),
            Math.sin(this.state.rotate.x),
            Math.cos(this.state.rotate.z),
        );
    }

    // Returns the position of the eyes of the player for rendering.
    getEyePos() {
        return this._eye_pos.set(this.state.pos.x, this.state.pos.y + this.height, this.state.pos.z);
    }

    /**
     * @returns {null | RaycasterResult}
     */
    raycastFromHead() {
        return this.raycaster.get(this.getEyePos(), this.forward, 100);
    }

    //
    exportState()  {
        return {
            id:       this.session.user_id,
            username: this.session.username,
            pos:      this.state.pos,
            rotate:   this.state.rotate,
            skin:     this.state.skin,
            hands:    this.state.hands,
            sneak:    this.state.sneak
        };
    }

    tick(delta) {
        // 1.
        this.world.chunks.checkPlayerVisibleChunks(this, false);
        // 2. Check near drop items
        this.checkNearDropItems();
        // 3. Check has new inventory state
        this.checkInventoryChanges();
        //
        this.sendState();
        //
        this.checkIndicators();

    }

    //
    checkInventoryChanges() {
        if(this.newInventoryStates.length == 0) {
            return;
        }
        const state = this.newInventoryStates[0];
        // Apply new inventory state
        this.inventory.newState(state);
        this.newInventoryStates.shift();
    }

    // Send current state to players
    sendState() {
        let chunk_over = this.world.chunks.get(this.chunk_addr);
        if(!chunk_over) {
            return;
        }
        // Send new position to other players
        let packets = [{
            name: ServerClient.CMD_PLAYER_STATE,
            data: this.exportState()
        }];
        // this.world.sendAll(packets, [this.session.user_id]);
        this.world.sendSelected(packets, Array.from(chunk_over.connections.keys()), [this.session.user_id]);
    }

    //
    checkIndicators() {
        if(!this.indicators_changed || this.is_dead) {
            return false;
        }
        this.indicators_changed = false;
        // notify player about his new indicators
        const packets = [{
            name: ServerClient.CMD_ENTITY_INDICATORS,
            data: {
                indicators: this.state.indicators
            }
        }];
        // check if died
        if(this.state.indicators.live.value <= 0) {
            this.is_dead = true;
            packets.push({
                name: ServerClient.CMD_DIE,
                data: {}
            });
        }
        this.world.sendSelected(packets, [this.session.user_id], []);
        // @todo notify all about change?
    }

    // Check near drop items
    checkNearDropItems() {
        let offset = CHECK_DROP_ITEM_CHUNK_OFFSETS[this.checkDropItemIndex++ % CHECK_DROP_ITEM_CHUNK_OFFSETS.length];
        this.checkDropItemTempVec.set(this.chunk_addr.x + offset.x, this.chunk_addr.y + offset.y, this.chunk_addr.z + offset.z);
        let chunk = this.world.chunks.get(this.checkDropItemTempVec);
        if(!chunk) {
            return;
        }
        let entity_ids = [];
        if(chunk.drop_items.size > 0) {
            let near = [];
            // pick up the maximum number of items per tick
            for(const [entity_id, drop_item] of chunk.drop_items) {
                // so that the player does not immediately intercept the thrown item
                if(performance.now() - drop_item.load_time < 200) {
                    continue;
                }
                let dist = drop_item.pos.distance(this.state.pos);
                if(dist < 2) {
                    near.push(drop_item.items);
                    chunk.drop_items.delete(entity_id);
                    drop_item.onUnload();
                    entity_ids.push(drop_item.entity_id);
                    if(near.length == MAX_PICK_UP_DROP_ITEMS_PER_TICK) {
                        break;
                    }
                }
            }
            if(near.length > 0) {
                // 1. add items to inventory
                for(const drop_item of near) {
                    for(const item of drop_item) {
                        this.inventory.increment(item);
                    }
                }
                // 2. deactive drop item in database
                for(let entity_id of entity_ids) {
                    this.world.db.deleteDropItem(entity_id);
                }
                // 3. play sound on client
                let packets_sound = [{
                    name: ServerClient.CMD_PLAY_SOUND,
                    data: {tag: 'madcraft:entity.item.pickup', action: 'hit'}
                }];
                this.world.sendSelected(packets_sound, [this.session.user_id], []);
                // 4.
                let packets = [{
                    name: ServerClient.CMD_DROP_ITEM_DELETED,
                    data: entity_ids
                }];
                chunk.sendAll(packets, []);
                PlayerEvent.trigger({
                    type: PlayerEvent.PICKUP_ITEMS,
                    player: this,
                    data: {items: near.flat()}
                });
            }
        }
    }

    async initQuests() {
        this.quests = new QuestPlayer(this.world.quests, this);
        await this.quests.init();
    }
}