import {Mth, ObjectHelpers, Vector} from "@client/helpers.js";
import {Player, PlayerHands, PlayerStateUpdate, PlayerSharedProps} from "@client/player.js";
import {GAME_MODE, GameMode} from "@client/game_mode.js";
import { ServerClient } from "@client/server_client.js";
import {Raycaster, RaycasterResult} from "@client/Raycaster.js";
import { PlayerEvent } from "./player_event.js";
import { QuestPlayer } from "./quest/player.js";
import { ServerPlayerInventory } from "./server_player_inventory.js";
import { ALLOW_NEGATIVE_Y, MAX_RENDER_DIST_IN_BLOCKS } from "@client/chunk_const.js";
import { MAX_PORTAL_SEARCH_DIST, PLAYER_MAX_DRAW_DISTANCE, PORTAL_USE_INTERVAL, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_STATUS, DEFAULT_RENDER_DISTANCE, PLAYER_SKIN_TYPES } from "@client/constant.js";
import { WorldPortal, WorldPortalWait } from "@client/portal.js";
import { ServerPlayerDamage } from "./player/damage.js";
import { ServerPlayerEffects } from "./player/effects.js";
import { Effect } from "@client/block_type/effect.js";
import { BuildingTemplate } from "@client/terrain_generator/cluster/building_template.js";
import { FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import { DBWorld, PlayerInitInfo } from "./db/world.js"
import {ServerPlayerVision} from "./server_player_vision.js";
import {compressNearby} from "@client/packet_compressor.js";
import { AABB } from "@client/core/AABB.js"
import type { EnumDamage } from "@client/enums/enum_damage.js";
import type { ServerWorld } from "./server_world.js";
import type { WorldTransactionUnderConstruction } from "./db/world/WorldDBActor.js";
import { SERVER_SEND_CMD_MAX_INTERVAL } from "./server_constant.js";
import {ServerPlayerControlManager} from "./control/server_player_control_manager.js";
import type {ServerDriving} from "./control/server_driving.js";
import { ServerPlayerCombat } from "player/combat.js";
import type {TChestSlots} from "@client/block_helpers.js";
import type {PrismarinePlayerState} from "@client/prismarine-physics/index.js";

export class NetworkMessage<DataT = any> implements INetworkMessage<DataT> {
    time?: number;
    name: int;      // a value of ServerClient.CMD_*** numeric constants
    data: DataT;
    constructor({
        time = Date.now(),
        name = -1,
        data = {}
    }) {
        this.time = time;
        this.name = name;
        this.data = data as DataT;
    }
}

type TeleportParams = {
    pos ?       : IVector
    place_id ?  : string
    safe ?      : boolean
    p2p ? : {
        from: string
        to: string
    }
    portal ? : { type, from_portal_id }
    found_or_generate_portal ? : boolean
    from_portal_id ?
}

const MAX_COORD                 = 2000000000;
const MAX_RANDOM_TELEPORT_COORD = 2000000;
const IMMUNITY_DAMAGE_TIME      = 3000 // 3 секунды

async function waitPing() {
    return new Promise((res) => setTimeout(res, EMULATED_PING));
}

// An adapter that allows using ServerPlayer and PlayerModel in the same way
class ServerPlayerSharedProps extends PlayerSharedProps {
    //@ts-expect-error
    declare p: ServerPlayer

    constructor(player: ServerPlayer) {
        //@ts-expect-error
        super(player)
    }

    get isAlive() : boolean { return this.p.live_level > 0; }
    get pos()     : Vector  { return this.p.state.pos; }
    get rotate()  : Vector  { return this.p.state.rotate; }
}

export class ServerPlayer extends Player {
    raycaster: Raycaster;
    quests: QuestPlayer;
    damage: ServerPlayerDamage;
    combat: ServerPlayerCombat
    wait_portal: WorldPortalWait | null;
    //@ts-expect-error
    declare world: ServerWorld
    declare effects: ServerPlayerEffects
    //@ts-expect-error
    declare inventory: ServerPlayerInventory;
    //@ts-expect-error
    declare controlManager: ServerPlayerControlManager
    private prev_world_data: Dict

    #forward : Vector;
    #_rotateDegree : Vector;
    vision: ServerPlayerVision;
    indicators_changed: boolean; // Unused. TODO: auto detect changes, delta compression
    chunk_addr: Vector;
    session_id: string;
    checkDropItemIndex: number;
    checkDropItemTempVec: Vector;
    dt_connect: Date;
    in_portal: boolean;
    prev_use_portal: number;        // time, performance.now()
    prev_near_players: Set<int>;    // set of user_ids
    ender_chest?: TChestSlots;
    dbDirtyFlags: int;
    netDirtyFlags: int;
    cast: { id: number; time: number; };
    mining_time_old: number;
    currentChests: IVector[] | null; // positions of chests opened by this player at this moment
    timer_reload: number;
    _aabb: AABB;
    live_level: number;
    food_level: number;
    oxygen_level: number;
    conn: any;
    savingPromise?: Promise<void>
    lastSentPacketTime = Infinity   // performance.now()
    _world_edit_copy: any
    // @ts-ignore
    declare driving: ServerDriving | null = null
    /** См. комментарий к аналогичному полю {@link Mob.drivingId} */
    drivingId: int | null = null
    #timer_immunity: number

    // These flags show what must be saved to DB
    static DB_DIRTY_FLAG_INVENTORY     = 0x1;
    static DB_DIRTY_FLAG_ENDER_CHEST   = 0x2;
    static DB_DIRTY_FLAG_QUESTS        = 0x4;
    static DB_DIRTY_FLAG_WORLD_DATA    = 0x8;

    // These flags show what must be sent to the client
    static NET_DIRTY_FLAG_RENDER_DISTANCE    = 0x1;

    constructor() {
        super();

        /**
         * Эти поля определены в {@link Player}, но не на сервере. На сервере к ним нельзя обращаться.
         * Сотрем их чтобы легче выявлять баги.
         */
        this.rotate = null
        this.pos = null

        this.indicators_changed     = true;
        this.chunk_addr             = new Vector(0, 0, 0);
        this._eye_pos               = new Vector(0, 0, 0);
        this.#_rotateDegree         = new Vector(0, 0, 0);
        this.#forward               = new Vector(0, 1, 0);

        this.session_id             = '';
        this.checkDropItemIndex     = 0;
        this.checkDropItemTempVec   = new Vector();
        this.dt_connect             = new Date();
        this.in_portal              = false;
        this.wait_portal            = null;
        this.prev_use_portal        = null; // время последнего использования портала
        this.prev_near_players      = new Set();
        this.ender_chest            = null; // if it's not null, it's cached from DB
        this.dbDirtyFlags           = 0;    // what must be saved to DB
        this.netDirtyFlags          = 0;    // what must be sent to the client

        // для проверки времени дейстия
        this.cast = {
            id: 0,
            time: 0
        };

        this.mining_time_old        = 0; // время последнего разрушения блока
        // null, or an array of POJO postitions of 1 or 2 chests that this player is currently working with
        this.currentChests          = null

        this.timer_reload = performance.now()
        this._aabb = new AABB()

        this.#timer_immunity = performance.now()
    }

    init(init_info: PlayerInitInfo): void {
        this.state = init_info.state;
        this.state.anim ||= false;
        this.state.sitting ||= false;
        this.state.sleep ||= false;
        this.state.attack ||= false
        this.state.fire ||= false
        this.live_level = this.state.indicators.live;
        this.food_level = this.state.indicators.food;
        this.oxygen_level = this.state.indicators.oxygen;
        this.inventory = new ServerPlayerInventory(this, init_info.inventory);
        this.status = init_info.status;
        this.drivingId = init_info.driving_id ?? null
        this.world_data = init_info.world_data;
        this.prev_world_data = ObjectHelpers.deepClone(this.world_data);
        // GameMode
        const game_mode = this.is_spectator_bot ? GAME_MODE.SPECTATOR : init_info.state.game_mode
        this.game_mode = new GameMode(this, game_mode);
        this.game_mode.onSelect = async (mode) => {
            this.cancelDriving()
            if (this.game_mode.isCreative()) {
                this.damage.restoreAll();
            }
            this.sendPackets([{name: ServerClient.CMD_GAMEMODE_SET, data: mode}]);
            this.controlManager.updateCurrentControlType(true);
            this.world.chat.sendSystemChatMessageToSelectedPlayers(`game_mode_changed_to|${mode.title}`, [this.session.user_id]);
            await this.world.db.changeGameMode(this, mode.id);
        };
        this.controlManager = new ServerPlayerControlManager(this as any)
        // Обычно это не нужно, устанавливается перед симуляцией. Но это частное решение нужно если player_state
        // используется до симуляции (например, при инициализации вождения)
        this.controlManager.current.player_state.yaw = this.state.rotate.z

        this.effects = new ServerPlayerEffects(this);
        this.combat = new ServerPlayerCombat(this)
    }

    get userId(): int { return this.session.user_id }

    /** Если игрок является участник вождения, прерывает вождение. Иначе - ничего не происходит. */
    cancelDriving(): void {
        this.driving?.removePlayerId(this.userId)
    }

    /** Closes the player's session after encountering an unrecoverable error. */
    terminate(error: any): void {
        if (this.conn) {
            console.log(`Player ${this.session.username} connection is closed due to ${error}`)
            this.conn.close(1000)
        }
    }

    /**
     * Checks if the world data changed. If it has, sends it to the player, and marks it dirty in DB.
     * We can't rey on mods always notifying the game of changes, so we have to check it automatically.
     * Call it every tick.
     */
    checkWorldDataChange(): void {
        if (!ObjectHelpers.deepEqualObject(this.world_data, this.prev_world_data)) {
            this.prev_world_data = ObjectHelpers.deepClone(this.world_data)
            this.dbDirtyFlags |= ServerPlayer.DB_DIRTY_FLAG_WORLD_DATA
            this.sendPackets([{name: ServerClient.CMD_PLAYER_WORLD_DATA, data: this.world_data}])
        }
    }

    _createSharedProps(): IPlayerSharedProps { return new ServerPlayerSharedProps(this); }

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

    async onJoin(session_id : string, skin_id : string, conn : any, world : ServerWorld) {

        if (EMULATED_PING) {
            console.log('Connect user with emulated ping:', EMULATED_PING);
        }

        // TODO: Maybe set the session here, and not in cmd_connect? (to avoid redundant select)
        const session = await Qubatch.db.GetPlayerSession(session_id);

        this.conn               = conn;
        this.world              = world;
        this.raycaster          = new Raycaster(world)
        this.vision             = new ServerPlayerVision(this)
        this.damage             = new ServerPlayerDamage(this)
        this.session_id         = session_id
        this.skin               = await Qubatch.db.skins.getUserSkin(session.user_id, skin_id)
        //
        conn.player = this;
        conn.on('message', this.onMessage.bind(this));
        //
        conn.on('close', async (e) => {
            this.world.onLeave(this)
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
            const ns = this.world.network_stat
            ns.in += message.length;
            ns.in_count++;
            const packet = JSON.parse(message);
            if (ns.in_count_by_type) {
                const name  = packet.name
                ns.in_count_by_type[name] = (ns.in_count_by_type[name] ?? 0) + 1
                if (ns.in_size_by_type) {
                    ns.in_size_by_type[name] = (ns.in_size_by_type[name] ?? 0) + message.length
                }
            }
            await this.world.packet_reader.read(this, packet);
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
        this.world.sendSelected(packets, this)
    }

    // onLeave...
    async onLeave() {
        if(!this.conn) {
            return false;
        }
        this.vision?.leave()
        // remove events handler
        PlayerEvent.removeHandler(this.session.user_id)
        // close previous connection
        this.conn.close(1000, 'error_multiconnection')
        delete(this.conn)
    }

    // Нанесение урона игроку
    setDamage(val : number, type_damage? : EnumDamage, actor?) {
        this.damage.addDamage(val, type_damage, actor);
    }

    /**
     * sendPackets
     */
    sendPackets(packets: INetworkMessage[]) {
        const ns = this.world.network_stat;
        this.lastSentPacketTime = performance.now()

        // time is the same for all commands, so it's saved once in the 1st of them
        if (packets.length) {
            packets[0].time = this.world.serverTime;
        }
        const json = JSON.stringify(packets)

        ns.out += json.length;
        ns.out_count++;
        if (ns.out_count_by_type && packets.length) {
            // check if we need to stringify individual packets to add their sizes to stats
            let hasDifferentTpes = false
            if (ns.out_size_by_type) {
                const name = packets[0].name
                for (let i = 1; i < packets.length; i++) {
                    if (packets[i].name !== name) {
                        hasDifferentTpes = true
                        break
                    }
                }
                if (!hasDifferentTpes) {
                    ns.out_size_by_type[name] = (ns.out_size_by_type[name] ?? 0) + json.length
                }
            }
            // for each packet
            for(const p of packets) {
                const name = p.name
                ns.out_count_by_type[name] = (ns.out_count_by_type[name] ?? 0) + 1

                if (ns.out_size_by_type && hasDifferentTpes) {
                    const len = JSON.stringify(p).length + 1
                    ns.out_size_by_type[name] = (ns.out_size_by_type[name] ?? 0) + len
                }
            }
        }

        if (!EMULATED_PING) {
            // it's possible that the connection was just closed (now it's null), but the game is still trying to send data
            this.conn?.send(json);
            return;
        }

        setTimeout(() => {
            this.conn?.send(json);
        }, EMULATED_PING);
    }

    // changePosSpawn...
    changePosSpawn(params) {
        params.pos = new Vector(params.pos).roundSelf(3)
        this.world.db.changePosSpawn(this, params);
        this.state.pos_spawn = new Vector(params.pos);
        const message = 'Установлена точка возрождения ' + params.pos.x + ", " + params.pos.y + ", " + params.pos.z;
        this.world.chat.sendSystemChatMessageToSelectedPlayers(message, [this.session.user_id]);
    }

    /**
     * Change render dist
     * 0(1chunk), 1(9), 2(25chunks), 3(45), 4(69), 5(109),
     * 6(145), 7(193), 8(249) 9(305) 10(373) 11(437) 12(517)
     */
    changeRenderDist(value : int) {
        if(Number.isNaN(value)) {
            value = DEFAULT_RENDER_DISTANCE;
        }
        // TODO: if server admin allow set big values
        const max_render_dist = Math.round(MAX_RENDER_DIST_IN_BLOCKS / this.world.chunkManager.grid.chunkSize.x)
        value = Mth.clamp(value, 2, max_render_dist)
        if (this.state.chunk_render_dist != value) {
            this.state.chunk_render_dist = value;
            this.netDirtyFlags |= ServerPlayer.NET_DIRTY_FLAG_RENDER_DISTANCE;
        }
        this.vision.preTick(true);
        this.world.db.changeRenderDist(this, value);
    }

    // Update hands material
    updateHands() {
        const inventory = this.inventory;
        if(!this.state.hands) {
            // it's ok to typecast here, because we set left and right below
            this.state.hands = {} as PlayerHands;
        }
        //
        const makeHand = (material) => {
            return {
                id: material ? material.id : null
            };
        };
        // Get materials
        const left_hand_material = inventory.current.index2 >= 0 ? inventory.items[inventory.current.index2] : null;
        const right_hand_material = inventory.items[inventory.current.index];
        this.state.hands.left = makeHand(left_hand_material);
        this.state.hands.right = makeHand(right_hand_material);
    }

    get rotateDegree() : Vector {
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

    raycastFromHead(): RaycasterResult | null {
        return this.raycaster.get(this.getEyePos(), this.forward, 100, null, false, false, this)
    }

    //
    exportStateUpdate(): PlayerStateUpdate {
        const state = this.state
        const control = this.controlManager.current.player_state
        const prismarine = control as PrismarinePlayerState
        return {
            id:       this.session.user_id,
            username: this.session.username,
            pos:      state.pos,
            rotate:   state.rotate,
            skin:     this.skin,
            hands:    state.hands,
            sneak:    state.sneak,
            sitting:  state.sitting,
            sleep:    state.sleep,
            anim:     state.anim,
            attack:   state.attack,
            fire:     state.fire,
            armor:    this.inventory.exportArmorState(),
            health:   state.indicators.live,
            ground:   control.onGround,
            submergedPercent: Mth.round(prismarine?.submergedPercent ?? 0, 2),
            running:  prismarine?.control?.sprint ?? false
        }
    }

    async preTick(delta, tick_number) {
        if(tick_number % 2 == 1) this.checkInPortal();
        // 5.
        await this.checkWaitPortal();
        if (this.status !== PLAYER_STATUS.WAITING_DATA) {
            this.vision.preTick(false);
        } else {
            this.checkWaitingData();
            if (this.status !== PLAYER_STATUS.WAITING_DATA) {
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
        if (this.status !== PLAYER_STATUS.WAITING_DATA) {
            this.vision.postTick();
        }
        this.checkVisibleChunks();
        this.sendNearPlayersToMe();
        this.controlManager.tick();
        this.checkIndicators(tick_number);
        this.combat.setDamage(tick_number)
        //this.damage.tick(delta, tick_number);
        this.checkCastTime();
        this.effects.checkEffects();
        //this.updateAABB()
        if (this.lastSentPacketTime < performance.now() - SERVER_SEND_CMD_MAX_INTERVAL) {
            this.sendPackets([{name: ServerClient.CMD_NOTHING, data: null}])
        }
        this.updateTimerAnim()
    }

    get isAlive() : boolean {
        return this.live_level > 0
    }

    /**
     */
    get aabb() : AABB {
        this._aabb.set(
            this.state.pos.x - PLAYER_WIDTH / 2,
            this.state.pos.y,
            this.state.pos.z - PLAYER_WIDTH / 2,
            this.state.pos.x + PLAYER_WIDTH / 2,
            this.state.pos.y + PLAYER_HEIGHT,
            this.state.pos.z + PLAYER_WIDTH / 2
        )
        return this._aabb
    }

    /**
     * Instantly teleports the player to the specified position without any checks.
     * (possibly finishes teleporting the player who was waiting for data or a portal)
     * After that, the player is ready to move.
     */
    sendTeleport(pos: Vector, place_id?: string): void {
        console.log(`${this.session.username} teleported to ${pos}`)

        const packets = [{
            name: ServerClient.CMD_TELEPORT,
            data: {
                pos: pos,
                place_id: place_id
            }
        }]
        this.world.packets_queue.add([this.session.user_id], packets)

        // stop waiting for teleportation
        this.wait_portal = null
        this.status = PLAYER_STATUS.ALIVE

        // update the position and controls
        this.state.pos = new Vector(pos)
        this.controlManager.startNewPhysicsSession(pos)

        // add teleport particles
        // const actions = new WorldAction(randomUUID());
        // actions.addParticles([{type: 'explosion', pos: wait_info.old_pos}]);
        // world.actions_queue.add(null, actions);
    }

    async checkWaitPortal() {
        if(!this.wait_portal) {
            return false;
        }
        //
        const wait_info = this.wait_portal;
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
                this.sendTeleport(wait_info.pos, wait_info.params.place_id);
            } else {
                // check max attempts
                //const max_attempts = [
                //    0, 0, 123, /* 2 */ 255, 455, /* 4 */ 711, 987, 1307, 1683, 2099,
                //    2567, /*10*/ 3031, 3607, 4203, 4843, 5523, 6203 /* 16 */][this.state.chunk_render_dist];
                //    // const force_teleport = ++wait_info.attempt == max_attempts;
                for(let chunk of this.world.chunks.getAround(wait_info.pos, this.state.chunk_render_dist)) {
                    if(chunk.isReady()) {
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
                            this.sendTeleport(wait_info.pos, wait_info.params.place_id);
                            break;
                        }
                    }
                }
            }
        } else {
            this.sendTeleport(wait_info.pos, wait_info.params.place_id);
        }
    }

    initWaitingDataForSpawn() {
        if (this.status !== PLAYER_STATUS.WAITING_DATA) {
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
        const initialUndergroundAllowed = initialPos.equal(this.state.pos_spawn); // can't use === here, it may be a clone with the same value
        const safePos = this.world.chunks.findSafePos(initialPos, this.vision.safeTeleportMargin, initialUndergroundAllowed);
        this.sendTeleport(safePos, 'spawn');
    }

    // Check player visible chunks
    checkVisibleChunks() {
        const {vision, world} = this;
        if (!vision.updateNearby() &&
            !(this.netDirtyFlags & ServerPlayer.NET_DIRTY_FLAG_RENDER_DISTANCE)
        ) {
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
        this.netDirtyFlags &= ~ServerPlayer.NET_DIRTY_FLAG_RENDER_DISTANCE;
        const packets = [{
            // c: Math.round((nearby_compressed.length / JSON.stringify(nearby).length * 100) * 100) / 100,
            name: ServerClient.CMD_NEARBY_CHUNKS,
            data: nearby_compressed
        }];
        world.sendSelected(packets, this);
    }

    // Send other players states for me
    sendNearPlayersToMe() {
        const chunk_over = this.world.chunks.get(this.chunk_addr);
        if(!chunk_over) {
            return;
        }
        //
        const packets = [];
        const current_visible_players = new Set<int>();
        for(const player of this.world.players.values()) {
            const user_id = player.session.user_id;
            if(this.session.user_id == user_id) {
                continue;
            }
            let dist = Math.floor(player.state.pos.distance(this.state.pos));
            if(dist < PLAYER_MAX_DRAW_DISTANCE) {
                current_visible_players.add(user_id);
            } else {
                if(!this.prev_near_players.has(user_id)) {
                    continue;
                }
                dist = null;
            }
            packets.push({
                name: ServerClient.CMD_PLAYER_STATE,
                data: {dist, ...player.exportStateUpdate()}
            })
        }
        this.prev_near_players = current_visible_players;
        if(packets.length > 0) {
            this.world.sendSelected(packets, this);
        }
    }

    // check indicators
    checkIndicators(tick) {

        if(this.status !== PLAYER_STATUS.ALIVE || !this.game_mode.mayGetDamaged()) {
            this.#timer_immunity = performance.now()
            return false
        }

        if (this.#timer_immunity + IMMUNITY_DAMAGE_TIME < performance.now()) {
            this.damage.getDamage(tick)
        }

        if (this.live_level == 0 || this.state.indicators.live != this.live_level || this.state.indicators.food != this.food_level || this.state.indicators.oxygen != this.oxygen_level ) {
            const packets = [];
            if (this.state.indicators.live > this.live_level) {
                // @todo добавить дергание
                packets.push({
                    name: ServerClient.CMD_PLAY_SOUND,
                    data: { tag: 'madcraft:block.player', action: 'hit', pos: this.state.pos}
                });
            }
            if(this.live_level == 0) {
                this.status = PLAYER_STATUS.DEAD;
                this.state.stats.death++;
                // @todo check and drop inventory items if need
                // const keep_inventory_on_dead = this.world.info.generator?.options?.keep_inventory_on_dead ?? true;
                packets.push({
                    name: ServerClient.CMD_DIE,
                    data: {}
                });
                this.driving?.removePlayerId(this.userId)
            }
            this.state.indicators.live = this.live_level;
            this.state.indicators.food = this.food_level;
            this.state.indicators.oxygen = this.oxygen_level;
            packets.push({
                name: ServerClient.CMD_ENTITY_INDICATORS,
                data: {
                    indicators: this.state.indicators
                }
            });

            this.world.sendSelected(packets, this);
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
    changePosition(pos: IVector, rotate?: IVector, sneak: boolean = false): void {
        if (!ALLOW_NEGATIVE_Y && pos.y < 0) {
            this.teleport({ place_id: 'spawn' })
            return;
        }
        this.state.pos = new Vector(pos);
        if (rotate) {
            this.state.rotate = new Vector(rotate);
        }
        this.state.sneak = sneak;
    }

    /**
     * Teleport
     */
    teleport(params: TeleportParams): void {
        this.cancelDriving()
        if (this.state.sitting || this.state.sleep) {
            this.standUp()
        }
        this.#timer_immunity = performance.now()
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
            for(const player of world.players.values()) {
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
                const y_diff = Math.abs(this.state.pos.y - portal_type.y);
                if(y_diff < this.world.chunkManager.grid.chunkSize.y * 2) {
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
                this.status = PLAYER_STATUS.WAITING_DATA;
                this.sendPackets([{name: ServerClient.CMD_SET_STATUS_WAITING_DATA, data: {}}]);
                this.vision.teleportSafePos(new_pos);
            } else {
                teleported_player.wait_portal = new WorldPortalWait(
                    world.chunkManager.grid,
                    teleported_player.state.pos.clone().addScalarSelf(0, this.height / 2, 0),
                    new_pos,
                    params
                );
                teleported_player.setPosition(new_pos);
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
                    const block = this.world.block_manager.fromId(this.cast.id);
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
        this.dbDirtyFlags |= ServerPlayer.DB_DIRTY_FLAG_ENDER_CHEST;
    }

    /**
     * Загружает и кеширует ender chest, если это еще не сделано.
     * @returns кешированный ender chest.
     */
    async loadEnderChest(): Promise<TChestSlots> {
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
        const bm = world.block_manager
        const world_block = world.getBlock(new Vector(data.pos));
        if (!world_block) {
            return false;
        }
        const block = bm.fromId(world_block.id)
        if(block.is_dummy) {
            return false
        }
        const head = world.getBlock(this.getEyePos());
        if (!head) {
            return false;
        }
        const instrument = bm.fromId(this?.currentInventoryItem?.id);
        const is_water = (head.id == 0 && (head.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID)
        const mul = this.getMulSpeedDestroy(is_water)
        const mining_time_server = block.material.getMiningTime({material: instrument}, false) / mul
        const mining_time_client = performance.now() - this.mining_time_old
        this.mining_time_old = performance.now()
        this.addExhaustion(.005)
        if ((mining_time_client - mining_time_server * 1000) >= -50) {
            this.state.stats.pickat++;
            return true;
        }
        console.log('error mining: server: ' + mining_time_client + ' client: ' + mining_time_server * 1000);
        return false;
    }

    /**
     * использование предметов и оружия или езда верхом
     * См. также {@link Player.onInteractEntityClient}
     */
    onUseItemOnEntity(pickatEvent: IPickatEvent): void {
        const world = this.world
        const itemId = this.state.hands.right.id
        const item = itemId && world.block_manager.fromId(itemId)
        if (pickatEvent.interactMobID != null) {
            const mob = world.mobs.get(pickatEvent.interactMobID)
            if (!mob) {
                return
            }
            if (mob.config.hasUse || item?.tags?.includes('use_on_mob')) {
                // если этот инструмент можно использовать на мобе, то уменьшаем прочнось
                if (mob.setUseItem(itemId, this)) {
                    if (item?.power) {
                        this.inventory.decrement_instrument()
                    } else {
                        this.inventory.decrement()
                    }
                }
            } else { // попробовать присоединиться к вождению
                world.drivingManager.tryJoinDriving(this, mob)
            }
        }
    }

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction) {
        // always save the player state, as it was in the old code
        const row = DBWorld.toPlayerUpdateRow(this);
        underConstruction.updatePlayerState.push(row);

        if (this.dbDirtyFlags & ServerPlayer.DB_DIRTY_FLAG_INVENTORY) {
            this.inventory.writeToWorldTransaction(underConstruction);
        }
        if (this.dbDirtyFlags & ServerPlayer.DB_DIRTY_FLAG_ENDER_CHEST) {
            underConstruction.promises.push(
                this.world.db.saveEnderChest(this, this.ender_chest)
            );
        }
        if (this.dbDirtyFlags & ServerPlayer.DB_DIRTY_FLAG_QUESTS) {
            this.quests.writeToWorldTransaction(underConstruction);
        }
        if (this.dbDirtyFlags & ServerPlayer.DB_DIRTY_FLAG_WORLD_DATA) {
            underConstruction.updatePlayerWorldData.push([
                this.session.user_id,
                JSON.stringify(this.world_data)
            ])
        }
        this.dbDirtyFlags = 0;
    }

    isAdmin() : boolean {
        return this.world.admins.checkIsAdmin(this)
    }

    setAnimation(animation_name : string, speed : float = 1, time : float = 1) {
        this.state.anim = {
            title: animation_name,
            speed
        }
        this.timer_anim = performance.now() + (time * 1000) / speed
    }

    standUp(): void {
        this.state.sitting = false
        this.state.sleep = false
        this.sendPackets([
            {
                name: ServerClient.CMD_PLAY_SOUND,
                data: {tag: 'madcraft:block.cloth', action: 'hit'}
            },
            {
                name: ServerClient.CMD_STANDUP_STRAIGHT,
                data: null
            }
        ])
    }

    /*
    * Проверка завершения анимации
    */
    updateTimerAnim() {
        if (this.timer_anim <= performance.now()) {
            this.state.anim = false
        }
    }

}