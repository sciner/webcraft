import {Helpers, Vector, ObjectHelpers} from "./helpers.js";
import {ServerClient} from "./server_client.js";
import {ICmdPickatData, PickAt} from "./pickat.js";
import {Instrument_Hand} from "./instrument/hand.js";
import {BLOCK} from "./blocks.js";
import {PLAYER_DIAMETER, DEFAULT_SOUND_MAX_DIST, PLAYER_STATUS } from "./constant.js";
import {ClientPlayerControlManager} from "./control/player_control_manager.js";
import {PlayerControl, PlayerControls} from "./control/player_control.js";
import {PlayerInventory} from "./player_inventory.js";
import { PlayerWindowManager } from "./player_window_manager.js";
import {Chat} from "./chat.js";
import {GameMode, GAME_MODE} from "./game_mode.js";
import {ActionPlayerInfo, doBlockAction, WorldAction} from "./world_action.js";
import { BODY_ROTATE_SPEED, MOB_EYE_HEIGHT_PERCENT, MOUSE, PLAYER_HEIGHT, PLAYER_ZOOM, RENDER_DEFAULT_ARM_HIT_PERIOD, RENDER_EAT_FOOD_DURATION } from "./constant.js";
import { HumanoidArm, InteractionHand } from "./ui/inhand_overlay.js";
import { Effect } from "./block_type/effect.js";
import { PACKED_CELL_LENGTH, PACKET_CELL_BIOME_ID } from "./fluid/FluidConst.js";
import { PlayerArm } from "./player_arm.js";
import type { Renderer } from "./render.js";
import type { World } from "./world.js";
import type { PLAYER_SKIN_TYPES } from "./constant.js"
import type {ClientDriving} from "./control/driving.js";
import type {PlayerModel} from "./player_model.js";

const PREV_ACTION_MIN_ELAPSED           = .2 * 1000;
const CONTINOUS_BLOCK_DESTROY_MIN_TIME  = .2; // минимальное время (мс) между разрушениями блоков без отжимания кнопки разрушения
const SNEAK_HEIGHT                      = .78; // in percent
const SNEAK_CHANGE_PERIOD               = 150; // in msec
const MOVING_MIN_BLOCKS_PER_SECOND      = 0.1; // the minimum actual speed at which moving animation is played

const ATTACK_PROCESS_NONE = 0;
const ATTACK_PROCESS_ONGOING = 1;
const ATTACK_PROCESS_FINISHED = 2;

export type Indicators = {
    live: number
    food: number
    oxygen: number
}

export type Effects = {
    id: number
    time: number
    level: number
}

export type PlayerStats = {
    death: int
    time: number
    pickat: number
    distance: number
}

export type PlayerSkin = {
    /** Skin id in the DB */
    id: int
    /** One of {@link PLAYER_SKIN_TYPES} */
    type: int
    file: string
}

type PlayerHand = {
    id: int | null
}

export type PlayerHands = {
    left    : PlayerHand
    right   : PlayerHand
}

export type ArmorState = {
    head ? : int
    body ? : int
    leg  ? : int
    boot ? : int
}

export type TSleepState = {
    pos: IVector
    rotate: IVector // possible values for rotate.z: 0, 0.25, 0.5, 0.75
}

export type TSittingState = {
    pos: IVector
    rotate: IVector // rotate.z is in radians
}

export type TAnimState = {
    title: string,
    speed: number
}

/** A part of {@link PlayerState} that is also sent in {@link PlayerStateUpdate} */
type PlayerStateDynamicPart = {
    pos         : Vector
    rotate      : Vector
    lies ?      : boolean
    sitting ?   : false | TSittingState
    sneak ?     : boolean
    sleep ?     : false | TSleepState
    hands       : PlayerHands,
    anim?       : false | TAnimState
}

/** Fields that are saved together into DB in user.state field. */
export type PlayerState = PlayerStateDynamicPart & {
    pos_spawn           : Vector
    indicators          : Indicators
    chunk_render_dist   : int
    game_mode ?         : string
    stats               : PlayerStats
    effects             : Effects[]
}

export type PlayerStateUpdate = PlayerStateDynamicPart & {
    id          : number
    username    : string
    armor       : ArmorState
    health      : number
    skin        : PlayerSkin
    /** it's never set. It's just checked, and if it's not defined, 'player' type is used. */
    type ?
    dist ?      : number // null means that the player is too far, and it stopped receiving updates
    ground      : boolean
    running     : boolean
}

export type PlayerConnectData = {
    session     : PlayerSession
    state       : PlayerState
    skin        : PlayerSkin
    status      : PLAYER_STATUS
    inventory : {
        current
        items
    },
    world_data  : Dict
}

export class PlayerSharedProps implements IPlayerSharedProps {
    p: Player

    constructor(player: Player) {
        this.p = player;
    }

    get isAlive() : boolean { return this.p.state.indicators.live != 0; }
    get user_id() : int     { return this.p.session.user_id; }
    get pos()     : Vector  { return this.p.pos; }
    get rotate()  : Vector  { return this.p.rotate; }
    get sitting() : boolean { return !!this.p.state.sitting; }
    get sleep()   : boolean { return !!this.p.state.sleep; }
}

// Creates a new local player manager.
export class Player implements IPlayer {

    sharedProps :               IPlayerSharedProps;
    chat :                      Chat
    render:                     Renderer;
    world:                      World
    options:                    any;
    game_mode:                  GameMode;
    inventory:                  PlayerInventory;
    controls:                   PlayerControls;
    windows:                    PlayerWindowManager;
    pickAt:                     PickAt;
    arm:                        PlayerArm;
    session:                    PlayerSession;
    skin:                       PlayerSkin;
    #forward:                   Vector = new Vector(0, 0, 0);
    inAttackProcess:            number;
    scale:                      number = PLAYER_ZOOM;
    effects:                    any;
    status:                     PLAYER_STATUS;
    controlManager:             ClientPlayerControlManager

