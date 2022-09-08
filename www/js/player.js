import {Helpers, getChunkAddr, Vector} from "./helpers.js";
import {ServerClient} from "./server_client.js";
import {PickAt} from "./pickat.js";
import {Instrument_Hand} from "./instrument/hand.js";
import {BLOCK} from "./blocks.js";
import {PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../vendors/prismarine-physics/using.js";
import {PlayerControl, SpectatorPlayerControl} from "./spectator-physics.js";
import {PlayerInventory} from "./player_inventory.js";
import { PlayerWindowManager } from "./player_window_manager.js";
import {Chat} from "./chat.js";
import {GameMode, GAME_MODE} from "./game_mode.js";
import {doBlockAction, WorldAction} from "./world_action.js";
import { BODY_ROTATE_SPEED, MOB_EYE_HEIGHT_PERCENT, MOUSE, PLAYER_HEIGHT, PLAYER_ZOOM, RENDER_DEFAULT_ARM_HIT_PERIOD, RENDER_EAT_FOOD_DURATION } from "./constant.js";
import { compressPlayerStateC } from "./packet_compressor.js";

const MAX_UNDAMAGED_HEIGHT              = 3;
const PREV_ACTION_MIN_ELAPSED           = .2 * 1000;
const CONTINOUS_BLOCK_DESTROY_MIN_TIME  = .2; // минимальное время (мс) между разрушениями блоков без отжимания кнопки разрушения
const SNEAK_HEIGHT                      = .78; // in percent
const SNEAK_CHANGE_PERIOD               = 150; // in msec

// Creates a new local player manager.
export class Player {

    #forward = new Vector(0, 0, 0);

    constructor(options) {
        this.inMiningProcess = false;
        this.inItemUseProcess = false;
        this.options = options;
        this.scale = PLAYER_ZOOM;
        this.current_state = {
            rotate:             new Vector(),
            pos:                new Vector(),
            sneak:              false,
            ping:               0
        };
    }

    JoinToWorld(world, cb) {
        this.world = world;
        //
        this.world.server.AddCmdListener([ServerClient.CMD_CONNECTED], (cmd) => {
            cb(this.playerConnectedToWorld(cmd.data), cmd);
        });
        //
        this.world.server.Send({name: ServerClient.CMD_CONNECT, data: {world_guid: world.info.guid}});
    }

    // playerConnectedToWorld...
    playerConnectedToWorld(data) {
        //
        this.session                = data.session;
        this.state                  = data.state;
        this.indicators             = data.state.indicators;
        // Game mode
        this.game_mode              = new GameMode(this, data.state.game_mode);
        this.game_mode.onSelect     = (mode) => {
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
        this.prevPos                = new Vector(this.pos);
        this.lerpPos                = new Vector(this.pos);
        this.posO                   = new Vector(0, 0, 0);
        this._block_pos             = new Vector(0, 0, 0);
        this._eye_pos               = new Vector(0, 0, 0);
        this.#forward               = new Vector(0, 0, 0);
        this.blockPos               = this.getBlockPos().clone();
        this.blockPosO              = this.blockPos.clone();
        this.chunkAddr              = getChunkAddr(this.pos);
        // Rotate
        this.rotate                 = new Vector(0, 0, 0);
        this.rotateDegree           = new Vector(0, 0, 0);
        this.setRotate(data.state.rotate);
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
        this.overChunk              = null;
        this.step_count             = 0;
        this._prevActionTime        = performance.now();
        this.body_rotate            = 0;
        this.body_rotate_o          = 0;
        this.body_rotate_speed      = BODY_ROTATE_SPEED;
        //
        this.inventory              = new PlayerInventory(this, data.inventory, Qubatch.hud);
        this.pr                     = new PrismarinePlayerControl(this.world, this.pos, {}); // player control
        this.pr_spectator           = new SpectatorPlayerControl(this.world, this.pos);
        this.chat                   = new Chat(this);
        this.controls               = new PlayerControl(this.options);
        this.windows                = new PlayerWindowManager(this);
        // Add listeners for server commands
        this.world.server.AddCmdListener([ServerClient.CMD_DIE], (cmd) => {this.setDie();});
        this.world.server.AddCmdListener([ServerClient.CMD_TELEPORT], (cmd) => {this.setPosition(cmd.data.pos);});
        this.world.server.AddCmdListener([ServerClient.CMD_ERROR], (cmd) => {Qubatch.App.onError(cmd.data.message);});
        this.world.server.AddCmdListener([ServerClient.CMD_INVENTORY_STATE], (cmd) => {this.inventory.setState(cmd.data);});
        window.playerTemp = this;
        this.world.server.AddCmdListener([ServerClient.CMD_PLAY_SOUND], (cmd) => {
            let dist = cmd.data.pos ? this.pos.distance(new Vector(cmd.data.pos)) : null;
            Qubatch.sounds.play(cmd.data.tag, cmd.data.action, dist);
        });
        this.world.server.AddCmdListener([ServerClient.CMD_STANDUP_STRAIGHT], (cmd) => {
            this.state.lies = false;
            this.state.sitting = false;
        });
        this.world.server.AddCmdListener([ServerClient.CMD_GAMEMODE_SET], (cmd) => {
            let pc_previous = this.getPlayerControl();
            this.game_mode.applyMode(cmd.data.id, true);
            let pc_current = this.getPlayerControl();
            //
            pc_current.player.entity.velocity   = new Vector(0, 0, 0);
            pc_current.player_state.vel         = new Vector(0, 0, 0);
            //
            let pos                             = new Vector(pc_previous.player.entity.position);
            pc_current.player.entity.position   = new Vector(pos);
            pc_current.player_state.pos         = new Vector(pos);
            this.lerpPos                        = new Vector(pos);
            this.pos                            = new Vector(pos);
            this.posO                           = new Vector(pos);
            this.prevPos                        = new Vector(pos);
        });
        this.world.server.AddCmdListener([ServerClient.CMD_ENTITY_INDICATORS], (cmd) => {
            this.indicators = cmd.data.indicators;
            Qubatch.hud.refresh();
        });
        // pickAt
        this.pickAt = new PickAt(this.world, Qubatch.render, async (...args) => {
            return await this.onPickAtTarget(...args);
        }, async (e) => {
            // onInterractMob
            const mob = Qubatch.world.mobs.get(e.interractMobID);
            if(mob) {
                mob.punch(e);
                // @server Отправляем на сервер инфу о взаимодействии с окружающим блоком
                this.world.server.Send({
                    name: ServerClient.CMD_PICKAT_ACTION,
                    data: e
                });
            }
        }, (bPos) => {
            // onInteractFluid
            const e = this.pickAt.damage_block.event;
            const hand_current_item = this.inventory.current_item;
            if(e && e.createBlock && hand_current_item) {
                const hand_item_mat = this.world.block_manager.fromId(hand_current_item.id);
                if(hand_item_mat && hand_item_mat.name == 'LILY_PAD') {
                    if(e.number++ == 0) {
                        e.pos = bPos;
                        const e_orig = JSON.parse(JSON.stringify(e));
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
        return true;
    }

    get isAlive() {
        return this.indicators.live.value > 0;
    }

    // Return player is sneak
    get isSneak() {
        // Get current player control
        const pc = this.getPlayerControl();
        if(pc instanceof PrismarinePlayerControl) {
            if(pc.player_state.control.sneak && pc.player_state.onGround) {
                return true;
            }
        }
        return false;
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
        // Rad to degree
        this.rotateDegree.set(
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
                if(!block_over || !block_over.material.is_fluid) {
                    const default_sound   = 'madcraft:block.stone';
                    const action          = 'hit';
                    let sound             = world_block.getSound();
                    const sound_list      = Qubatch.sounds.getList(sound, action);
                    if(!sound_list) {
                        sound = default_sound;
                    }
                    Qubatch.sounds.play(sound, action);
                    if(player.running) {
                        // play destroy particles
                        Qubatch.render.damageBlock(world_block.material, player.pos, true, this.scale, this.scale);
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
                    if(this.startItemUse(cur_mat)) {
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
        if(this.state.sitting || this.state.lies) {
            this.world.server.Send({
                name: ServerClient.CMD_STANDUP_STRAIGHT,
                data: null
            });
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
    async onPickAtTarget(e, times, number) {

        this.inMiningProcess = true;
        this.inhand_animation_duration = 5 * RENDER_DEFAULT_ARM_HIT_PERIOD;

        let bPos = e.pos;
        // createBlock
        if(e.createBlock) {
            if(e.number > 1 && times < .02) {
                return false;
            }
        // cloneBlock
        } else if(e.cloneBlock) {
            if(number > 1) {
                return false;
            }
        // destroyBlock
        } else if(e.destroyBlock) {
            const world_block   = this.world.chunkManager.getBlock(bPos.x, bPos.y, bPos.z);
            const block         = BLOCK.fromId(world_block.id);
            const mul           = Qubatch.world.info.generator.options.tool_mining_speed ?? 1;
            const mining_time   = block.material.getMiningTime(this.getCurrentInstrument(), this.game_mode.isCreative()) / mul;
            // arm animation + sound effect + destroy particles
            if(e.destroyBlock) {
                const hitIndex = Math.floor(times / (RENDER_DEFAULT_ARM_HIT_PERIOD / 1000));
                if(typeof this.hitIndexO === undefined || hitIndex > this.hitIndexO) {
                    Qubatch.render.damageBlock(block, new Vector(bPos).addScalarSelf(.5, .5, .5), true);
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
            if(this.state.sitting || this.state.lies) {
                console.log('Stand up first');
                return false;
            }
            const e_orig = JSON.parse(JSON.stringify(e));
            const player = {
                radius: 0.7,
                height: this.height,
                pos: this.lerpPos,
                rotate: this.rotateDegree.clone(),
                session: {
                    user_id: this.session.user_id
                }
            };
            const actions = await doBlockAction(e, this.world, player, this.currentInventoryItem);
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
        return true;
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
    get currentInventoryItem() {
        return this.inventory.current_item;
    }

    // getCurrentInstrument
    getCurrentInstrument() {
        const currentInventoryItem = this.currentInventoryItem;
        const instrument = new Instrument_Hand(this.inventory, currentInventoryItem);
        if(currentInventoryItem && currentInventoryItem.item?.instrument_id) {
            // instrument = new Instrument_Hand();
        }
        return instrument;
    }

    // changeSpawnpoint
    changeSpawnpoint() {
        this.world.server.SetPosSpawn(this.lerpPos.clone());
    }

    // Teleport
    teleport(place_id, pos) {
        this.world.server.Teleport(place_id, pos);
    }

    // Returns the position of the eyes of the player for rendering.
    getEyePos() {
        let subY = 0;
        if(this.state.sitting) {
            subY = this.height * 1/3;
        }
        return this._eye_pos.set(this.lerpPos.x, this.lerpPos.y + this.height * MOB_EYE_HEIGHT_PERCENT - subY, this.lerpPos.z);
    }

    // Return player block position
    getBlockPos() {
        return this._block_pos.copyFrom(this.lerpPos).floored();
    }

    //
    setPosition(vec) {
        vec = new Vector(vec);
        //
        const pc = this.getPlayerControl();
        pc.player.entity.position.copyFrom(vec);
        pc.player_state.pos.copyFrom(vec);
        pc.player_state.onGround = false;
        //
        this.clearEvents();
        //
        this.onGround = false;
        this.lastBlockPos = null;
        this.lastOnGroundTime = null;
        //
        this.pos = vec.clone();
        this.lerpPos = vec.clone();
        //
        this.blockPos = this.getBlockPos();
        this.chunkAddr = getChunkAddr(this.blockPos.x, this.blockPos.y, this.blockPos.z);
    }

    getFlying() {
        let pc = this.getPlayerControl();
        return pc.player_state.flying;
    }

    setFlying(value) {
        let pc = this.getPlayerControl();
        pc.player_state.flying = value;
    }

    //
    getPlayerControl() {
        if(this.game_mode.isSpectator()) {
            return this.pr_spectator;
        }
        return this.pr;
    }

    // Updates this local player (gravity, movement)
    update(delta) {
        this.inMiningProcess = false;
        // View
        if(this.lastUpdate) {
            if(!this.overChunk) {
                this.overChunk = this.world.chunkManager.getChunk(this.chunkAddr);
            }
            if (!this.overChunk) {
                // some kind of race F8+R
                const blockPos = this.getBlockPos();
                this.chunkAddr = getChunkAddr(blockPos.x, blockPos.y, blockPos.z, this.chunkAddr);
                this.overChunk = this.world.chunkManager.getChunk(this.chunkAddr);
            }
            if(!this.overChunk?.inited) {
                return;
            }
            let isSpectator = this.game_mode.isSpectator();
            let delta = Math.min(1.0, (performance.now() - this.lastUpdate) / 1000);
            //
            const pc               = this.getPlayerControl();
            this.posO.set(this.lerpPos.x, this.lerpPos.y, this.lerpPos.z);
            const applyControl = !this.state.sitting && !this.state.lies;
            pc.controls.back       = applyControl && this.controls.back;
            pc.controls.forward    = applyControl && this.controls.forward;
            pc.controls.right      = applyControl && this.controls.right;
            pc.controls.left       = applyControl && this.controls.left;
            pc.controls.jump       = applyControl && this.controls.jump;
            pc.controls.sneak      = applyControl && this.controls.sneak;
            pc.controls.sprint     = applyControl && this.controls.sprint;
            pc.player_state.yaw    = this.rotate.z;
            //
            this.checkBodyRot(delta);
            // Physics tick
            let ticks = pc.tick(delta, this.scale);
            //
            if(isSpectator) {
                this.lerpPos = pc.player.entity.position;
                this.pos = this.lerpPos;
            } else {
                // Prismarine player control
                if (ticks > 0) {
                    this.prevPos.copyFrom(this.pos);
                }
                this.pos.copyFrom(pc.player.entity.position);
                if (this.pos.distance(this.prevPos) > 10.0) {
                    this.lerpPos.copyFrom(this.pos);
                } else {
                    this.lerpPos.lerpFrom(this.prevPos, this.pos, pc.timeAccumulator / PHYSICS_TIMESTEP);
                }
            }
            this.lerpPos.roundSelf(8);
            this.moving     = !this.lerpPos.round(3).equal(this.posO.round(3)) && (this.controls.back || this.controls.forward || this.controls.right || this.controls.left);
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
            // Check falling
            this.checkFalling();
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
                this.chunkAddr          = getChunkAddr(this.blockPos.x, this.blockPos.y, this.blockPos.z);
                this.overChunk          = this.world.chunkManager.getChunk(this.chunkAddr);
                this.blockPosO          = this.blockPos;
            }
            // Внутри какого блока находится глаза
            const eye_y             = this.getEyePos().y;
            this.headBlock          = this.world.chunkManager.getBlock(this.blockPos.x, eye_y | 0, this.blockPos.z);
            this.eyes_in_block_o    = this.eyes_in_block;
            this.eyes_in_block      = (this.headBlock.material.is_fluid || this.headBlock.material.is_portal) ? this.headBlock.material : null;
            if(this.eyes_in_block) {
                // если в воде, то проверим еще высоту воды
                const headBlockOver = this.world.chunkManager.getBlock(this.blockPos.x, (eye_y + 1) | 0, this.blockPos.z);
                if(!headBlockOver.material.is_fluid) {
                    let power = 1; // Math.min(this.headBlock.power, .9);
                    this.eyes_in_block = (eye_y < (eye_y | 0) + power + .01) ? this.headBlock.material : null;
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
            Qubatch.render.updateFOV(delta, this.zoom, this.running, this.getFlying());
        }
        this.lastUpdate = performance.now();
    }

    //
    checkBodyRot(delta) {
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

    // 
    triggerEvent(name, args) {
        switch(name) {
            case 'step': {
                this.onStep(args);
                break;
            }
            case 'legs_enter_to_water': {
                Qubatch.sounds.play('madcraft:environment', 'water_splash');
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
                    this.underwater_track_id = Qubatch.sounds.play('madcraft:environment', 'underwater_ambience');
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
                    itsme.setBodyRotate(args.value);
                }
                break;
            }
        }
    }

    getModel() {
        return Qubatch.world.players.get(this.session.user_id);
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

    // Проверка падения (урон)
    checkFalling() {
        if(!this.game_mode.isSurvival()) {
            return;
        }
        if(!this.onGround) {
            let bpos = this.getBlockPos().add({x: 0, y: -1, z: 0});
            let block = this.world.chunkManager.getBlock(bpos);
            // ignore damage if dropped into water
            if(block.material.is_fluid) {
                this.lastBlockPos = this.getBlockPos();
            } else {
                let pos = this.getBlockPos();
                if(this.lastBlockPos && pos.y > this.lastBlockPos.y) {
                    this.lastBlockPos = pos;
                }
            }
        } else if(this.onGround != this.onGroundO && this.lastOnGroundTime) {
            let bp = this.getBlockPos();
            let height = (bp.y - this.lastBlockPos.y) / this.scale;
            if(height < 0) {
                let damage = -height - MAX_UNDAMAGED_HEIGHT;
                if(damage > 0) {
                    Qubatch.hotbar.damage(damage, 'falling');
                }
            }
            this.lastOnGroundTime = null;
        } else {
            this.lastOnGroundTime = performance.now();
            this.lastBlockPos = this.getBlockPos();
        }
    }

    setDie() {
        this.moving = false;
        this.running = false;
        this.controls.reset();
        this.updateModelProps();
        Qubatch.hud.wm.closeAll();
        Qubatch.hud.wm.getWindow('frmDie').show();
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
            model.hide_nametag = true;
            model.setProps(
                this.lerpPos,
                this.rotate,
                this.controls.sneak,
                this.moving, // && !this.getFlying(),
                this.running && !this.isSneak,
                this.state.hands,
                this.state.lies,
                this.state.sitting
            );
        }
    }

    // Отправка информации о позиции и ориентации игрока на сервер
    sendState() {
        const cs = this.current_state;
        const ps = this.previous_state;
        cs.rotate.copyFrom(this.rotate).roundSelf(4);
        cs.pos.copyFrom(this.lerpPos).roundSelf(4);
        cs.sneak = this.isSneak;
        this.ping = Math.round(this.world.server.ping_value);
        const not_equal = !ps ||
            (
                ps.rotate.x != cs.rotate.x || ps.rotate.y != cs.rotate.y || ps.rotate.z != cs.rotate.z ||
                ps.pos.x != cs.pos.x || ps.pos.y != cs.pos.y || ps.pos.z != cs.pos.z ||
                ps.sneak != cs.sneak ||
                ps.ping != cs.ping
            );
        if(not_equal) {
            if(!ps) {
                this.previous_state = JSON.parse(JSON.stringify(cs));
                this.previous_state.rotate = new Vector(cs.rotate);
                this.previous_state.pos = new Vector(cs.pos);
            } else {
                // copy current state to previous state
                this.previous_state.rotate.copyFrom(cs.rotate);
                this.previous_state.pos.copyFrom(cs.pos);
                this.previous_state.sneak = cs.sneak;
                this.previous_state.ping = cs.ping;
            }
            this.world.server.Send({
                name: ServerClient.CMD_PLAYER_STATE,
                data: compressPlayerStateC(cs)
            });
        }
    }

    // Start use of item
    startItemUse(material) {
        const item_name = material?.item?.name;
        switch(item_name) {
            case 'food': {
                this.inhand_animation_duration = RENDER_EAT_FOOD_DURATION;
                this._eating_sound_tick = 0;
                if(this._eating_sound) {
                    clearInterval(this._eating_sound);
                }
                // timer
                this._eating_sound = setInterval(() => {
                    this._eating_sound_tick++
                    const action = (this._eating_sound_tick % 9 == 0) ? 'burp' : 'eat';
                    Qubatch.sounds.play('madcraft:block.player', action, null, false);
                    if(action != 'burp') {
                        // сдвиг точки, откуда происходит вылет частиц
                        const dist = new Vector(.25, -.25, .25).multiplyScalar(this.scale);
                        const pos = this.getEyePos().add(this.forward.mul(dist));
                        pos.y -= .65 * this.scale;
                        Qubatch.render.damageBlock(material, pos, true, this.scale, this.scale);
                    }
                }, 200);
                break;
            }
            case 'instrument': {
                // sword, axe, pickaxe, etc...
                return true;
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
        return this.inItemUseProcess = true;
    }

    // Stop use of item
    stopItemUse() {
        this.inItemUseProcess = false;
        if(this._eating_sound) {
            clearInterval(this._eating_sound);
            this._eating_sound = false;
        }
    }

}