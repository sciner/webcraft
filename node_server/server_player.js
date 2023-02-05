import { Vector } from "../www/js/helpers.js";
import { Player } from "../www/js/player.js";
import { GameMode } from "../www/js/game_mode.js";
import { ServerClient } from "../www/js/server_client.js";
import { Raycaster, RaycasterResult } from "../www/js/Raycaster.js";
import { ServerWorld } from "./server_world.js";
import { PlayerEvent } from "./player_event.js";
import { QuestPlayer } from "./quest/player.js";
import { ServerPlayerInventory } from "./server_player_inventory.js";
import { ALLOW_NEGATIVE_Y, CHUNK_SIZE_Y } from "../www/js/chunk_const.js";
import { MAX_PORTAL_SEARCH_DIST, PLAYER_MAX_DRAW_DISTANCE, PORTAL_USE_INTERVAL, MOUSE, PLAYER_STATUS_DEAD, PLAYER_STATUS_WAITING_DATA, PLAYER_STATUS_ALIVE } from "../www/js/constant.js";
import { WorldPortal, WorldPortalWait } from "../www/js/portal.js";
import { ServerPlayerDamage } from "./player/damage.js";
import { BLOCK } from "../www/js/blocks.js";
import { ServerPlayerEffects } from "./player/effects.js";
import { Effect } from "../www/js/block_type/effect.js";
import { BuildingTemplate } from "../www/js/terrain_generator/cluster/building_template.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../www/js/fluid/FluidConst.js";
import { DBWorld } from "./db/world.js"
import {ServerPlayerVision} from "./server_player_vision.js";
import {compressNearby, NEARBY_FLAGS} from "../www/js/packet_compressor.js";
import {WorldChunkFlags} from "./db/world/WorldChunkFlags.js";

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

const MAX_COORD                 = 2000000000;
const MAX_RANDOM_TELEPORT_COORD = 2000000;

async function waitPing() {
    return new Promise((res) => setTimeout(res, EMULATED_PING));
}

// An adapter that allows using ServerPlayer and PlayerModel in the same way
class ServerPlayerSharedProps {
    constructor(player) {
        this.p = player;
    }

    get isAlive()   { return this.p.live_level > 0; }
    get user_id()   { return this.p.session.user_id; }
    get pos()       { return this.p.state.pos; }
    get sitting()   { return this.p.state.sitting; }
}

export class ServerPlayer extends Player {

    static DIRTY_FLAG_INVENTORY     = 0x1;
    static DIRTY_FLAG_ENDER_CHEST   = 0x2;
    static DIRTY_FLAG_QUESTS        = 0x4;

    #forward;
    #_rotateDegree;

    constructor() {
        super();
        this.indicators_changed     = true;
        this.position_changed       = false;
        this.chunk_addr             = new Vector(0, 0, 0);
        this._eye_pos               = new Vector(0, 0, 0);
        this.#_rotateDegree         = new Vector(0, 0, 0);
        this.#forward               = new Vector(0, 1, 0);

        /**
         * @type {ServerWorld}
         */
        this.world;
        this.session_id             = '';
        this.skin                   = '';
        this.checkDropItemIndex     = 0;
        this.checkDropItemTempVec   = new Vector();
        this.dt_connect             = new Date();
        this.in_portal              = false;
        this.wait_portal            = null;
        this.prev_use_portal        = null; // время последнего использования портала
        this.prev_near_players      = new Map();
        this.ender_chest            = null; // if it's not null, it's cached from DB
        this.dirtyFlags             = 0;

        // для проверки времени дейстия
        this.cast = {
            id: 0,
            time: 0
        };
        this.vision                 = new ServerPlayerVision(this);
        this.effects                = new ServerPlayerEffects(this);
        this.damage                 = new ServerPlayerDamage(this);
        this.mining_time_old        = 0; // время последнего разрушения блока
        // null, or an array of POJO postitions of 1 or 2 chests that this player is currently working with
        this.currentChests          = null;

        this.sharedProps = new ServerPlayerSharedProps(this);

        this.timer_reload = performance.now();
    }