    /** The position slightly in the future, at the end of the physics simulation tick */
    pos:                        Vector;
    /** The position interpolated between {@link pos} and the position at the end of the previos physics tick */
    lerpPos:                    Vector;
    /** It's used only inside {@link update} to remember the previous value of {@link lerpPos} */
    posO:                       Vector = new Vector(0, 0, 0);
    _block_pos:                 Vector = new Vector(0, 0, 0);
    _eye_pos:                   Vector = new Vector(0, 0, 0);
    blockPos:                   any;
    blockPosO:                  any;
    chunkAddr:                  Vector;
    rotate:                     Vector = new Vector(0, 0, 0)
    #_rotateDegree:             Vector = new Vector(0, 0, 0)

    //
    inMiningProcess:            boolean = false;
    inItemUseProcess:           boolean = false;
    falling:                    boolean = false; // падает
    running:                    boolean = false; // бежит
    moving:                     boolean = false; // двигается в стороны
    walking:                    boolean = false; // идёт по земле
    in_water:                   boolean = false; // ноги в воде
    in_water_o:                 boolean = false;
    onGround:                   boolean = false;
    onGroundO:                  boolean = false;
    sneak:                      boolean;

    //
    headBlock:                  any = null;
    state:                      PlayerState;
    /**
     * A general-purpose persistent data field.
     * A server checks if it's modified one per tick. If a change is detected, it's
     * sent to the client, and marked to be saved to the DB in the next transaction.
     */
    world_data:                 Dict
    indicators:                 Indicators;
    lastBlockPos:               any;
    xBob:                       any;
    yBob:                       any
    _height:                    number;
    eyes_in_block:              any = null; // глаза в воде
    eyes_in_block_o:            any = null; // глаза в воде (предыдущее значение)
    walking_frame:              number = 0;
    zoom:                       boolean = false;
    walkDist:                   number;
    swimingDist:                number;
    walkDistO:                  number;
    bob:                        number;
    oBob:                       number;
    step_count:                 number;
    _prevActionTime:            number;
    body_rotate:                number;
    body_rotate_o:              number;
    body_rotate_speed:          number;
    mineTime:                   number;
    timer_attack:               number;
    inhand_animation_duration:  number;
    pn_start_change_sneak:      number;
    _sneak_period:              number;
    _height_diff:               number;
    _height_before_change:      any;
    steps_count:                any;
    hitIndexO:                  any;
    lastOnGroundTime:           any;
    lastUpdate:                 number;
    yBobO:                      any;
    xBobO:                      any;
    isOnLadder:                 any;
    prev_walking:               any;
    block_walking_ticks:        number;
    swimingDistIntPrev:         any;
    swimingDistIntPrevO:        any;
    underwater_track_id:        any;
    _eating_sound_tick:         number;
    _eating_sound:              any;
    driving?:                   ClientDriving | null
    timer_anim:                number = 0

    constructor(options : any = {}, render? : Renderer) {
        this.render = render
        this.inAttackProcess = ATTACK_PROCESS_NONE;
        this.options = options;
        this.effects = {effects:[]}
        this.status = PLAYER_STATUS.WAITING_DATA;
        this.sharedProps = this._createSharedProps();
    }

    /** A protected factory method that creates {@link IPlayerSharedProps} of the appropriate type */
    _createSharedProps(): IPlayerSharedProps { return new PlayerSharedProps(this); }

    // возвращает уровень эффекта
    getEffectLevel(val) {
        for (const effect of this.effects.effects) {
            if (effect.id == val) {
                return effect.level;
            }
        }
        return 0;
    }

    JoinToWorld(world : World, cb : any) {
        this.world = world;
        //
        this.world.server.AddCmdListener([ServerClient.CMD_CONNECTED], (cmd) => {
            cb(this.playerConnectedToWorld(cmd.data), cmd);
        });
        //
        this.world.server.Send({name: ServerClient.CMD_CONNECT, data: {world_guid: world.info.guid}});
    }

