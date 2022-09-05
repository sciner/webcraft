import { Vector, VectorCollector } from "../www/js/helpers.js";
import { Player } from "../www/js/player.js";
import { GameMode } from "../www/js/game_mode.js";
import { ServerClient } from "../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../www/js/Raycaster.js";
import { ServerWorld } from "./server_world.js";
import { PlayerEvent } from "./player_event.js";
import config from "./config.js";
import { QuestPlayer } from "./quest/player.js";
import { ServerPlayerInventory } from "./server_player_inventory.js";
import { ALLOW_NEGATIVE_Y, CHUNK_SIZE_Y } from "../www/js/chunk_const.js";
import { MAX_PORTAL_SEARCH_DIST, PLAYER_MAX_DRAW_DISTANCE, PORTAL_USE_INTERVAL, MAX_OXYGEN_POINTS } from "../www/js/constant.js";
import { WorldPortal, WorldPortalWait } from "../www/js/portal.js";
import { CHUNK_STATE_BLOCKS_GENERATED } from "./server_chunk.js";
import {HeadEffectChecker} from "./effects/head_effects_checker.js";

/**
 * @typedef {import ("./effects/effect").Effect} Effect
 */

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
        this.headEffectsChecker     = new HeadEffectChecker(this);
        
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
        this.in_portal              = false;
        this.wait_portal            = null;
        this.prev_use_portal        = null; // время последнего использования портала
        this.prev_near_players      = new Map();
        /**
         * @type {Effect[]}
         */
        this.effects = [];
    }

    init(init_info) {
        this.state = init_info.state;
        this.game_mode = new GameMode(this, this.state.game_mode);
        this.headEffectsChecker.atGameModeSet(this.game_mode);
        this.game_mode.onSelect     = async (mode) => {
            await this.world.db.changeGameMode(this, mode.id);
            this.sendPackets([{name: ServerClient.CMD_GAMEMODE_SET, data: mode}]);
            this.headEffectsChecker.atGameModeSet(mode);
            this.world.chat.sendSystemChatMessageToSelectedPlayers(`game_mode_changed_to|${mode.title}`, [this.session.user_id]);
        };
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
     * 
     * @param {number} value 
     * @returns {number}
     */
    changeOxygen(value) {
        const ind = this.state.indicators.oxygen;
        const prev_value = ind.value;
        ind.value = Math.min(MAX_OXYGEN_POINTS, Math.max(prev_value + value, 0));
        console.log(`Player live ${prev_value} -> ${ind.value}`);
        this.indicators_changed = true;
        return ind.value;
    }

     /**
     * 
     * @returns {number}
     */
    getOxygenLevel() {
        return this.state.indicators.oxygen;
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
        params.pos = new Vector(params.pos).multiplyScalar(1000).floored().divScalar(1000);
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

    async tick(delta) {
        // 1.
        this.world.chunks.checkPlayerVisibleChunks(this, false);
        // 2.
        this.sendNearPlayers();
        // 3.
        this.checkIndicators();
        // 4.
        this.checkHeadEffects();
        // 5.
        if(Math.random() < .5) this.checkInPortal();
        // 6.
        this.applyEffects();
        // 7.
        await this.checkWaitPortal();
    }

    applyEffects(){
        for(let i = 0; i < this.effects.length; i++){
            let effect = this.effects[i];
            effect.ticks--;
            if (effect.ticks === 0){
                let removeEffect = effect.action();
                if (removeEffect === true){
                    this.effects.splice(i, 1);
                    i--;
                }
            } 
        }
    }

    checkHeadEffects() {
        const pos_legs = new Vector(this.state.pos).flooredSelf();
        pos_legs.y = pos_legs.y + 1;
        const tblock_head = this.world.getBlock(pos_legs);
        this.headEffectsChecker.checkEffectOfBlock(tblock_head);
    }

    async checkWaitPortal() {
        if(!this.wait_portal) {
            return false;
        }
        //
        const wait_info = this.wait_portal;
        //
        const sendTeleport = () => {
            console.log('Teleport to', wait_info.pos.toHash());
            const packets = [{
                name: ServerClient.CMD_TELEPORT,
                data: {
                    pos: wait_info.pos,
                    place_id: wait_info.params.place_id
                }
            }];
            this.world.packets_queue.add([this.session.user_id], packets);
            this.wait_portal = null;
            // add teleport particles
            // const actions = new WorldAction(randomUUID());
            // actions.addExplosionParticles([{pos: wait_info.old_pos}]);
            // world.actions_queue.add(null, actions);
        };
        if(wait_info.params?.found_or_generate_portal) {
            const from_portal_id = wait_info.params?.from_portal_id;
            let from_portal;
            let from_portal_type = WorldPortal.getDefaultPortalType();
            if(from_portal_id) {
                from_portal = await this.world.db.portal.getByID(from_portal_id);
                if(from_portal) {
                    //if(WorldPortal.getPortalTypeByID(from_portal.type)) {
                    //    from_portal_type = ...;
                    //}
                    if(from_portal.pair_pos) {
                        wait_info.pos = from_portal.pair.pos;
                    }
                }
            }
            // found existed portal around near
            let exists_portal = null;
            if(from_portal?.pair) {
                exists_portal = await this.world.db.portal.getByID(from_portal?.pair.id);
            }
            if(!exists_portal) {
                exists_portal = await this.world.db.portal.search(wait_info.pos, MAX_PORTAL_SEARCH_DIST);
            }
            console.log('exists_portal', exists_portal);
            if(exists_portal) {
                this.prev_use_portal = performance.now();
                wait_info.pos = exists_portal.player_pos;
                sendTeleport();
            } else {
                // check max attempts
                //const max_attempts = [
                //    0, 0, 123, /* 2 */ 255, 455, /* 4 */ 711, 987, 1307, 1683, 2099,
                //    2567, /*10*/ 3031, 3607, 4203, 4843, 5523, 6203 /* 16 */][this.state.chunk_render_dist];
                //    // const force_teleport = ++wait_info.attempt == max_attempts;
                for(let chunk of this.world.chunks.getAround(wait_info.pos, this.state.chunk_render_dist)) {
                    if(chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
                        const new_portal = await WorldPortal.foundPortalFloorAndBuild(this.session.user_id, this.world, chunk, from_portal_type);
                        if(new_portal) {
                            wait_info.pos = new_portal.player_pos;
                            this.prev_use_portal = performance.now();
                            // pair two portals
                            if(from_portal) {
                                // @todo update from portal
                                await this.world.db.portal.setPortalPair(from_portal.id, {id: new_portal.id, player_pos: new_portal.player_pos});
                                // @todo update new portal
                                await this.world.db.portal.setPortalPair(new_portal.id, {id: from_portal.id, player_pos: from_portal.player_pos});
                            }
                            sendTeleport();
                            break;
                        }
                    }
                }
            }
        } else {
            sendTeleport();
        }
    }

    // Send other players states for me
    sendNearPlayers() {
        const chunk_over = this.world.chunks.get(this.chunk_addr);
        if(!chunk_over) {
            return;
        }
        //
        const packets = [];
        const current_visible_players = new Map();
        for(let player of this.world.players.values()) {
            const user_id = player.session.user_id;
            if(this.session.user_id == user_id) {
                continue;
            }
            let dist = Math.floor(player.state.pos.distance(this.state.pos));
            if(dist < PLAYER_MAX_DRAW_DISTANCE) {
                current_visible_players.set(user_id, null);
            } else {
                if(!this.prev_near_players.has(user_id)) {
                    continue;
                }
                dist = null;
            }
            packets.push({
                name: ServerClient.CMD_PLAYER_STATE,
                data: {dist, ...player.exportState()}
            })
        }
        this.prev_near_players = current_visible_players;
        if(packets.length > 0) {
            this.world.sendSelected(packets, [this.session.user_id]);
        }
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
            // TODO: check and drop inventory items if need
            // const keep_inventory_on_dead = this.world.info.generator?.options?.keep_inventory_on_dead ?? true;
            packets.push({
                name: ServerClient.CMD_DIE,
                data: {}
            });
        }
        this.world.sendSelected(packets, [this.session.user_id], []);
        // @todo notify all about change?
    }

    // Teleport player if in portal
    checkInPortal() {
        if(this.wait_portal) {
            return false;
        }
        if(this.prev_use_portal) {
            if(performance.now() - this.prev_use_portal < PORTAL_USE_INTERVAL) {
                return false;
            }
        }
        //
        const pos_legs      = new Vector(this.state.pos).flooredSelf();
        const tblock_legs   = this.world.getBlock(pos_legs);
        const portal_block  = tblock_legs.material?.is_portal ? tblock_legs : null;
        const in_portal     = !!portal_block;
        //
        if(in_portal != this.in_portal) {
            this.in_portal = in_portal;
            if(this.in_portal) {
                if(!this.wait_portal) {
                    const type = portal_block.extra_data?.type;
                    if(type) {
                        const from_portal_id = portal_block.extra_data.id;
                        this.teleport({portal: {type, from_portal_id}});
                    }
                }
            }
        }
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
        let new_pos = null;
        let teleported_player = this;
        if(params.pos) {
            // 1. teleport to pos
            new_pos = params.pos = new Vector(params.pos);
        } else if(params.p2p) {
            // teleport player to player
            let from_player = null;
            let to_player = null;
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
        } else if(params.place_id) {
            // teleport to place
            switch(params.place_id) {
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
        } else if(params.portal) {
            // teleport by portal
            const portal_type = WorldPortal.getPortalTypeByID(params.portal.type);
            if(portal_type) {
                const y_diff = Math.abs(this.state.pos.y - portal_type);
                if(y_diff < CHUNK_SIZE_Y * 2) {
                    // @todo what can i do if player make portal to current level?
                }
                new_pos = new Vector(this.state.pos).flooredSelf();
                new_pos.y = portal_type.y;
                params.found_or_generate_portal = true;
                if(params.portal.from_portal_id) {
                    params.from_portal_id = params.portal.from_portal_id;
                }
            }
        }
        // If need to teleport
        if(new_pos) {
            if(Math.abs(new_pos.x) > MAX_COORD || Math.abs(new_pos.y) > MAX_COORD || Math.abs(new_pos.z) > MAX_COORD) {
                console.log('error_too_far');
                throw 'error_too_far';
            }
            teleported_player.wait_portal = new WorldPortalWait(
                teleported_player.state.pos.clone().addScalarSelf(0, this.height / 2, 0),
                new_pos,
                params
            );
            teleported_player.state.pos = new_pos;
            world.chunks.checkPlayerVisibleChunks(teleported_player, true);
        }
    }

}