    init(init_info) {
        this.state = init_info.state;
        this.state.lies = this.state?.lies || false;
        this.state.sitting = this.state?.sitting || false;
        this.live_level = this.state.indicators.live.value;
        this.food_level = this.state.indicators.food.value;
        this.oxygen_level = this.state.indicators.oxygen.value;
        this.inventory = new ServerPlayerInventory(this, init_info.inventory);
        this.status = init_info.status;
        // GameMode
        this.game_mode = new GameMode(this, init_info.state.game_mode);
        this.game_mode.onSelect = async (mode) => {
            if (this.game_mode.isCreative()) {
                this.damage.restoreAll();
            }
            await this.world.db.changeGameMode(this, mode.id);
            this.sendPackets([{name: ServerClient.CMD_GAMEMODE_SET, data: mode}]);
            this.world.chat.sendSystemChatMessageToSelectedPlayers(`game_mode_changed_to|${mode.title}`, [this.session.user_id]);
        };
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
    async onJoin(session_id, skin_id, conn, world) {

        if (EMULATED_PING) {
            console.log('Connect user with emulated ping:', EMULATED_PING);
        }

        // TODO: Maybe set the session here, and not in cmd_connect? (to avoid redundant select)
        const session = await Qubatch.db.GetPlayerSession(session_id);

        this.conn               = conn;
        this.world              = world;
        this.raycaster          = new Raycaster(world);
        this.session_id         = session_id;
        this.skin               = await Qubatch.db.skins.getUserSkin(session.user_id, skin_id);
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

        //
        this.sendPackets([{
            name: ServerClient.CMD_BUILDING_SCHEMA_ADD,
            data: {
                list: Array.from(BuildingTemplate.schemas.values())
            }
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
        try {
            this.world.network_stat.in += message.length;
            this.world.network_stat.in_count++;
            const packet = JSON.parse(message);
            this.world.packet_reader.read(this, packet);
        } catch(e) {
            this.sendError('error_invalid_command');
        }
    }

    sendError(message) {
        const packets = [{
            name: ServerClient.CMD_ERROR,
            data: {
                message
            }
        }]
        this.world.sendSelected(packets, [this.session.user_id], [])
    }

    // onLeave...
    async onLeave() {
        if(!this.conn) {
            return false;
        }
        this.vision.leave();
        // remove events handler
        PlayerEvent.removeHandler(this.session.user_id);
        // close previous connection
        this.conn.close(1000, 'error_multiconnection');
        delete(this.conn);
    }

    // Нанесение урона игроку
    setDamage(val, src) {
        this.damage.addDamage(val, src);
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
        params.pos = new Vector(params.pos).round(3);
        this.world.db.changePosSpawn(this, params);
        this.state.pos_spawn = new Vector(params.pos);
        let message = 'Установлена точка возрождения ' + params.pos.x + ", " + params.pos.y + ", " + params.pos.z;
        this.world.chat.sendSystemChatMessageToSelectedPlayers(message, [this.session.user_id]);
    }

    /**
     * Change render dist
     * 0(1chunk), 1(9), 2(25chunks), 3(45), 4(69), 5(109),
     * 6(145), 7(193), 8(249) 9(305) 10(373) 11(437) 12(517)
     * @param {int} value
     */
    changeRenderDist(value) {
        if(Number.isNaN(value)) {
            value = 4;
        }
        value = Math.max(value, 2);
        value = Math.min(value, 16);
        this.state.chunk_render_dist = value;
        this.vision.preTick(true);
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
            lies:     this.state.lies,
            armor:    this.inventory.exportArmorState(),
            health:   this.state.indicators.live.value
        };
    }

    async preTick(delta, tick_number) {
        if(tick_number % 2 == 1) this.checkInPortal();
        // 5.
        await this.checkWaitPortal();
        if (this.status !== PLAYER_STATUS_WAITING_DATA) {
            this.vision.preTick(false);
        } else {
            this.checkWaitingData();
            if (this.status !== PLAYER_STATUS_WAITING_DATA) {
                this.claimChunks();
            }
        }
    }

    claimChunks() {
        this.vision.preTick(true);
        this.vision.postTick();
        this.checkVisibleChunks();
    }

    postTick(delta, tick_number) {
        if (this.status !== PLAYER_STATUS_WAITING_DATA) {
            this.vision.postTick();
        }
        this.checkVisibleChunks();
        this.sendNearPlayers();
        this.checkIndicators(tick_number);
        //this.damage.tick(delta, tick_number);
        this.checkCastTime();
        this.effects.checkEffects();
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
            // actions.addParticles([{type: 'explosion', pos: wait_info.old_pos}]);
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
                    if(chunk.isReady()) {
                        const new_portal = this.world.portals.foundPortalFloorAndBuild(this.session.user_id, chunk, from_portal_type);
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

    initWaitingDataForSpawn() {
        if (this.status !== PLAYER_STATUS_WAITING_DATA) {
            return;
        }
        this.vision.initSpawn();
    }

    checkWaitingData() {
        // check if there are any chunks not generated; remove generated chunks from the list
        if (this.vision.checkWaitingState() > 0) {
            return;
        }
            // teleport
        let initialPos = this.vision.safePosInitialOverride || this.state.pos_spawn;
        this.vision.safePosInitialOverride = null;
        this.state.pos = this.world.chunks.findSafePos(initialPos, this.vision.safeTeleportMargin);

        // change status
        this.status = PLAYER_STATUS_ALIVE;
        // send changes
        const packets = [{
            name: ServerClient.CMD_TELEPORT,
            data: {
                pos: this.state.pos,
                place_id: 'spawn'
            }
        }, {
            name: ServerClient.CMD_SET_STATUS_ALIVE,
            data: {}
        }];
        this.world.packets_queue.add([this.session.user_id], packets);
    }

    // Check player visible chunks
    checkVisibleChunks() {
        const {vision, world} = this;
        if (!vision.updateNearby()) {
            return;
        }
        const nc = vision.nearbyChunks;
        const nearby = {
            chunk_render_dist: nc.chunk_render_dist,
            added: nc.added,
            deleted: nc.deleted,
        }

        const nearby_compressed = compressNearby(nearby);
        vision.nearbyChunks.markClean();
        const packets = [{
            // c: Math.round((nearby_compressed.length / JSON.stringify(nearby).length * 100) * 100) / 100,
            name: ServerClient.CMD_NEARBY_CHUNKS,
            data: nearby_compressed
        }];
        world.sendSelected(packets, [this.session.user_id], []);
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
        for(const [_, player] of this.world.players.all()) {
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

    // check indicators
    checkIndicators(tick) {

        if(this.status !== PLAYER_STATUS_ALIVE || !this.game_mode.mayGetDamaged()) {
            return false;
        }

        this.damage.getDamage(tick);

        if (this.live_level == 0 || this.state.indicators.live.value != this.live_level || this.state.indicators.food.value != this.food_level || this.state.indicators.oxygen.value != this.oxygen_level ) {
            const packets = [];
            if (this.state.indicators.live.value > this.live_level) {
                // @todo добавить дергание
                packets.push({
                    name: ServerClient.CMD_PLAY_SOUND,
                    data: { tag: 'madcraft:block.player', action: 'hit', pos: this.state.pos}
                });
            }
            if(this.live_level == 0) {
                this.status = PLAYER_STATUS_DEAD;
                this.state.stats.death++;
                // @todo check and drop inventory items if need
                // const keep_inventory_on_dead = this.world.info.generator?.options?.keep_inventory_on_dead ?? true;
                packets.push({
                    name: ServerClient.CMD_DIE,
                    data: {}
                });
            }
            this.state.indicators.live.value = this.live_level;
            this.state.indicators.food.value = this.food_level;
            this.state.indicators.oxygen.value = this.oxygen_level;
            packets.push({
                name: ServerClient.CMD_ENTITY_INDICATORS,
                data: {
                    indicators: this.state.indicators
                }
            });

            this.world.sendSelected(packets, [this.session.user_id], []);
            // @todo notify all about change?
        }
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
        const portal_block  = tblock_legs?.material?.is_portal ? tblock_legs : null;
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
            for(const [_, player] of world.players.all()) {
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
                    new_pos = new Vector(this.state.pos_spawn)
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
            new_pos = new Vector(new_pos)
            if(Math.abs(new_pos.x) > MAX_COORD || Math.abs(new_pos.y) > MAX_COORD || Math.abs(new_pos.z) > MAX_COORD) {
                console.log('error_too_far');
                throw 'error_too_far';
            }
            if (params.safe) {
                this.status = PLAYER_STATUS_WAITING_DATA;
                this.sendPackets([{name: ServerClient.CMD_SET_STATUS_WAITING_DATA, data: {}}]);
                this.vision.teleportSafePos(new_pos);
            } else {
                teleported_player.wait_portal = new WorldPortalWait(
                    teleported_player.state.pos.clone().addScalarSelf(0, this.height / 2, 0),
                    new_pos,
                    params
                );
                teleported_player.state.pos = new_pos;
                teleported_player.vision.checkSpiralChunks();
            }
        }
    }

    // проверка использования item
    checkCastTime() {
        if (this.cast.time > 0) {
            this.cast.time--;
            if (this.cast.time == 0) {
                const item = this.inventory.items[this.inventory.current.index];
                if (item.id == this.cast.id) {
                    // если предмет это еда
                    const block = BLOCK.fromId(this.cast.id);
                    if (block.food) {
                        this.setFoodLevel(block.food.amount, block.food.saturation);
                    }
                    // если у предмета есть еффекты
                    if (block.effects) {
                        this.effects.addEffects(block.effects);
                    }
                    this.inventory.decrement();
                }
            }
        }
    }

    /*
    * установка истощения
    * exhaustion - уровень истощения
    */
    addExhaustion(exhaustion) {
        this.damage.addExhaustion(exhaustion);
    }

    /*
    * установка сытости и насыщения
    * food - уровень еды
    * saturation - уровень насыщения
    */
    setFoodLevel(food, saturation) {
        this.damage.setFoodLevel(food, saturation);
    }

    // Marks that the ender chest content needs to be saved in the next world transaction
    setEnderChest(ender_chest) {
        this.ender_chest = ender_chest
        this.dirtyFlags |= ServerPlayer.DIRTY_FLAG_ENDER_CHEST;
    }

    /**
     * Return ender chest content
     * @returns
     */
    async loadEnderChest() {
        if (!this.ender_chest) {
            const loaded = await this.world.db.loadEnderChest(this);
            // If loading is called multiple times before it completes, ensure that the cahced value isn't replaced
            this.ender_chest = this.ender_chest ?? loaded;
        }
        return this.ender_chest;
    }

    /**
     * Сравнивает время разрушение блока на строне клиента и сервера. при совпадении возвращает true
     * @returns bool
     */
    isMiningComplete(data) {
        if (!data.destroyBlock || this.game_mode.isCreative()) {
            return true;
        }
        const world = this.world;
        const world_block = world.getBlock(new Vector(data.pos));
        if (!world_block) {
            return false;
        }
        const block = BLOCK.fromId(world_block.id);
        if (!block) {
            return false;
        }
        const head = world.getBlock(this.getEyePos());
        if (!head) {
            return false;
        }
        const instrument = BLOCK.fromId(this.state.hands.right.id);
        let mul = world.getGeneratorOptions('tool_mining_speed', 1);
        mul *= (head.id == 0 && (head.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) ? 0.2 : 1;
        mul += mul * 0.2 * this.effects.getEffectLevel(Effect.HASTE); // Ускоренная разбивка блоков
        mul -= mul * 0.2 * this.effects.getEffectLevel(Effect.MINING_FATIGUE); // усталость
        const mining_time_server = block.material.getMiningTime({material: instrument}, false) / mul;
        const mining_time_client = performance.now() - this.mining_time_old;
        this.mining_time_old = performance.now();
        this.addExhaustion(0.005);
        if ((mining_time_client - mining_time_server * 1000) >= -50) {
            this.state.stats.pickat++;
            return true;
        }
        console.log('error mining: server: ' + mining_time_client + ' client: ' + mining_time_server * 1000);
        return false;
    }

    // использование предметов и оружия
    onAttackEntity(button_id, mob_id, player_id) {
        const item = BLOCK.fromId(this.state.hands.right.id);
        const damage = item?.damage ? item.damage : 1;
        const delay = item?.speed ? 200 / item.speed : 200;
        const time = performance.now() - this.timer_reload;
        this.timer_reload = performance.now();
        // проверяем время последнего клика
        if (time > delay) {
            const world = this.world;
            // использование предметов
            if (button_id == MOUSE.BUTTON_RIGHT) {
                if (mob_id) {
                    const mob = world.mobs.get(mob_id);
                    // если этот инструмент можно использовать на мобе, то уменьшаем прочнось
                    if (mob.setUseItem(this.state.hands.right.id, this)) {
                        if (item?.power) {
                            this.inventory.decrement_instrument();
                        } else {
                            this.inventory.decrement();
                        }
                    }
                }
            }
            // удары
            if (button_id == MOUSE.BUTTON_LEFT) {
                if (player_id && world.rules.getValue('pvp')) {
                    // наносим урон по игроку
                    const player = world.players.get(player_id);
                    player.setDamage(damage);
                    // уменьшаем прочнось
                    if (item?.power) {
                        this.inventory.decrement_instrument();
                    }
                }
                if (mob_id) {
                    // наносим урон по мобу
                    const mob = world.mobs.get(mob_id);
                    mob.setDamage(damage, null, this);
                    // уменьшаем прочнось
                    if (item?.power) {
                        this.inventory.decrement_instrument();
                    }
                }
            }
        }
    }

    writeToWorldTransaction(underConstruction) {
        // always save the player state, as it was in the old code
        const row = DBWorld.toPlayerUpdateRow(this);
        underConstruction.updatePlayerState.push(row);

        if (this.dirtyFlags & ServerPlayer.DIRTY_FLAG_INVENTORY) {
            this.inventory.writeToWorldTransaction(underConstruction);
        }
        if (this.dirtyFlags & ServerPlayer.DIRTY_FLAG_ENDER_CHEST) {
            underConstruction.promises.push(
                this.world.db.saveEnderChest(this, this.ender_chest)
            );
        }
        if (this.dirtyFlags & ServerPlayer.DIRTY_FLAG_QUESTS) {
            this.quests.writeToWorldTransaction(underConstruction);
        }
        this.dirtyFlags = 0;
    }

}