    // playerConnectedToWorld...
    playerConnectedToWorld(data: PlayerConnectData) {
        //
        this.session                = data.session;
        this.state                  = data.state;
        this.status                 = data.status;
        this.indicators             = data.state.indicators;
        this.skin                   = data.skin;
        this.world_data             = data.world_data;
        // Game mode
        this.game_mode              = new GameMode(this, data.state.game_mode);
        this.game_mode.onSelect     = (mode) => {
            this.controlManager.updateCurrentControlType(false)
            if(!mode.can_fly) {
                this.lastBlockPos = this.getBlockPos().clone();
                this.setFlying(false);
            } else if(mode.id == GAME_MODE.SPECTATOR) {
                this.setFlying(true);
            }
        };
        this.world.chunkManager.setRenderDist(data.state.chunk_render_dist);
        // Position
        this._height                = PLAYER_HEIGHT;
        this.pos                    = new Vector(data.state.pos.x, data.state.pos.y, data.state.pos.z);
        this.lerpPos                = new Vector(this.pos);
        this._block_pos             = new Vector(0, 0, 0);
        this._eye_pos               = new Vector(0, 0, 0);
        this.#forward               = new Vector(0, 0, 0);
        this.blockPos               = this.getBlockPos().clone();
        this.blockPosO              = this.blockPos.clone();
        this.chunkAddr              = this.world.chunkManager.grid.toChunkAddr(this.pos);
        // Rotate
        this.rotate                 = new Vector(0, 0, 0);
        this.#_rotateDegree         = new Vector(0, 0, 0);
        this.setRotate(data.state.rotate);
        this.xBob                   = this.getXRot();
        this.yBob                   = this.getYRot();
        // State
        this.falling                = false; // падает
        this.running                = false; // бежит
        this.moving                 = false; // двигается в стороны
        this.walking                = false; // идёт по земле
        this.in_water               = false; // ноги в воде
        this.in_water_o             = false;
        this.eyes_in_block          = null; // глаза в воде
        this.eyes_in_block_o        = null; // глаза в воде (предыдущее значение)
        this.onGround               = false;
        this.onGroundO              = false;
        this.walking_frame          = 0;
        this.zoom                   = false;
        this.walkDist               = 0;
        this.swimingDist            = 0;
        this.walkDistO              = 0;
        this.bob                    = 0;
        this.oBob                   = 0;
        this.step_count             = 0;
        this._prevActionTime        = performance.now();
        this.body_rotate            = 0;
        this.body_rotate_o          = 0;
        this.body_rotate_speed      = BODY_ROTATE_SPEED;
        this.mineTime               = 0;
        this.timer_attack           = 0
        //
        this.inventory              = new PlayerInventory(this, data.inventory, Qubatch.hud);
        this.controlManager         = new ClientPlayerControlManager(this)
        this.chat                   = new Chat(this);
        this.controls               = new PlayerControls(this.options);
        this.windows                = new PlayerWindowManager(this);
        if (this.status === PLAYER_STATUS.DEAD) {
            this.setDie();
        }
        // Add listeners for server commands
        const server = this.world.server
        this.world.server.AddCmdListener([ServerClient.CMD_DIE], (cmd) => {this.setDie();});
        this.world.server.AddCmdListener([ServerClient.CMD_SET_STATUS_WAITING_DATA], (cmd) => {
            this.status = PLAYER_STATUS.WAITING_DATA;
        });
        this.world.server.AddCmdListener([ServerClient.CMD_SET_STATUS_ALIVE], (cmd) => {
            this.status = PLAYER_STATUS.ALIVE;
        });
        server.AddCmdListener([ServerClient.CMD_TELEPORT], cmd => this.onTeleported(cmd.data.pos))
        server.AddCmdListener([ServerClient.CMD_PLAYER_CONTROL_CORRECTION], cmd => {
            this.controlManager.onCorrection(cmd.data)
        }, null, true)
        server.AddCmdListener([ServerClient.CMD_PLAYER_CONTROL_ACCEPTED], cmd => {
            this.controlManager.onServerAccepted(cmd.data)
        })
        this.world.server.AddCmdListener([ServerClient.CMD_ERROR], (cmd) => {Qubatch.App.onError(cmd.data.message);});
        this.world.server.AddCmdListener([ServerClient.CMD_INVENTORY_STATE], (cmd) => {this.inventory.setState(cmd.data);});
        this.world.server.AddCmdListener([ServerClient.CMD_PLAY_SOUND], (cmd) => {
            Qubatch.sounds.play(cmd.data.tag, cmd.data.action, cmd.data.pos,
                false, false, cmd.data.maxDist || DEFAULT_SOUND_MAX_DIST);
        });
        this.world.server.AddCmdListener([ServerClient.CMD_STANDUP_STRAIGHT], (cmd) => {
            this.state.sitting = false
            this.state.sleep   = false
        });
        this.world.server.AddCmdListener([ServerClient.CMD_PLAYER_WORLD_DATA], (cmd) => {
            this.world_data = cmd.data
        });
        this.world.server.AddCmdListener([ServerClient.CMD_GAMEMODE_SET], (cmd) => {
            this.game_mode.applyMode(cmd.data.id, true);
            let pos = this.controlManager.getPos();
            this.lerpPos                        = new Vector(pos);
            this.pos                            = new Vector(pos);
        });
        this.world.server.AddCmdListener([ServerClient.CMD_ENTITY_INDICATORS], (cmd : {data: {indicators: Indicators}}) => {
            if (this.indicators.live > cmd.data.indicators.live) {
                Qubatch.hotbar.last_damage_time = performance.now();
            }
            this.indicators = cmd.data.indicators;
            this.inventory.hud.refresh();
        });
        this.world.server.AddCmdListener([ServerClient.CMD_EFFECTS_STATE], (cmd) => {
            this.effects.effects = cmd.data.effects;
            this.inventory.hud.refresh();
        });
        // pickAt
        this.pickAt = new PickAt(this.world, this.render, async (e : IPickatEvent, times : float, number : int) => {
            return this.onPickAtTarget(e, times, number)
        }, (e : IPickatEvent) => {
            if (e.button_id == MOUSE.BUTTON_LEFT) {
                this.setAnimation('attack', 1, .5)
                setTimeout(() => {
                    this.world.server.Send({
                        name: ServerClient.CMD_USE_WEAPON,
                        data: {
                            target: {
                                pid: e.interactPlayerID,
                                mid: e.interactMobID
                            }
                        }
                    })
                }, 500)
            } else {
                const instrument = this.getCurrentInstrument()
                const speed = instrument?.material?.speed ?? 1
                const time = e.start_time - this.timer_attack
                if (time < 500) {
                    return
                }
                this.mineTime = 0
                if (this.inAttackProcess === ATTACK_PROCESS_NONE) {
                    this.inAttackProcess = ATTACK_PROCESS_ONGOING;
                    this.inhand_animation_duration = RENDER_DEFAULT_ARM_HIT_PERIOD / speed
                }
                this.timer_attack = e.start_time
                const validAction = this.onInteractEntityClient(e, instrument)
                if (validAction) {
                    this.world.server.Send({
                        name: ServerClient.CMD_PICKAT_ACTION,
                        data: e
                    });
                }
            }
        }, (bPos: IPickatEventPos) => {
            // onInteractFluid
            const e = this.pickAt.damage_block.event as IPickatEvent
            const hand_current_item = this.inventory.current_item;
            if(e && e.createBlock && hand_current_item) {
                const hand_item_mat = this.world.block_manager.fromId(hand_current_item.id);
                if(hand_item_mat && hand_item_mat.tags.includes('set_on_water')) {
                    if(e.number++ == 0) {
                        e.pos = bPos;
                        const e_orig: ICmdPickatData = ObjectHelpers.deepClone(e);
                        e_orig.actions = new WorldAction(randomUUID());
                        // @server Отправляем на сервер инфу о взаимодействии с окружающим блоком
                        this.world.server.Send({
                            name: ServerClient.CMD_PICKAT_ACTION,
                            data: e_orig
                        });
                    }
                    return true;
                }
            }
            return false;
        });

        //setInterval(() => {
        //    const pos = Qubatch.player.lerpPos.clone();
        //    pos.set(24.5, 4.5, 24.5);
        //    this.render.destroyBlock({id: 202}, pos, false);
        //}, 10);

        this.arm = new PlayerArm(this, this.render)

        return true;
    }

