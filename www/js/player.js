import {Helpers, ROTATE, Vector} from "./helpers.js";
import {getChunkAddr} from "./chunk.js";
import {ServerClient} from "./server_client.js";
import {PickAt} from "./pickat.js";
import {Instrument_Hand} from "./instrument/hand.js";
import {BLOCK} from "./blocks.js";
import {PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../vendors/prismarine-physics/using.js";
import {SpectatorPlayerControl} from "./spectator-physics.js";
import {Inventory} from "./inventory.js";
import {Chat} from "./chat.js";
import {PlayerControl} from "./player_control.js";
import {GameMode, GAME_MODE} from "./game_mode.js";
import {doBlockAction} from "./block_action.js";
// import {Particles_Painting} from "./particles/painting.js";

const MAX_UNDAMAGED_HEIGHT              = 3;
const PLAYER_HEIGHT                     = 1.7;
const PREV_ACTION_MIN_ELAPSED           = .2 * 1000;
const CONTINOUS_BLOCK_DESTROY_MIN_TIME  = .2; // минимальное время (мс) между разрушениями блоков без отжимания кнопки разрушения

// Creates a new local player manager.
export class Player {

    constructor() {
        this.inMiningProcess = false;
    }

    JoinToWorld(world, cb) {
        this.world = world;
        this.world.server.AddCmdListener([ServerClient.CMD_CONNECTED], (cmd) => {
            cb(this.playerConnectedToWorld(cmd.data), cmd);
        });
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
                this.lastBlockPos = this.getBlockPos();
                this.setFlying(false);
            } else if(mode.id == GAME_MODE.SPECTATOR) {
                this.setFlying(true);
            }
        };
        this._prevActionTime        = performance.now();
        this.world.chunkManager.setRenderDist(data.state.chunk_render_dist);
        this._eye_pos               = new Vector(0, 0, 0);
        // Position
        this.pos                    = new Vector(data.state.pos.x, data.state.pos.y, data.state.pos.z);
        this.prevPos                = new Vector(this.pos);
        this.lerpPos                = new Vector(this.pos);
        this.posO                   = new Vector(0, 0, 0);
        this.chunkAddr              = getChunkAddr(this.pos);
        this.blockPos               = this.getBlockPos();
        this.blockPosO              = this.blockPos.clone();
        // Rotate
        this.rotate                 = new Vector(0, 0, 0);
        this.rotateDegree           = new Vector(0, 0, 0);
        this.setRotate(data.state.rotate);
        // Inventory
        this.inventory              = new Inventory(this, Game.hud);
        this.inventory.onSelect     = (item) => {
            // Вызывается при переключении активного слота в инвентаре
            if(this.pickAt) {
                this.pickAt.resetProgress();
            }
            this.world.server.InventorySelect(this.inventory.current);
            Game.hud.refresh();
        };
        this.inventory.setState(data.inventory);
        Game.hotbar.setInventory(this.inventory);
        // pickAt
        this.pickAt                 = new PickAt(this.world, Game.render, async (...args) => {
            return await this.onPickAtTarget(...args);
        });
        // Player control
        this.pr                     = new PrismarinePlayerControl(this.world, this.pos);
        this.pr_spectator           = new SpectatorPlayerControl(this.world, this.pos);
        // Chat
        this.chat                   = new Chat(this);
        //
        this.falling                = false; // падает
        this.running                = false; // бежит
        this.moving                 = false; // двигается в стороны
        this.walking                = false; // идёт по земле
        this.in_water               = false; // ноги в воде
        this.in_water_o             = false;
        this.eyes_in_water          = null; // глаза в воде
        this.eyes_in_water_o        = null; // глаза в воде (предыдущее значение)
        this.onGround               = false;
        this.onGroundO              = false;
        this.walking_frame          = 0;
        this.zoom                   = false;
        this.height                 = PLAYER_HEIGHT;
        this.walkDist               = 0;
        this.walkDistO              = 0;
        this.bob                    = 0;
        this.oBob                   = 0;
        this.overChunk              = null;
        this.step_count             = 0;
        // Controls
        this.controls               = new PlayerControl();
        // Add listeners for server commands
        this.world.server.AddCmdListener([ServerClient.CMD_TELEPORT], (cmd) => {this.setPosition(cmd.data.pos);});
        this.world.server.AddCmdListener([ServerClient.CMD_ERROR], (cmd) => {Game.App.onError(cmd.data.message);});
        this.world.server.AddCmdListener([ServerClient.CMD_INVENTORY_STATE], (cmd) => {this.inventory.setState(cmd.data);});
        this.world.server.AddCmdListener([ServerClient.CMD_PLAY_SOUND], (cmd) => {Game.sounds.play(cmd.data.tag, cmd.data.action);});
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
            Game.hud.refresh();
        });
        return true;
    }

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
    onStep(step_side) {
        this.steps_count++;
        let world = this.world;
        let player = this;
        if(!player || player.in_water || !player.walking || !player.controls.enabled) {
            return;
        }
        let f = player.walkDist - player.walkDistO;
        if(f > 0) {
            const pos = player.getBlockPos().clone();
            let world_block = world.chunkManager.getBlock(pos.x, pos.y, pos.z);
            const isLayering = world_block && world_block.material?.layering;
            if(!isLayering) {
                pos.y--;
                world_block = world.chunkManager.getBlock(pos.x, pos.y, pos.z);
            }
            if(world_block && world_block.id > 0 && world_block.material && (!world_block.material.passable || world_block.material.passable == 1)) {
                let default_sound   = 'madcraft:block.stone';
                let action          = 'hit';
                let sound           = world_block.getSound();
                let sound_list      = Game.sounds.getList(sound, action);
                if(!sound_list) {
                    sound = default_sound;
                }
                Game.sounds.play(sound, action);
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

    // Hook for mouse input
    onMouseEvent(e) {
        let {type, button_id, shiftKey} = e;
        // Mouse actions
        if (type == MOUSE.DOWN) {
            this.pickAt.setEvent({button_id: button_id, shiftKey: shiftKey});
        } else if (type == MOUSE.UP) {
            this.pickAt.clearEvent();
        }
    }

    // onPickAtTarget
    async onPickAtTarget(e, times, number) {

        this.inMiningProcess = true;

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
            const mining_time   = block.material.getMiningTime(this.getCurrentInstrument(), this.game_mode.isCreative());
            if(e.destroyBlock && e.number == 1 || e.number % 10 == 0) {
                Game.render.destroyBlock(block, bPos, true);
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
            const e_orig = JSON.parse(JSON.stringify(e));
            const player = {
                radius: 0.7,
                height: this.height,
                pos: this.lerpPos,
                rotate: this.rotateDegree.clone()
            };
            let actions = await doBlockAction(e, this.world, player, this.currentInventoryItem);
            this.applyActions(e, actions);
            e_orig.actions = {blocks: actions.blocks};
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

    // Apply pickat actions
    applyActions(e, actions) {
        // console.log(actions.id);
        if(actions.open_window) {
            this.inMiningProcess = false;
            Game.hud.wm.getWindow(actions.open_window).toggleVisibility();
        }
        if(actions.error) {
            console.error(actions.error);
        }
        if(actions.load_chest) {
            this.inMiningProcess = false;
            Game.hud.wm.getWindow('frmChest').load(actions.load_chest);
        }
        if(actions.play_sound) {
            Game.sounds.play(actions.play_sound.tag, actions.play_sound.action);
        }
        if(actions.reset_target_pos) {
            this.pickAt.resetTargetPos();
        }
        if(actions.reset_target_event) {
            this.pickAt.clearEvent();
        }
        if(actions.clone_block && this.game_mode.canBlockClone()) {
            this.world.server.CloneBlock(e.pos);
        }
        //if(actions.create_painting) {
        //    Game.render.meshes.add(new Particles_Painting(actions.create_painting));
        //}
        if(actions.blocks && actions.blocks.list) {
            for(let mod of actions.blocks.list) {
                const pos = mod.pos;
                const item = mod.item;
                const rotate = item.rotate;
                const extra_data = item.extra_data;
                switch(mod.action_id) {
                    case ServerClient.BLOCK_ACTION_CREATE:
                    case ServerClient.BLOCK_ACTION_REPLACE:
                    case ServerClient.BLOCK_ACTION_MODIFY: {
                        this.world.chunkManager.setBlock(pos.x, pos.y, pos.z, item, true, null, rotate, null, extra_data, mod.action_id);
                        break;
                    }
                    case ServerClient.BLOCK_ACTION_DESTROY: {
                        this.world.chunkManager.setBlock(pos.x, pos.y, pos.z, item, true, null, rotate, null, extra_data, mod.action_id);
                        break;
                    }
                }
            }
        }
    }

    //
    get currentInventoryItem() {
        return this.inventory.current_item;
    }

    // getCurrentInstrument
    getCurrentInstrument() {
        let currentInventoryItem = this.currentInventoryItem;
        let instrument = new Instrument_Hand(this.inventory, currentInventoryItem);
        if(currentInventoryItem && currentInventoryItem.item?.instrument_id) {
            // instrument = new Instrument_Hand();
        }
        return instrument;
    }

    // changeSpawnpoint
    changeSpawnpoint() {
        let pos = this.lerpPos.clone().multiplyScalar(1000).floored().divScalar(1000);
        this.world.server.SetPosSpawn(pos);
    }

    // Teleport
    teleport(place_id, pos) {
        this.world.server.Teleport(place_id, pos);
    }

    // Returns the position of the eyes of the player for rendering.
    getEyePos() {
        return this._eye_pos.set(this.lerpPos.x, this.lerpPos.y + this.height, this.lerpPos.z);
    }

    // getBlockPos
    getBlockPos() {
        return this.pos.floored();
    }

    //
    setPosition(vec) {
        let pc = this.getPlayerControl();
        pc.player.entity.position.copyFrom(vec);
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
    update() {
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
            let pc                 = this.getPlayerControl();
            this.posO.set(this.lerpPos.x, this.lerpPos.y, this.lerpPos.z);
            pc.controls.back       = this.controls.back;
            pc.controls.forward    = this.controls.forward;
            pc.controls.right      = this.controls.right;
            pc.controls.left       = this.controls.left;
            pc.controls.jump       = this.controls.jump;
            pc.controls.sneak      = this.controls.sneak;
            pc.controls.sprint     = this.controls.sprint;
            pc.player_state.yaw    = this.rotate.z;
            // Physics tick
            let ticks = pc.tick(delta);
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
            this.lerpPos.x = Math.round(this.lerpPos.x * 1000) / 1000;
            this.lerpPos.y = Math.round(this.lerpPos.y * 1000) / 1000;
            this.lerpPos.z = Math.round(this.lerpPos.z * 1000) / 1000;
            this.moving     = !this.lerpPos.equal(this.posO);
            this.running    = this.controls.sprint;
            this.in_water_o = this.in_water;
            this.onGroundO  = this.onGround;
            this.onGround   = pc.player_state.onGround;
            this.in_water   = pc.player_state.isInWater;
            let velocity    = pc.player_state.vel;
            // Check falling
            this.checkFalling();
            // Walking
            this.walking = (Math.abs(velocity.x) > 0 || Math.abs(velocity.z) > 0) && !this.getFlying() && !this.in_water;
            if(this.walking && this.onGround) {
                this.walking_frame += delta * (this.in_water ? .2 : 1);
            }
            this.prev_walking = this.walking;
            // Walking distance
            this.walkDistO = this.walkDist;
            this.walkDist += this.lerpPos.horizontalDistance(this.posO) * 0.6;
            //
            this.oBob = this.bob;
            let f = 0;
            //if (this.onGround && !this.isDeadOrDying()) {
                // f = Math.min(0.1, this.getDeltaMovement().horizontalDistance());
                f = Math.min(0.1, this.lerpPos.horizontalDistance(this.posO));
            //} else {
                //   f = 0.0F;
            //}
            this.bob += (f - this.bob) * 0.4;
            //
            this.blockPos = this.getBlockPos();
            if(!this.blockPos.equal(this.blockPosO)) {
                this.chunkAddr          = getChunkAddr(this.blockPos.x, this.blockPos.y, this.blockPos.z);
                this.overChunk          = this.world.chunkManager.getChunk(this.chunkAddr);
                this.blockPosO          = this.blockPos;
            }
            // Внутри какого блока находится голова (в идеале глаза)
            let hby                 = this.pos.y + this.height;
            this.headBlock          = this.world.chunkManager.getBlock(this.blockPos.x, hby | 0, this.blockPos.z);
            this.eyes_in_water_o    = this.eyes_in_water;
            this.eyes_in_water      = this.headBlock.material.is_fluid ? this.headBlock.material : null;
            if(this.eyes_in_water) {
                // если в воде, то проверим еще высоту воды
                let headBlockOver = this.world.chunkManager.getBlock(this.blockPos.x, (hby + 1) | 0, this.blockPos.z);
                let blockOverIsFluid = (headBlockOver.properties.fluid || headBlockOver.material.is_fluid);
                if(!blockOverIsFluid) {
                    let power = Math.min(this.headBlock.power, .9);
                    this.eyes_in_water = (hby < (hby | 0) + power + .01) ? this.headBlock.material : null;
                }
            }
            // Update FOV
            Game.render.updateFOV(delta, this.zoom, this.running, this.getFlying());
        }
        this.lastUpdate = performance.now();
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
            let height = bp.y - this.lastBlockPos.y;
            if(height < 0) {
                let damage = -height - MAX_UNDAMAGED_HEIGHT;
                if(damage > 0) {
                    Game.hotbar.damage(damage, 'falling');
                }
            }
            this.lastOnGroundTime = null;
        } else {
            this.lastOnGroundTime = performance.now();
            this.lastBlockPos = this.getBlockPos();
        }
    }

}