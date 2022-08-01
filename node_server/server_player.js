import {Vector, VectorCollector} from "../www/js/helpers.js";
import {Player} from "../www/js/player.js";
import {GameMode} from "../www/js/game_mode.js";
import {ServerClient} from "../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../www/js/Raycaster.js";
import { ServerWorld } from "./server_world.js";
import {PlayerEvent} from "./player_event.js";
import config from "./config.js";
import {QuestPlayer} from "./quest/player.js";
import { ServerPlayerInventory } from "./server_player_inventory.js";
import { ALLOW_NEGATIVE_Y } from "../www/js/chunk_const.js";

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

const EMULATED_PING             = config.Debug ? Math.random() * 100 : 0;
const MAX_COORD                 = 2000000000;
const MAX_RANDOM_TELEPORT_COORD = 2000000;

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
        this.dt_connect             = new Date();
        this.is_dead                = false;
    }

    init(init_info) {
        this.state = init_info.state;
        this.state.lies = this.state?.lies || false;
        this.state.sitting = this.state?.sitting || false;
        this.inventory = new ServerPlayerInventory(this, init_info.inventory);
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

    // on message
    async onMessage(message) {
        if (EMULATED_PING) {
            await waitPing();
        }
        this.world.network_stat.in += message.length;
        this.world.network_stat.in_count++;
        const packet = JSON.parse(message);
        this.world.packet_reader.read(this, packet);
    }

    // onLeave...
    async onLeave() {
        if(!this.conn) {
            return false;
        }
        // remove player from chunks
        for(let addr of this.chunks) {
            this.world.chunks.get(addr)?.removePlayer(this);
        }
        this.chunks.clear();
        // remove events handler
        PlayerEvent.removeHandler(this.session.user_id);
        // close previous connection
        this.conn.close(1000, 'error_multiconnection');
        delete(this.conn);
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

        packets = JSON.stringify(packets);
        this.world.network_stat.out += packets.length;
        this.world.network_stat.out_count++;

        if (!EMULATED_PING) {
            this.conn.send(packets);
            return;
        }

        setTimeout(() => {
            this.conn.send(packets);
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
        let subY = 0;
        if(this.state.sitting) {
            subY = this.height * 1/3;
        }
        return this._eye_pos.set(this.state.pos.x, this.state.pos.y + this.height * 0.9375 - subY, this.state.pos.z);
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
            sneak:    this.state.sneak,
            sitting:  this.state.sitting,
            lies:     this.state.lies
        };
    }

    tick(delta) {
        // 1.
        this.world.chunks.checkPlayerVisibleChunks(this, false);
        // 3.
        this.sendState();
        // 4.
        this.checkIndicators();

    }

    // Send current state to other players
    sendState() {
        const chunk_over = this.world.chunks.get(this.chunk_addr);
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
            this.state.stats.death++;
            packets.push({
                name: ServerClient.CMD_DIE,
                data: {}
            });
        }
        this.world.sendSelected(packets, [this.session.user_id], []);
        // @todo notify all about change?
    }

    async initQuests() {
        this.quests = new QuestPlayer(this.world.quests, this);
        await this.quests.init();
    }

    // changePosition...
    changePosition(params) {
        if (!ALLOW_NEGATIVE_Y && params.pos.y < 0) {
            this.teleport({
                place_id: 'spawn'
            })
            return;
        }
        this.state.pos = new Vector(params.pos);
        this.state.rotate = new Vector(params.rotate);
        this.state.sneak = !!params.sneak;
        this.position_changed = true;
    }

    /**
     * Teleport
     * @param {Object} params
     * @return {void}
     */
     teleport(params) {
        const world = this.world;
        var new_pos = null;
        let teleported_player = this;
        if (params.pos) {
            new_pos = params.pos;
        } else if (params.p2p) {
            let from_player = null;
            let to_player = null;
            // tp to another player
            for(let player of world.players.values()) {
                const username = player.session?.username?.toLowerCase();
                if(username == params.p2p.from.toLowerCase()) {
                    from_player = player;
                }
                if(username == params.p2p.to.toLowerCase()) {
                    to_player = player;
                }
            }
            if(from_player && to_player) {
                teleported_player = from_player;
                new_pos = new Vector(to_player.state.pos);
            } else {
                throw 'error_invalid_usernames';
            }
        } else if (params.place_id) {
            switch (params.place_id) {
                case 'spawn': {
                    new_pos = this.state.pos_spawn;
                    break;
                }
                case 'random': {
                    new_pos = new Vector(
                        (Math.random() * MAX_RANDOM_TELEPORT_COORD - Math.random() * MAX_RANDOM_TELEPORT_COORD),
                        120,
                        (Math.random() * MAX_RANDOM_TELEPORT_COORD - Math.random() * MAX_RANDOM_TELEPORT_COORD)
                    ).roundSelf();
                    break;
                }
            }
        }
        if(new_pos) {
            if (Math.abs(new_pos.x) > MAX_COORD || Math.abs(new_pos.y) > MAX_COORD || Math.abs(new_pos.z) > MAX_COORD) {
                console.log('error_too_far');
                throw 'error_too_far';
            }
            const packets = [{
                name: ServerClient.CMD_TELEPORT,
                data: {
                    pos: new_pos,
                    place_id: params.place_id
                }
            }];
            //
            world.sendSelected(packets, [teleported_player.session.user_id], []);
            teleported_player.state.pos = new_pos;
            world.chunks.checkPlayerVisibleChunks(teleported_player, true);
        }
    }

}