    /** См. также ServerPlayer.onUseItemOnEntity */
    private onInteractEntityClient(e: IPickatEvent, instrumentHand: Instrument_Hand): boolean {
        if (e.interactPlayerID != null) {
            const player = this.world.players.get(e.interactPlayerID);
            if (player) {
                player.punch(e);
                return true
            }
        }
        if (e.interactMobID != null) {
            const mob = this.world.mobs.get(e.interactMobID)
            if (!mob) {
                return false
            }
            if (mob.hasUse || instrumentHand.material?.tags.includes('use_on_mob')) {
                // Попробовать действие или использование предмета на мобе (сервер знает что)
                mob.punch(e)
                return true
            }
            if (mob.supportsDriving && !mob.driving?.isFull()) {
                // Попробовать присоединиться к езде
                this.controlManager.syncWithActionId(e.id, true)
                return true
            }
        }
        return false
    }

    getOverChunk() {
        var overChunk = this.world.chunkManager.getChunk(this.chunkAddr);

        // legacy code, maybe not needed anymore:
        if (!overChunk) {
            // some kind of race F8+R
            const blockPos = this.getBlockPos();
            this.chunkAddr = this.world.chunkManager.grid.getChunkAddr(blockPos.x, blockPos.y, blockPos.z, this.chunkAddr);
            overChunk = this.world.chunkManager.getChunk(this.chunkAddr);
        }

        return overChunk;
    }

    get isAlive() : boolean {
        return this.indicators.live > 0;
    }

    // Return player is sneak
    get isSneak() {
        return this.controlManager.current.sneak
    }

    // Return player height
    get height() {
        const sneak = this.isSneak;
        const target_height = PLAYER_HEIGHT * (sneak ? SNEAK_HEIGHT : 1);
        // If sneak changed
        if(this.sneak !== sneak) {
            this.sneak = sneak;
            this.pn_start_change_sneak = performance.now();
            this._sneak_period = Math.abs(target_height - this._height) / (PLAYER_HEIGHT - PLAYER_HEIGHT * SNEAK_HEIGHT);
            if(this._sneak_period == 0) {
                this._height = target_height
            } else {
                this._height_diff = target_height - this._height;
                this._height_before_change = this._height;
            }
        }
        //
        if(this._height != target_height) {
            const elapsed = performance.now() - this.pn_start_change_sneak;
            if(elapsed < SNEAK_CHANGE_PERIOD * this._sneak_period) {
                // Interpolate between current and target heights
                const percent = elapsed / (SNEAK_CHANGE_PERIOD * this._sneak_period);
                this._height = this._height_before_change + (this._height_diff * percent);
            } else {
                this._height = target_height;
            }
        }
        return this._height;
    }

    //
    addRotate(vec3) {
        this.setRotate(
            this.rotate.addSelf(vec3)
        );
    }

    // setRotate
    // @var vec3 (0 ... PI)
    setRotate(vec3) {
        this.rotate.set(vec3.x, vec3.y, vec3.z);
        if(this.rotate.z < 0) {
            this.rotate.z = (Math.PI * 2) + this.rotate.z;
        }
        this.rotate.x = Helpers.clamp(this.rotate.x, -Math.PI / 2, Math.PI / 2);
        this.rotate.z = this.rotate.z % (Math.PI * 2);
    }

