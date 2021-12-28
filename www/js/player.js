import {Helpers, ROTATE, Vector} from "./helpers.js";
import {getChunkAddr} from "./chunk.js";
import {BLOCK} from "./blocks.js";
import {ServerClient} from "./server_client.js";
import {PickAt} from "./pickat.js";
import {Instrument_Hand} from "./instrument/hand.js";
import {PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../vendors/prismarine-physics/using.js";
import {SpectatorPlayerControl} from "./spectator-physics.js";
import {Inventory} from "./inventory.js";
import {Chat} from "./chat.js";
import {PlayerControl} from "./player_control.js";
import { AABB } from './core/AABB.js';
import {GameMode, GAME_MODE} from "./game_mode.js";

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
                this.setFlying(false);
            } else if(mode.id == GAME_MODE.SPECTATOR) {
                this.setFlying(true);
            }
        };
        this._createBlockAABB       = new AABB();
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
        };
        this.inventory.setState(data.inventory);
        Game.hotbar.setInventory(this.inventory);
        // pickAt
        this.pickAt                 = new PickAt(this.world, Game.render, (...args) => {
            return this.onPickAtTarget(...args);
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
        this.eyes_in_water          = false; // глаза в воде
        this.eyes_in_water_o        = false; // глаза в воде (предыдущее значение)
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
        this.world.server.AddCmdListener([ServerClient.CMD_GAMEMODE_SET], (cmd) => {
            let pc_previous = this.getPlayerControl();
            this.game_mode.applyMode(cmd.data.id, false);
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
            let pos = player.getBlockPos();
            let world_block = world.chunkManager.getBlock(pos.x, pos.y - 1, pos.z);
            if(world_block && world_block.id > 0 && (!world_block.passable || world_block.passable == 1)) {
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

    // onPickAtTarget
    onPickAtTarget(e, times, number) {
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
            let world_block     = this.world.chunkManager.getBlock(bPos.x, bPos.y, bPos.z);
            let block           = BLOCK.BLOCK_BY_ID.get(world_block.id);
            let destroy_time    = BLOCK.getDestroyTime(block, this.game_mode.isCreative(), this.getCurrentInstrument());
            if(e.destroyBlock && e.number == 1 || e.number % 10 == 0) {
                Game.render.destroyBlock(block, bPos, true);
            }
            if(destroy_time == 0 && e.number > 1 && times < CONTINOUS_BLOCK_DESTROY_MIN_TIME) {
                return false;
            }
            if(times < destroy_time) {
                this.pickAt.setDamagePercent(bPos, times / destroy_time);
                return false;
            }
            if(number > 1 && times < CONTINOUS_BLOCK_DESTROY_MIN_TIME) {
                this.pickAt.setDamagePercent(bPos, times / CONTINOUS_BLOCK_DESTROY_MIN_TIME);
                return false;
            }
        }
        this.doBlockAction(e);
        return true;
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

    // Ограничение частоты выолнения данного действия
    limitBlockActionFrequency(e) {
        let resp = (e.number > 1 && performance.now() - this._prevActionTime < PREV_ACTION_MIN_ELAPSED);
        if(!resp) {
            this._prevActionTime = performance.now();
        }
        return resp;
    }

    // Called to perform an action based on the player's block selection and input.
    doBlockAction(e) {
        if(e.pos == false || !this.game_mode.canBlockAction()) {
            return;
        }
        //
        let destroyBlock    = e.destroyBlock;
        let cloneBlock      = e.cloneBlock;
        let createBlock     = e.createBlock;
        //
        let pos             = e.pos;
        let world           = this.world;
        let world_block     = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        let extra_data      = world_block.extra_data;
        let rotate          = world_block.rotate;
        let entity_id       = world_block.entity_id;
        let world_material  = world_block && world_block.id > 0 ? world_block.material : null;
        let playerPos       = this.lerpPos; // this.getBlockPos();
        let isTrapdoor      = !e.shiftKey && createBlock && world_material && world_material.tags.indexOf('trapdoor') >= 0;
        if(isTrapdoor) {
            // Trapdoor
            if(this.limitBlockActionFrequency(e)) {
                return;
            }
            this._prevActionTime = performance.now();
            if(!extra_data) {
                extra_data = {
                    opened: false,
                    point: new Vector(0, 0, 0)
                };
            }
            extra_data.opened = extra_data && !extra_data.opened;
            if(world_material.sound) {
                Game.sounds.play(world_material.sound, 'open');
            }
            this.pickAt.resetTargetPos();
            world.chunkManager.setBlock(pos.x, pos.y, pos.z, world_material, true, null, rotate, null, extra_data, ServerClient.BLOCK_ACTION_MODIFY);
        } else if(createBlock) {
            // Нельзя ничего ставить поверх этого блока
            let noSetOnTop = world_material.tags.indexOf('no_set_on_top') >= 0;
            if(noSetOnTop && pos.n.y == 1) {
                return;
            }
            //
            let replaceBlock = world_material && BLOCK.canReplace(world_material.id, world_block.extra_data);
            if(replaceBlock) {
                pos.n.y = 1;
            } else {
                pos.x += pos.n.x;
                pos.y += pos.n.y;
                pos.z += pos.n.z;
            }
            // Запрет установки блока на блоки, которые занимает игрок
            this._createBlockAABB.copyFrom({x_min: pos.x, x_max: pos.x + 1, y_min: pos.y, y_max: pos.y + 1, z_min: pos.z, z_max: pos.z + 1});
            let player_radius = 0.7;
            if(this._createBlockAABB.intersect({
                x_min: playerPos.x - player_radius / 2,
                x_max: playerPos.x - player_radius / 2 + player_radius,
                y_min: playerPos.y,
                y_max: playerPos.y + this.height,
                z_min: playerPos.z - player_radius / 2,
                z_max: playerPos.z - player_radius / 2 + player_radius
            })) {
                return;
            }
            // Запрет установки блока, если на позиции уже есть другой блок
            if(!replaceBlock) {
                let existingBlock = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                if(!existingBlock.canReplace()) {
                    return;
                }
            }
            if(this.limitBlockActionFrequency(e)) {
                return;
            }
            // Если ткнули на предмет с собственным окном
            if([BLOCK.CRAFTING_TABLE.id, BLOCK.CHEST.id, BLOCK.FURNACE.id, BLOCK.BURNING_FURNACE.id].indexOf(world_material.id) >= 0) {
                if(!e.shiftKey) {
                    switch(world_material.id) {
                        case BLOCK.CRAFTING_TABLE.id: {
                            Game.hud.wm.getWindow('frmCraft').toggleVisibility();
                            break;
                        }
                        case BLOCK.CHEST.id: {
                            Game.hud.wm.getWindow('frmChest').load(entity_id);
                            break;
                        }
                    }
                    this.pickAt.clearEvent();
                    return;
                }
            }
            // Эта проверка обязательно должна быть тут, а не выше!
            // Иначе не будут открываться сундуки и прочее
            if(!this.buildMaterial || (this.inventory.current_item && this.inventory.current_item.count < 1)) {
                return;
            }
            if(replaceBlock && this.buildMaterial.style == 'ladder') {
                return;
            }
            let matBlock = BLOCK.fromId(this.buildMaterial.id);
            // Некоторые блоки можно ставить только на что-то сверху
            let setOnlyToTop = matBlock.tags.indexOf('layering') >= 0;
            if(setOnlyToTop && pos.n.y != 1) {
                return;
            }
            // "Наслаивание" блока друг на друга, при этом блок остается 1, но у него увеличивается высота (максимум до 1)
            let isLayering = world_material.id == matBlock.id && pos.n.y == 1 && world_material.tags.indexOf('layering') >= 0;
            if(isLayering) {
                if(e.number == 1) {
                    let new_extra_data = null;
                    pos.y--;
                    if(extra_data) {
                        new_extra_data = JSON.parse(JSON.stringify(extra_data));
                    } else {
                        new_extra_data = {height: world_material.height};
                    }
                    new_extra_data.height += world_material.height;
                    if(new_extra_data.height < 1) {
                        if(this.limitBlockActionFrequency(e)) {
                            return;
                        }
                        this.pickAt.resetTargetPos();
                        world.chunkManager.setBlock(pos.x, pos.y, pos.z, world_material, true, null, rotate, null, new_extra_data, ServerClient.BLOCK_ACTION_MODIFY);
                    } else {
                        this.pickAt.resetTargetPos();
                        world.chunkManager.setBlock(pos.x, pos.y, pos.z, BLOCK.SNOW_BLOCK, true, null, null, null, null, ServerClient.BLOCK_ACTION_CREATE);
                    }
                }
                return;
            }
            // Факелы можно ставить только на определенные виды блоков!
            let isTorch = matBlock.style == 'torch';
            if(isTorch) {
                console.log(world_material.style);
                if(
                        !replaceBlock && (
                            ['default', 'fence'].indexOf(world_material.style) < 0 ||
                            (world_material.style == 'fence' && pos.n.y != 1) ||
                            (pos.n.y < 0) ||
                            (world_material.width && world_material.width != 1) ||
                            (world_material.height && world_material.height != 1)
                        )
                    ) {
                    return;
                }
            }
            // Запрет на списание инструментов как блоков
            if(matBlock.instrument_id) {
                if(matBlock.instrument_id == 'shovel') {
                    if(world_material.id == BLOCK.DIRT.id) {
                        let extra_data = null;
                        pos.x -= pos.n.x;
                        pos.y -= pos.n.y;
                        pos.z -= pos.n.z;
                        world.chunkManager.setBlock(pos.x, pos.y, pos.z, BLOCK.DIRT_PATH, true, null, rotate, null, extra_data, ServerClient.BLOCK_ACTION_REPLACE);
                    }
                }
            } else {
                const orientation = new Vector(this.rotateDegree);
                orientation.x = 0;
                orientation.y = 0;
                // top normal
                if (Math.abs(pos.n.y) === 1) {                        
                    orientation.x = BLOCK.getCardinalDirection(orientation);
                    orientation.z = 0;
                    orientation.y = pos.n.y; // mark that is up
                } else {
                    orientation.z = 0;
                    if (pos.n.x !== 0) {
                        orientation.x = pos.n.x > 0 ? ROTATE.E : ROTATE.W;
                    } else {
                        orientation.x = pos.n.z > 0 ? ROTATE.N : ROTATE.S;
                    }
                }
                let extra_data = BLOCK.makeExtraData(this.buildMaterial, pos);
                if(replaceBlock) {
                    // Replace block
                    if(matBlock.is_item || matBlock.is_entity) {
                        if(matBlock.is_entity) {
                            Game.player.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), orientation);
                        }
                    } else {
                        world.chunkManager.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, true, null, orientation, null, extra_data, ServerClient.BLOCK_ACTION_REPLACE);
                    }
                } else {
                    // Create block
                    // Посадить растения можно только на блок земли
                    let underBlock = this.world.chunkManager.getBlock(pos.x, pos.y - 1, pos.z);
                    if(BLOCK.isPlants(this.buildMaterial.id) && underBlock.id != BLOCK.DIRT.id) {
                        return;
                    }
                    if(matBlock.is_item || matBlock.is_entity) {
                        if(matBlock.is_entity) {
                            Game.player.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), orientation);
                            let b = BLOCK.fromId(this.buildMaterial.id);
                            if(b.sound) {
                                Game.sounds.play(b.sound, 'place');
                            }
                        }
                    } else {
                        if(['ladder'].indexOf(this.buildMaterial.style) >= 0) {
                            // Лианы можно ставить на блоки с прозрачностью
                            if(world_material.transparent && world_material.style != 'default') {
                                return;
                            }
                            if(pos.n.y == 0) {
                                if(pos.n.z != 0) {
                                    // z
                                } else {
                                    // x
                                }
                            } else {
                                let cardinal_direction = orientation.x;
                                let ok = false;
                                for(let i = 0; i < 4; i++) {
                                    let pos2 = new Vector(pos.x, pos.y, pos.z);
                                    let cd = cardinal_direction + i;
                                    if(cd > 4) cd -= 4;
                                    // F R B L
                                    switch(cd) {
                                        case ROTATE.S: {
                                            pos2 = pos2.add(new Vector(0, 0, 1));
                                            break;
                                        }
                                        case ROTATE.W: {
                                            pos2 = pos2.add(new Vector(1, 0, 0));
                                            break;
                                        }
                                        case ROTATE.N: {
                                            pos2 = pos2.add(new Vector(0, 0, -1));
                                            break;
                                        }
                                        case ROTATE.E: {
                                            pos2 = pos2.add(new Vector(-1, 0, 0));
                                            break;
                                        }
                                    }
                                    let cardinal_block = this.world.chunkManager.getBlock(pos2.x, pos2.y, pos2.z);
                                    if(cardinal_block.transparent && !(this.buildMaterial.tags && this.buildMaterial.tags.indexOf('anycardinal') >= 0)) {
                                        cardinal_direction = cd;
                                        rotateDegree.z = (rotateDegree.z + i * 90) % 360;
                                        ok = true;
                                        break;
                                    }
                                }
                                if(!ok) {
                                    return;
                                }
                            }
                        }
                        world.chunkManager.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, true, null, orientation, null, extra_data, ServerClient.BLOCK_ACTION_CREATE);
                    }
                }
            }
        } else if(destroyBlock) {
            // Destroy block
            if([BLOCK.BEDROCK.id, BLOCK.STILL_WATER.id].indexOf(world_material.id) < 0) {
                this.destroyBlock(world_material, pos, this.getCurrentInstrument());
            }
        } else if(cloneBlock) {
            if(world_material && this.game_mode.canBlockClone()) {
                this.inventory.cloneMaterial(world_material);
            }
        }
    }

    // Удалить блок используя инструмент
    destroyBlock(block, pos, instrument) {
        instrument.destroyBlock(block);
        this.world.chunkManager.destroyBlock(pos);
        // Delete plant over deleted block
        let block_over = this.world.chunkManager.getBlock(pos.x, pos.y + 1, pos.z);
        if(BLOCK.isPlants(block_over.id)) {
            pos.y++;
            this.destroyBlock(block_over.material, pos, instrument);
        }
    }

    // getCurrentInstrument
    getCurrentInstrument() {
        let buildMaterial = this.buildMaterial;
        let instrument = new Instrument_Hand(buildMaterial, this.inventory);
        if(buildMaterial && buildMaterial.instrument_id) {
            // instrument = new Instrument_Hand();
        }
        return instrument;
    }

    // changeSpawnpoint
    changeSpawnpoint() {
        let pos = this.lerpPos.clone().multiplyScalar(1000).floored().divScalar(1000);
        Game.player.world.server.SetPosSpawn(pos);
    }

    // randomTeleport
    teleport(place_id, pos) {
        Game.player.world.server.Teleport(place_id, pos);
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

    //
    nextGameMode() {
        this.world.server.GameModeNext();
    }

    // Updates this local player (gravity, movement)
    update() {
        this.inMiningProcess = false;

        // View
        if(this.lastUpdate) {
            if(!this.overChunk) {
                this.overChunk = Game.world.chunkManager.getChunk(this.chunkAddr);
            }
            if (!this.overChunk) {
                // some kind of race F8+R
                const blockPos = this.getBlockPos();
                this.chunkAddr          = getChunkAddr(blockPos.x, blockPos.y, blockPos.z);
                this.overChunk          = Game.world.chunkManager.getChunk(this.chunkAddr);
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
                this.overChunk          = Game.world.chunkManager.getChunk(this.chunkAddr);
                this.blockPosO          = this.blockPos;
            }
            // Внутри какого блока находится голова (в идеале глаза)
            let hby                 = this.pos.y + this.height;
            this.headBlock          = Game.world.chunkManager.getBlock(this.blockPos.x, hby | 0, this.blockPos.z);
            this.eyes_in_water_o    = this.eyes_in_water;
            this.eyes_in_water      = [BLOCK.STILL_WATER.id, BLOCK.FLOWING_WATER.id].indexOf(this.headBlock.id) >= 0;
            if(this.eyes_in_water) {
                // если в воде, то проверим еще высоту воды
                let headBlockOver = Game.world.chunkManager.getBlock(this.blockPos.x, (hby + 1) | 0, this.blockPos.z);
                let blockOverIsFluid = (headBlockOver.properties.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(headBlockOver.id) >= 0);
                if(!blockOverIsFluid) {
                    let power = Math.min(this.headBlock.power, .9);
                    this.eyes_in_water = hby < (hby | 0) + power + .01;
                }
            }
            // Update FOV
            Game.render.updateFOV(delta, this.zoom, this.running);
        }
        this.lastUpdate = performance.now();
    }

    // Emulate user keyboard control
    walk(direction, duration) {
        let keyCode = null;
        switch(direction) {
            case 'forward': keyCode = KEY.W; break;
            case 'back': keyCode = KEY.S; break;
            case 'left': keyCode = KEY.A; break;
            case 'right': keyCode = KEY.D; break;
            default: throw 'Invalid direction';
        }
        this.onKeyEvent({
            keyCode: keyCode,
            down: true,
            first: true,
            shiftKey: false,
            ctrlKey: false
        });
        setTimeout(() => {this.onKeyEvent({
            keyCode: keyCode,
            down: false,
            first: true,
            shiftKey: false,
            ctrlKey: false
        });}, duration);
    }

    // Проверка падения (урон)
    checkFalling() {
        if(!this.game_mode.isSurvival()) {
            return;
        }
        if(!this.onGround) {
            let bpos = Game.player.getBlockPos().add({x: 0, y: -1, z: 0});
            let block = Game.world.chunkManager.getBlock(bpos);
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

    // Test method
    dropItem() {
        if(!this.buildMaterial) {
            return false;
        }
        let pos = this.lerpPos.clone();
        pos.y += this.height * .25;
        pos.x += Math.sin(this.rotate.z) * 2;
        pos.z += Math.cos(this.rotate.z) * 2;
        // Game.render.dropBlock(this.buildMaterial, pos);
        Game.App.onError('error_deprecated');
    }

}