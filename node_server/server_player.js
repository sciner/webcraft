import {Vector, VectorCollector} from "../www/js/helpers.js";
import {Player} from "../www/js/player.js";
import {GameMode} from "../www/js/game_mode.js";
import {ServerClient} from "../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../www/js/Raycaster.js";
import { ServerWorld } from "./server_world.js";
import { PlayerInventory } from "../www/js/player_inventory.js";
import { getChunkAddr } from "../www/js/chunk.js";
import config from "./config.js";

const PLAYER_HEIGHT = 1.7;
const MAX_PICK_UP_DROP_ITEMS_PER_TICK = 3;

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
        this.position_changed       = false;
        this.chunk_addr             = new Vector(0, 0, 0);
        this.chunk_addr_o           = new Vector(0, 0, 0);
        this._eye_pos               = new Vector(0, 0, 0);
        this.#_rotateDegree         = new Vector(0, 0, 0);
        this.chunks                 = new VectorCollector();
        this.nearby_chunk_addrs     = new VectorCollector();
        this.height                 = PLAYER_HEIGHT;
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
    }

    init(init_info) {
        this.state = init_info.state;
        this.inventory = new PlayerInventory(this, init_info.inventory);
        this.game_mode.applyMode(init_info.state.game_mode, false);
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
            data: `Welcome to MadCraft ver. 0.0.3 (${world.info.guid})`
        }]);
        this.sendPackets([{name: ServerClient.CMD_WORLD_INFO, data: world.info}]);
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

        try {
            switch(cmd.name) {
                // Connect
                case ServerClient.CMD_CONNECT: {
                    let world_guid = cmd.data.world_guid;
                    this.session = await Game.db.GetPlayerSession(session_id);
                    world.onPlayer(this, skin);
                    break;
                }

                case ServerClient.CMD_SYNC_TIME: {
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

                // Modify indicator request
                case ServerClient.CMD_MODIFY_INDICATOR_REQUEST: {
                    switch (cmd.data.indicator) {
                        case 'live': {
                            this.state.indicators.live.value += cmd.data.value;
                            break;
                        }
                        case 'food': {
                            this.state.indicators.food.value += cmd.data.value;
                            break;
                        }
                        case 'oxygen': {
                            this.state.indicators.oxygen.value += cmd.data.value;
                            break;
                        }
                    }
                    if (cmd.data.indicator == 'live' && this.state.indicators.live.value <= 0) {
                        this.state.indicators.live.value = 20;
                        this.world.teleportPlayer(this, {
                            place_id: 'spawn',
                        })
                    }
                    // notify player about his new indicators
                    let packets = [{
                        name: ServerClient.CMD_ENTITY_INDICATORS,
                        data: {
                            indicators: this.state.indicators
                        }
                    }];
                    this.world.sendSelected(packets, [this.session.user_id], []);
                    // @todo notify all about change?
                    break;
                }

                // Request chest content
                case ServerClient.CMD_LOAD_CHEST: {
                    const chest = this.world.chests.get(cmd.data.entity_id);
                    if(chest) {
                        await chest.sendContentToPlayers([this]);
                    } else {
                        throw `Chest ${cmd.data.entity_id} not found`;
                    }
                    break;
                }
            
                case ServerClient.CMD_SET_CHEST_SLOT_ITEM: {
                    const chest = this.world.chests.get(cmd.data.entity_id);
                    if(chest) {
                        chest.setSlotItem(this, cmd.data.slot_index, cmd.data.item);
                    } else {
                        throw `Chest ${cmd.data.entity_id} not found`;
                    }
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

                /*case ServerClient.CMD_BLOCK_SET: {
                    await this.world.setBlock(this, cmd.data);
                    break;
                }*/

                case ServerClient.CMD_PICKAT_ACTION: {
                    this.world.pickAtAction(this, cmd.data);
                    break;
                }

                case ServerClient.CMD_INVENTORY_SELECT: {
                    this.inventory.setIndexes(cmd.data, false);
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
                    this.game_mode.next();
                    break;
                }

                case ServerClient.CMD_GAMEMODE_SET: {
                    this.game_mode.applyMode(cmd.data.id, true);
                    break;
                }

                case ServerClient.CMD_INVENTORY_INCREMENT: {
                    this.inventory.increment(cmd.data);
                    break;
                }

                case ServerClient.CMD_INVENTORY_SET_ITEM: {
                    this.inventory.setItem(cmd.data.index, cmd.data.item);
                    break;
                }

                case ServerClient.CMD_BLOCK_CLONE: {
                    // Check game mode
                    if(!this.game_mode.getCurrent().block_clone) {
                        throw 'error_command_not_working_in_this_game_mode';
                    }
                    //
                    const pos = new Vector(cmd.data);
                    const chunk_addr = getChunkAddr(pos);
                    let chunk = this.world.chunks.get(chunk_addr);
                    if(!chunk) {
                        throw 'error_invalid_block_position';
                    }
                    const block = chunk.getBlock(pos);
                    this.inventory.cloneMaterial(block.material);
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
        //
        //try {
        //    this.conn.close();
        //} catch(e) {
        //    console.error(e);
        //}
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
            hands:    this.state.hands
        };
    }

    tick(delta) {
        // 1.
        this.world.chunks.checkPlayerVisibleChunks(this, false);
        // 2. Check near drop items
        this.checkNearDropItems();
        //
        this.sendState();
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
        this.world.sendSelected(packets, Array.from(chunk_over.connections.keys()), [this.session.id]);
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
                console.log('Pick up drop items: ' + near.length);
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
            }
        }
    }

}