    // Rad to degree
    get rotateDegree() : Vector {
        // Rad to degree
        return this.#_rotateDegree.set(
            (this.rotate.x / Math.PI) * 180,
            (this.rotate.y - Math.PI) * 180 % 360,
            (this.rotate.z / (Math.PI * 2) * 360 + 180) % 360
        );
    }

    // Сделан шаг игрока по поверхности (для воспроизведения звука шагов)
    onStep(args) {
        this.steps_count++;
        if(this.isSneak) {
            return;
        }
        const world = this.world;
        const player = this;
        if(!player || (!args.force && (player.in_water || !player.walking || !player.controls.enabled))) {
            return;
        }
        const f = this.walkDist - this.walkDistO;
        if(f > 0 || args.force) {
            const pos = player.pos;
            const world_block = world.chunkManager.getBlock(Math.floor(pos.x), Math.ceil(pos.y) - 1, Math.floor(pos.z));
            const can_play_sound = world_block && world_block.id > 0 && world_block.material && (!world_block.material.passable || world_block.material.passable == 1);
            if(can_play_sound) {
                const block_over = world.chunkManager.getBlock(world_block.posworld.x, world_block.posworld.y + 1, world_block.posworld.z);
                if(!block_over || !(block_over.fluid > 0)) {
                    const default_sound   = 'madcraft:block.stone';
                    const action          = 'step';
                    let sound             = world_block.getSound();
                    const sound_list      = Qubatch.sounds.getList(sound, action) ?? Qubatch.sounds.getList(sound, 'hit');
                    if(!sound_list) {
                        sound = default_sound;
                    }
                    Qubatch.sounds.play(sound, action);
                    if(player.running) {
                        // play destroy particles
                        this.render.destroyBlock(world_block.material, player.pos, true, this.scale, this.scale);
                    }
                }
            }
        }
    }

    //
    onScroll(down) {
        if(down) {
            this.inventory.next();
        } else {
            this.inventory.prev();
        }
    }

    // Stop all player activity
    stopAllActivity() {
        // clear all keyboard inputs
        Qubatch.kb.clearStates();
        // stop player movement states
        this.controls.reset();
        // reset mouse actions
        this.resetMouseActivity();
    }

    // Stop all mouse actions, eating, mining, punching, etc...
    resetMouseActivity() {
        this.inMiningProcess = false;
        this.inItemUseProcess = false;
        this.inAttackProcess = ATTACK_PROCESS_NONE;
        if(this.pickAt) {
            this.pickAt.resetProgress();
        }
        this.stopItemUse();
    }

    // Hook for mouse input
    onMouseEvent(e) {
        const {type, button_id, shiftKey} = e;
        if(button_id == MOUSE.BUTTON_RIGHT) {
            if(type == MOUSE.DOWN) {
                const cur_mat_id = this.inventory.current_item?.id;
                if(cur_mat_id) {
                    const cur_mat = BLOCK.fromId(cur_mat_id);
                    const target_mat = this.pickAt.getTargetBlock(this)?.material;
                    const is_plant_berry = (target_mat &&  [BLOCK.PODZOL.id, BLOCK.COARSE_DIRT.id, BLOCK.DIRT.id, BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK_SLAB.id, BLOCK.FARMLAND.id, BLOCK.FARMLAND_WET.id].includes(target_mat.id) && cur_mat_id == BLOCK.SWEET_BERRY_BUSH.id) ? true : false
                    const is_plant = (target_mat && (target_mat.id == BLOCK.FARMLAND.id || target_mat.id == BLOCK.FARMLAND_WET.id) && cur_mat?.style_name == 'planting') ? true : false;
                    const canInteractWithBlock = target_mat && (target_mat.tags.includes('pot') && cur_mat.tags.includes("can_put_into_pot") || target_mat.can_interact_with_hand);
                    const is_cauldron  = (target_mat && target_mat.id == BLOCK.CAULDRON.id);
                    const is_composter  = (target_mat && target_mat.id == BLOCK.COMPOSTER.id)
                    if(!is_composter &&!is_cauldron && !is_plant_berry && !is_plant && !canInteractWithBlock && this.startItemUse(cur_mat)) {
                        return false;
                    }
                }
            } else {
                this.stopItemUse();
            }
        }
        if(type == MOUSE.DOWN) {
            this.pickAt.setEvent(this, {button_id, shiftKey});
            if(e.button_id == MOUSE.BUTTON_LEFT) {
                this.startArmSwingProgress();
            }
        } else if (type == MOUSE.UP) {
            this.resetMouseActivity();
        }
    }

    standUp() {
        if(this.driving || this.state.sitting || this.state.sleep) {
            this.world.server.Send({
                name: ServerClient.CMD_STANDUP_STRAIGHT,
                data: this.driving?.standUpGetId() ?? null
            })
        }
    }

    get forward() {
        return this.#forward.set(
            Math.cos(this.rotate.x) * Math.sin(this.rotate.z),
            Math.sin(this.rotate.x),
            Math.cos(this.rotate.x) * Math.cos(this.rotate.z),
        );
    }

    // onPickAtTarget
    async onPickAtTarget(e : IPickatEvent, times : float, number : int): Promise<boolean> {

        this.inMiningProcess = true;
        this.inhand_animation_duration = (e.destroyBlock ? 1 : 2.5) * RENDER_DEFAULT_ARM_HIT_PERIOD;

        let bPos = e.pos;
        // create block
        if(e.createBlock) {
            if(e.number > 1 && times < .02) {
                return false;
            }
        // clone block
        } else if(e.cloneBlock) {
            if(number > 1) {
                return false;
            }
        // destroy block
        } else if(e.destroyBlock) {
            const world_block   = this.world.chunkManager.getBlock(bPos.x, bPos.y, bPos.z);
            const block         = BLOCK.fromId(world_block.id);
            let mul             = Qubatch.world.info.generator.options.tool_mining_speed ?? 1;
            mul *= this.eyes_in_block?.is_water ? 0.2 : 1;
            mul += mul * 0.2 * this.getEffectLevel(Effect.HASTE); // Ускоренная разбивка блоков
            mul -= mul * 0.2 * this.getEffectLevel(Effect.MINING_FATIGUE); // усталость
            const mining_time   = block.material.getMiningTime(this.getCurrentInstrument(), this.game_mode.isCreative()) / mul;
            // arm animation + sound effect + destroy particles
            if(e.destroyBlock) {
                const hitIndex = Math.floor(times / (RENDER_DEFAULT_ARM_HIT_PERIOD / 1000));
                if(typeof this.hitIndexO === undefined || hitIndex > this.hitIndexO) {
                    this.render.destroyBlock(block, new Vector(bPos as IVector).addScalarSelf(.5, .5, .5), true);
                    Qubatch.sounds.play(block.sound, 'hit');
                    this.startArmSwingProgress();
                }
                this.hitIndexO = hitIndex;
            }
            if(mining_time == 0 && e.number > 1 && times < CONTINOUS_BLOCK_DESTROY_MIN_TIME) {
                return false;
            }
            if(times < mining_time) {
                this.pickAt.setDamagePercent(bPos, times / mining_time);
                return false;
            }
            if(number > 1 && times < CONTINOUS_BLOCK_DESTROY_MIN_TIME) {
                this.pickAt.setDamagePercent(bPos, times / CONTINOUS_BLOCK_DESTROY_MIN_TIME);
                return false;
            }
        }
        //
        if(!this.limitBlockActionFrequency(e) && this.game_mode.canBlockAction()) {
            if(this.state.sitting || this.state.sleep) {
                console.log('Stand up first');
                return false;
            }
            this.mineTime = 0;
            const e_orig: ICmdPickatData = ObjectHelpers.deepClone(e);
            const action_player_info = this.getActionPlayerInfo()
            const [actions, pos] = await doBlockAction(e, this.world, action_player_info, this.currentInventoryItem);
            if (actions) {
                e_orig.snapshotId = this.world.history.makeSnapshot(pos);
                if(e.createBlock && actions.blocks.list.length > 0) {
                    this.startArmSwingProgress();
                }
                await this.world.applyActions(actions, this);
                e_orig.actions = {blocks: actions.blocks};
                e_orig.eye_pos = this.getEyePos();
                // @server Отправляем на сервер инфу о взаимодействии с окружающим блоком
                this.world.server.Send({
                    name: ServerClient.CMD_PICKAT_ACTION,
                    data: e_orig
                });
            }
        }
        return true;
    }

    private getActionPlayerInfo(): ActionPlayerInfo {
        return {
            radius: PLAYER_DIAMETER, // .radius is used as a diameter
            height: this.height,
            pos: this.lerpPos,
            rotate: this.rotateDegree.clone(),
            session: {
                user_id: this.session.user_id
            }
        }
    }

    // Ограничение частоты выполнения данного действия
    limitBlockActionFrequency(e) {
        let resp = (e.number > 1 && performance.now() - this._prevActionTime < PREV_ACTION_MIN_ELAPSED);
        if(!resp) {
            this._prevActionTime = performance.now();
        }
        return resp;
    }

    //
    get currentInventoryItem(): IInventoryItem | null {
        return this.inventory.current_item;
    }

    // getCurrentInstrument
    getCurrentInstrument(): Instrument_Hand {
        const currentInventoryItem = this.currentInventoryItem;
        const instrument = new Instrument_Hand(this.inventory, currentInventoryItem);
        /* Old incorrect code that did nothing:
        if(currentInventoryItem && currentInventoryItem.item?.instrument_id) {
            // instrument = new Instrument_Hand();
        }
        */
        return instrument;
    }

    // changeSpawnpoint
    changeSpawnpoint() {
        this.world.server.SetPosSpawn(this.lerpPos.clone());
    }

    // Teleport
    teleport(place_id, pos, safe) {
        this.world.server.Teleport(place_id, pos, safe);
    }

    // Returns the position of the eyes of the player for rendering.
    getEyePos(): Vector {
        let subY = 0;
        if(this.state.sitting) {
            subY = this.height * 1/3;
        } else if(this.state.sleep) {
            subY = this.height * 0.5
        }
        return this._eye_pos.set(this.lerpPos.x, this.lerpPos.y + this.height * MOB_EYE_HEIGHT_PERCENT - subY, this.lerpPos.z);
    }

    // Return player block position
    getBlockPos() {
        return this._block_pos.copyFrom(this.lerpPos).floored();
    }

    onTeleported(vec: IVector): void {
        this.setPosition(vec)
        this.controlManager.startNewPhysicsSession(vec)
        this.status = PLAYER_STATUS.ALIVE
    }

    //
    setPosition(vec: IVector): void {
        //
        const pc = this.getPlayerControl();
        pc.player_state.onGround = false;
        this.controlManager.setPos(vec)
        //
        if (!Qubatch.is_server) {
            this.stopAllActivity();
        }
        //
        this.onGround = false;
        this.lastBlockPos = null;
        this.lastOnGroundTime = null;
        //
        this.pos = new Vector(vec);
        this.lerpPos = new Vector(vec);
        //
        this.blockPos = this.getBlockPos();
        this.chunkAddr = this.world.chunkManager.grid.getChunkAddr(this.blockPos.x, this.blockPos.y, this.blockPos.z);
    }

    getFlying() {
        let pc = this.getPlayerControl();
        return pc.player_state.flying;
    }

    /**
     * @param {boolean} value
     */
    setFlying(value) {
        this.getPlayerControl().player_state.flying = value;
    }

    getPlayerControl(): PlayerControl {
        return this.controlManager.current
    }

    /**
     * Updates this player (gravity, movement). Does the minimal necessary to send updates to the server.
     */
    updateControl(): void {
        const cm = this.controlManager
        cm.update()
        this.pos.copyFrom(cm.getPos())
        cm.lerpPos(this.lerpPos)
    }

    /**
     * Updates this local player (gravity, movement), triggers various effects, e.g. entering water.
     * It includes calling {@link updateControl}.
     */
    update(delta: float): void {

        // View
        if(this.lastUpdate && this.status === PLAYER_STATUS.ALIVE) {

            // for compatibility with renderHandsWithItems
            this.yBobO = this.yBob;
            this.xBobO = this.xBob;
            this.xBob += (this.getXRot() - this.xBob) * 0.5;
            this.yBob += (this.getYRot() - this.yBob) * 0.5;

            const overChunk = this.getOverChunk();
            if(!overChunk?.inited) {
                return;
            }
            let delta = Math.min(1.0, (performance.now() - this.lastUpdate) / 1000);
            //
            const pc = this.controlManager.current;
            this.posO.copyFrom(this.lerpPos);
            this.checkBodyRot(delta);
            // Physics tick
            this.updateControl()
            const minMovingDist = delta * MOVING_MIN_BLOCKS_PER_SECOND;
            this.moving     = this.lerpPos.distanceSqr(this.posO) > minMovingDist * minMovingDist
                && (this.controls.back || this.controls.forward || this.controls.right || this.controls.left);
            this.running    = this.controls.sprint;
            this.in_water_o = this.in_water;
            this.isOnLadder = pc.player_state.isOnLadder;
            this.onGroundO  = this.onGround;
            this.onGround   = pc.player_state.onGround || this.isOnLadder;
            this.in_water   = pc.player_state.isInWater;
            // Trigger events
            if(this.onGround && !this.onGroundO) {
                this.triggerEvent('step', {force: true});
            }
            if(this.in_water && !this.in_water_o) {
                this.triggerEvent('legs_enter_to_water');
            }
            if(!this.in_water && this.in_water_o) {
                this.triggerEvent('legs_exit_from_water');
            }
            //
            const velocity = pc.player_state.vel;
            // Update player model
            this.updateModelProps();
            // Walking
            this.walking = (Math.abs(velocity.x) > 0 || Math.abs(velocity.z) > 0) && !this.getFlying() && !this.in_water;
            this.prev_walking = this.walking;
            // Walking distance
            this.walkDistO = this.walkDist;
            //
            this.oBob = this.bob;
            let f = 0;
            //if (this.onGround && !this.isDeadOrDying()) {
                // f = Math.min(0.1, this.getDeltaMovement().horizontalDistance());
                f = Math.min(0.1, this.lerpPos.horizontalDistance(this.posO)) / delta / 40;
            //} else {
                //   f = 0.0F;
            //}
            if(this.walking && this.onGround) {
                // remove small arm movements when landing
                if(this.onGroundO != this.onGround) {
                    this.block_walking_ticks = 10;
                }
                if(!this.block_walking_ticks || --this.block_walking_ticks == 0) {
                    this.walking_frame += (this.in_water ? .2 : 1) * delta;
                    this.walkDist += this.lerpPos.horizontalDistance(this.posO) * 0.6;
                    this.bob += (f - this.bob) * 0.04
                }
            }
            //
            this.blockPos = this.getBlockPos();
            if(!this.blockPos.equal(this.blockPosO)) {
                this.chunkAddr          = this.world.chunkManager.grid.getChunkAddr(this.blockPos.x, this.blockPos.y, this.blockPos.z);
                this.blockPosO          = this.blockPos;
            }
            // Внутри какого блока находится глаза
            const eye_y             = this.getEyePos().y;
            this.headBlock          = this.world.chunkManager.getBlock(this.blockPos.x, eye_y | 0, this.blockPos.z);
            this.eyes_in_block_o    = this.eyes_in_block;
            this.eyes_in_block      = this.headBlock.material.is_portal ? this.headBlock.material : null;
            // если в воде, то проверим еще высоту воды
            if (this.headBlock.fluid > 0) {
                let fluidLevel = this.headBlock.getFluidLevel(this.lerpPos.x, this.lerpPos.z);
                if (eye_y < fluidLevel) {
                    this.eyes_in_block = this.headBlock.getFluidBlockMaterial();
                }
            }
            //
            if(this.eyes_in_block && !this.eyes_in_block_o) {
                if(this.eyes_in_block.is_water) {
                    this.triggerEvent('eyes_enter_to_water');
                }
            }
            if(this.eyes_in_block_o && !this.eyes_in_block) {
                if(this.eyes_in_block_o.is_water) {
                    this.triggerEvent('eyes_exit_to_water');
                }
            }
            if(this.in_water && this.in_water_o && !this.eyes_in_block) {
                this.swimingDist += this.lerpPos.horizontalDistance(this.posO) * 0.6;
                if(this.swimingDistIntPrev) {
                    if(this.swimingDistIntPrevO != this.swimingDistIntPrev) {
                        this.swimingDistIntPrevO = this.swimingDistIntPrev;
                        this.triggerEvent('swim_under_water');
                    }
                }
                this.swimingDistIntPrev = Math.round(this.swimingDist);
                // console.log(this.swimingDist);
            }
            // Update FOV
            this.render.updateFOV(delta, this.zoom, this.running, this.getFlying());
            this.render.updateNightVision(this.getEffectLevel(Effect.NIGHT_VISION));
            // Update picking target
            this.updatePickingTarget()
            this.updateTimerAnim()
        }
        this.lastUpdate = performance.now();
    }

    // Picking target
    updatePickingTarget() {
        if (this.pickAt && this.game_mode.canBlockAction()) {
            this.pickAt.update(this.getEyePos(), this.game_mode.getPickatDistance(), this.forward)
        } else {
            this.pickAt.targetDescription = null
        }
    }

    getInterpolatedHeadLight() {
        if(this.render.globalUniforms.lightOverride === 0xff) {
            return 0xff
        }
        if (!this.headBlock || !this.headBlock.tb) {
            return 0;
        }
        const {tb} = this.headBlock;
        return tb.getInterpolatedLightValue(this.lerpPos.sub(tb.dataChunk.pos));
    }

    checkBodyRot(delta: float): void {
        const pc = this.getPlayerControl();
        const value = delta * this.body_rotate_speed;
        if(pc.controls.right && !pc.controls.left) {
            this.body_rotate = Math.min(this.body_rotate + value, 1);
        } else if(pc.controls.left && !pc.controls.right) {
            this.body_rotate = Math.max(this.body_rotate - value, -1);
        } else if(pc.controls.forward || pc.controls.back) {
            if(this.body_rotate < 0) this.body_rotate = Math.min(this.body_rotate + value, 0);
            if(this.body_rotate > 0) this.body_rotate = Math.max(this.body_rotate - value, 0);
        }
        if(this.body_rotate_o != this.body_rotate) {
            // body rot changes
            this.body_rotate_o = this.body_rotate;
            this.triggerEvent('body_rot_changed', {value: this.body_rotate});
        }
    }

    triggerEvent(name : string, args : object = null) {
        switch(name) {
            case 'step': {
                this.onStep(args);
                break;
            }
            case 'legs_enter_to_water': {
                Qubatch.sounds.play('madcraft:environment', 'water_splash');
                this.render.addParticles({type: 'bubble', pos: this.pos});
                break;
            }
            case 'swim_under_water': {
                Qubatch.sounds.play('madcraft:environment', 'swim');
                break;
            }
            case 'legs_exit_from_water': {
                break;
            }
            case 'eyes_enter_to_water': {
                // turn on 'Underwater_Ambience' sound
                if(!this.underwater_track_id) {
                    Qubatch.sounds.play('madcraft:environment', 'entering_water');
                    this.underwater_track_id = Qubatch.sounds.play('madcraft:environment', 'underwater_ambience', null, true);
                }
                break;
            }
            case 'eyes_exit_to_water': {
                // turn off 'Underwater_Ambience' sound
                if(this.underwater_track_id) {
                    Qubatch.sounds.stop(this.underwater_track_id);
                    this.underwater_track_id = null;
                }
                Qubatch.sounds.play('madcraft:environment', 'exiting_water');
                break;
            }
            case 'body_rot_changed': {
                const itsme = this.getModel()
                if(itsme) {
                    itsme.setBodyRotate((args as any).value);
                }
                break;
            }
        }
    }

    getModel(): PlayerModel | null {
        return this.world.players.get(this.session.user_id);
    }

    // Emulate user keyboard control
    walk(direction, duration) {
        this.controls.forward = direction == 'forward';
        this.controls.back = direction == 'back';
        this.controls.left = direction == 'left';
        this.controls.right = direction == 'right';
        setTimeout(() => {
            this.controls.forward = false;
            this.controls.back = false;
            this.controls.left = false;
            this.controls.right = false;
        }, duration);
    }

    setDie() {
        this.status = PLAYER_STATUS.DEAD;
        this.moving = false;
        this.running = false;
        this.controls.reset();
        this.updateModelProps();
        this.inventory.hud.wm.closeAll();
        this.inventory.hud.wm.getWindow('frmDie').show();
    }

    // Start arm swing progress
    startArmSwingProgress() {
        const itsme = this.getModel()
        if(itsme) {
            itsme.startArmSwingProgress();
        }
    }

    // Update player model
    updateModelProps() {
        const model = this.getModel();
        if(model) {
            /*
            * Нужно передавать, то что приходит с сервера или будут отличия
            */
            model.hide_nametag = true;
            model.setProps(
                this.lerpPos,
                this.rotate,
                this.controls.sneak,
                this.running && !this.isSneak,
                this.state.hands,
                this.state.sitting,
                this.state.sleep,
                this.state.anim,
                this.indicators.live,
                this.onGround
            )
        }
    }

    // // Отправка информации о позиции и ориентации игрока на сервер
    // sendState() {
    //     const data = this.controlManager.exportUpdate()
    //     if (!data) {
    //         return
    //     }
    //
    //     /* Sending ping_value.
    //     In the old code, ping_value has been sent in CMD_PLAYER_STATE, but it was incorrectly
    //     and not used on the server.
    //     See also commented server code that reads ping_value in cmd_player_control_update.ts
    //
    //     data.push(Math.round(this.world.server.ping_value))
    //     */
    //
    //     this.world.server.Send({
    //         name: ServerClient.CMD_PLAYER_STATE,
    //         data: data
    //     });
    // }

    // Start use of item
    startItemUse(material) {
        const item_name = material?.item?.name;
        switch(item_name) {
            case 'bottle':
            case 'food': {
                const itsme = this.getModel()
                this.world.server.Send({name: ServerClient.CMD_USE_ITEM});
                this.inhand_animation_duration = RENDER_EAT_FOOD_DURATION;
                this._eating_sound_tick = 0;
                if(this._eating_sound) {
                    clearInterval(this._eating_sound);
                }
                // timer
                this._eating_sound = setInterval(() => {
                    itsme.eat = true
                    this._eating_sound_tick++
                    const action = (this._eating_sound_tick % 9 == 0) ? 'burp' : 'eat';
                    Qubatch.sounds.play('madcraft:block.player', action, null, false);
                    if(action != 'burp') {
                        // сдвиг точки, откуда происходит вылет частиц
                        const dist = new Vector(.25, -.25, .25).multiplyScalarSelf(this.scale);
                        const pos = this.getEyePos().add(this.forward.mul(dist));
                        pos.y -= .65 * this.scale;
                        this.render.destroyBlock(material, pos, true, this.scale, this.scale);
                    } else {
                        this.stopItemUse();
                    }
                }, 200);
                break;
            }
            case 'instrument': {
                // sword, axe, pickaxe, etc...
                return false;
            }
            case 'tool': {
                // like flint_and_steel
                return false;
            }
            default: {
                // console.log(item_name);
                return false;
            }
        }
        this.mineTime = 0
        return this.inItemUseProcess = true;
    }

    // Stop use of item
    stopItemUse() {
        const itsme = this.getModel()
        itsme.eat = false
        this.inItemUseProcess = false;
        if(this._eating_sound) {
            clearInterval(this._eating_sound);
            this._eating_sound = false;
            this.world.server.Send({name: ServerClient.CMD_USE_ITEM, data: {cancel: true}});
        }
    }

// compatibility methods

    isUsingItem() {
        return this.inItemUseProcess;
    }

    isScoping() {
        // return this.isUsingItem() && this.getUseItem().is(Items.SPYGLASS);
        return false;
    }

    isInvisible() {
        return false;
    }

    getMainArm() {
        return HumanoidArm.RIGHT; // InteractionHand.MAIN_HAND;
    }

    isAutoSpinAttack() {
        // return (this.entityData.get(DATA_LIVING_ENTITY_FLAGS) & 4) != 0;
        return false;
    }

    getXRot() {
        return this.rotateDegree.z;
    }

    getYRot() {
        return this.rotateDegree.x;
    }

    getViewXRot(pPartialTicks) {
        return this.getXRot();
    }

    getViewYRot(pPartialTicks) {
        return this.getYRot();
    }

    getAttackAnim(pPartialTicks, delta, changeMineTime = true) {

        // this.mineTime = itsme.swingProgress;
        if(!this.inMiningProcess && !this.inItemUseProcess &&
            this.inAttackProcess !== ATTACK_PROCESS_ONGOING && this.mineTime == 0
        ) {
            return 0;
        }

        if(changeMineTime) {
            this.mineTime += delta / this.inhand_animation_duration;
        }

        if (this.mineTime >= 1) {
            this.mineTime = 0;
            if (this.inAttackProcess === ATTACK_PROCESS_ONGOING) {
                this.inAttackProcess = ATTACK_PROCESS_FINISHED;
            }
        }

        return this.mineTime;

    }

    cancelAttackAnim() {
        this.mineTime = 0;
    }

    // TODO: хз что именно возвращать, возвращаю оставшееся время до конца текущей анимации
    getUseItemRemainingTicks() {
        // this.mineTime = itsme.swingProgress;
        if(!this.inMiningProcess && !this.inItemUseProcess &&
            this.inAttackProcess !== ATTACK_PROCESS_ONGOING && this.mineTime == 0
        ) {
            return 0;
        }
        return this.inhand_animation_duration - (this.inhand_animation_duration * this.mineTime);
    }

    // TODO: должен возвращать руку, в которой сейчас идет анимация (у нас она пока только одна)
    getUsedItemHand() {
        return InteractionHand.MAIN_HAND;
    }

    //
    getOverChunkBiomeId() {
        const chunk = this.getOverChunk()
        if(!chunk) return
        const CHUNK_SIZE_X = chunk.size.x;
        const CHUNK_SIZE_Z = chunk.size.z;
        const x = this.blockPos.x - this.chunkAddr.x * CHUNK_SIZE_X;
        const z = this.blockPos.z - this.chunkAddr.z * CHUNK_SIZE_Z;
        const cell_index = z * CHUNK_SIZE_X + x;
        return chunk.packedCells ? chunk.packedCells[cell_index * PACKED_CELL_LENGTH + PACKET_CELL_BIOME_ID] : 0;
    }

    updateArmor() {
        const model = this.getModel()
        if(model) {
            model.armor = this.inventory.exportArmorState()
        }
    }

    /*
    * Метод устанавливает проигрвание анимации
    */
    setAnimation(title: string, speed: number = 1, time: number = 1) {
        this.world.server.Send({
            name: ServerClient.CMD_PLAY_ANIM,
            data: {
                title,
                speed,
                time,
            }
        })
        this.state.anim = {
            title,
            speed
        }
        this.timer_anim = performance.now() + (time * 1000) / speed
    }

    /*
    * Проверка завершения анимации
    */
    updateTimerAnim() {
        if (this.moving) {
            if (this.state.anim) {
                this.world.server.Send({name: ServerClient.CMD_PLAY_ANIM,
                    data: {
                        cancel: true
                    }
                })
            }
            this.timer_anim = 0
            this.state.anim = false
            return
        }
        if (this.timer_anim <= performance.now()) {
            this.state.anim = false
        }
    }

}