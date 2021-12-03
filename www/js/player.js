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

const MAX_UNDAMAGED_HEIGHT              = 3;
const PLAYER_HEIGHT                     = 1.7;
const CONTINOUS_BLOCK_DESTROY_MIN_TIME  = .2; // минимальное время (мс) между разрушениями блоков без отжимания кнопки разрушения

// Creates a new local player manager.
export class Player {

    constructor() {}

    JoinToWorld(world, cb) {
        this.world = world;
        this.world.server.AddCmdListener([ServerClient.CMD_CONNECTED], (cmd) => {
            cb(this.playerConnectedToWorld(cmd.data), cmd);
        });
        this.world.server.Send({name: ServerClient.CMD_CONNECT, data: {world_guid: world.info.guid}});
    }

    // playerConnectedToWorld...
    playerConnectedToWorld(data) {
        let that                    = this;
        //
        this.session                = data.session;
        this.state                  = data.state;
        this.indicators             = data.state.indicators;
        this.previousForwardDown    = performance.now();
        this.previousForwardUp      = performance.now();
        this.world.chunkManager.setRenderDist(data.state.chunk_render_dist);
        // Position
        this.pos                    = new Vector(data.state.pos.x, data.state.pos.y, data.state.pos.z);
        this.prevPos                = new Vector(this.pos);
        this.lerpPos                = new Vector(this.pos);
        this.posO                   = new Vector(0, 0, 0);
        this.chunkAddr              = getChunkAddr(this.pos);
        this.blockPos               = this.getBlockPos();
        this.blockPosO              = this.blockPos.clone();
        // Rotate
        this.setRotate(data.state.rotate);
        // Inventory
        this.inventory              = new Inventory(this, Game.hud);
        this.inventory.onSelect     = (item) => {
            // Вызывается при переключении активного слота в инвентаре
            if(this.pickAt) {
                this.pickAt.resetProgress();
            }
        };
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
        this.flying                 = this.world.game_mode.getCurrent().can_fly; // летит
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
        this.keys                   = {};
        this.controls = {
            mouseX: 0,
            mouseY: 0,
            mouse_sensitivity: 1.0,
            inited: false,
            enabled: false,
            clearStates: function() {
                let player = that;
                player.keys[KEY.W] = false;
                player.keys[KEY.A] = false;
                player.keys[KEY.S] = false;
                player.keys[KEY.D] = false;
                player.keys[KEY.J] = false;
                player.keys[KEY.SPACE] = false;
                player.keys[KEY.SHIFT] = false;
            }
        };
        // Add listeners for server commands
        this.world.server.AddCmdListener([ServerClient.CMD_TELEPORT], (cmd) => {this.setPosition(cmd.data.pos);});
        this.world.server.AddCmdListener([ServerClient.CMD_ERROR], (cmd) => {Game.App.onError(cmd.data.message);});
        this.world.server.AddCmdListener([ServerClient.CMD_ENTITY_INDICATORS], (cmd) => {
            this.indicators = cmd.data.indicators;
            Game.hud.refresh();
        });
        return true;
    }

    addRotate(vec3) {
        vec3.divScalar(900);
        this.rotate.x   -= vec3.x; // взгляд вверх/вниз (pitch)
        this.rotate.z   += vec3.z; // Z поворот в стороны (yaw)
        this.setRotate(this.rotate);
    }

    // setRotate
    // @var vec3 (0 ... PI)
    setRotate(vec3) {
        this.rotate = new Vector(vec3);
        if(this.rotate.z < 0) {
            this.rotate.z = (Math.PI * 2) + this.rotate.z;
        }
        this.rotate.x = Helpers.clamp(this.rotate.x, -Math.PI / 2, Math.PI / 2);
        this.rotate.z = this.rotate.z % (Math.PI * 2);
        // Rad to degree
        if(!this.rotateDegree) {
            this.rotateDegree = Vector.ZERO.clone();
        }
        this.rotateDegree.x = (this.rotate.x / Math.PI) * 180;
        this.rotateDegree.y = (this.rotate.y - Math.PI) * 180 % 360;
        this.rotateDegree.z = (this.rotate.z / (Math.PI * 2) * 360 + 180) % 360;
    }

    // saveInventory...
    saveInventory(items) {
        this.world.server.SaveInventory(items);
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
    onPickAtTarget(bPos, e, times, number) {
        // createBlock
        if(e.createBlock) {
            if(e.number > 1 && times < .2) {
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
            let destroy_time    = BLOCK.getDestroyTime(block, this.world.game_mode.isCreative(), this.getCurrentInstrument());
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

    // Hook for keyboard input
    onKeyEvent(e) {
        let {keyCode, down, first, shiftKey, ctrlKey} = e;
        //
        if(this.keys[keyCode] && down) {
            // do nothing
        } else {
            this.keys[keyCode] = down ? performance.now(): false;
        }
        // 0...9 (Select material)
        if(!down && (keyCode >= 48 && keyCode <= 57)) {
            if(keyCode == 48) {
                keyCode = 58;
            }
            this.inventory.select(keyCode - 49);
            return true;
        }
        this.zoom = !!this.keys[KEY.C];
        // Running
        if(keyCode == KEY.S) {this.moving = down || this.keys[KEY.A] || this.keys[KEY.D] || this.keys[KEY.S] || this.keys[KEY.W];}
        if(keyCode == KEY.D) {this.moving = down || this.keys[KEY.A] || this.keys[KEY.D] || this.keys[KEY.S] || this.keys[KEY.W];}
        if(keyCode == KEY.A) {this.moving = down || this.keys[KEY.A] || this.keys[KEY.D] || this.keys[KEY.S] || this.keys[KEY.W];}
        if(keyCode == KEY.W) {
            const n = performance.now();
            if(down) {
                this.moving = true;
                if(n - this.previousForwardDown < 250 && n - this.previousForwardUp < 250) {
                    this.running = true;
                }
                this.previousForwardDown = n;
            } else {
                this.moving = false;
                this.running = false;
                this.previousForwardUp = n;
            }
        }
        if(ctrlKey) {
            this.running = !!this.keys[KEY.W];
        } else {
            if(!down) {
                if(keyCode == KEY.W) {
                    this.running = false;
                }
            }
        }
        return false;
    }

    // Called to perform an action based on the player's block selection and input.
    doBlockAction(e) {
        if(!this.world.game_mode.canBlockAction() || !this.pickAt) {
            return;
        }
        let destroyBlock    = e.destroyBlock;
        let cloneBlock      = e.cloneBlock;
        let createBlock     = e.createBlock;
        let world           = this.world;
        let pickat_dist     = this.world.game_mode.getPickatDistance();
        // Picking
        this.pickAt.get(this.pos, (pos) => {
            if(pos === false) {
                return;
            }
            let world_block = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
            let extra_data  = world_block.extra_data;
            let rotate      = world_block.rotate;
            let entity_id   = world_block.entity_id;
            if(world_block && world_block.id > 0) {
                world_block = world_block.material;
            }
            let playerPos       = this.getBlockPos();
            let isTrapdoor      = !e.shiftKey && createBlock && world_block && world_block.tags && world_block.tags.indexOf('trapdoor') >= 0;
            if(isTrapdoor) {
                // Trapdoor
                if(!extra_data) {
                    extra_data = {
                        opened: false,
                        point: new Vector(0, 0, 0)
                    };
                }
                extra_data.opened = extra_data && !extra_data.opened;
                if(world_block.sound) {
                    Game.sounds.play(world_block.sound, 'open');
                }
                this.pickAt.target_block.pos = new Vector(0, -Number.MAX_SAFE_INTEGER, 0);
                world.chunkManager.setBlock(pos.x, pos.y, pos.z, world_block, true, null, rotate, null, extra_data);
            } else if(createBlock) {
                let replaceBlock = world_block && BLOCK.canReplace(world_block.id);
                if(!replaceBlock) {
                    pos.x += pos.n.x;
                    pos.y += pos.n.y;
                    pos.z += pos.n.z;
                }
                // Запрет установки блока на блоки, которые занимает игрок
                if(playerPos.x == pos.x && playerPos.z == pos.z && (pos.y >= playerPos.y && pos.y <= playerPos.y + 1)) {
                    return;
                }
                // Запрет установки блока, если на позиции уже есть другой блок
                if(!replaceBlock) {
                    let existingBlock = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    if(!existingBlock.canReplace()) {
                        return;
                    }
                }
                // Если ткнули на предмет с собственным окном
                if([BLOCK.CRAFTING_TABLE.id, BLOCK.CHEST.id, BLOCK.FURNACE.id, BLOCK.BURNING_FURNACE.id].indexOf(world_block.id) >= 0) {
                    if(!e.shiftKey) {
                        switch(world_block.id) {
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
                if(!this.buildMaterial || this.inventory.getCurrent().count < 1) {
                    return;
                }
                if(replaceBlock && this.buildMaterial.style == 'ladder') {
                    return;
                }
                let matBlock = BLOCK.fromId(this.buildMaterial.id);
                // Запрет на списание инструментов как блоков
                if(matBlock.instrument_id) {
                    if(matBlock.instrument_id == 'shovel') {
                        if(world_block.id == BLOCK.DIRT.id) {
                            let extra_data = null;
                            pos.x -= pos.n.x;
                            pos.y -= pos.n.y;
                            pos.z -= pos.n.z;
                            world.chunkManager.setBlock(pos.x, pos.y, pos.z, BLOCK.DIRT_PATH, true, null, rotate, null, extra_data);
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
                            world.chunkManager.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, true, null, rotateDegree, null, extra_data);
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
                                Game.player.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), rotateDegree);
                                let b = BLOCK.fromId(this.buildMaterial.id);
                                if(b.sound) {
                                    Game.sounds.play(b.sound, 'place');
                                }
                            }
                        } else {
                            if(['ladder'].indexOf(this.buildMaterial.style) >= 0) {
                                // Лианы можно ставить на блоки с прозрачностью
                                if(world_block.transparent && world_block.style != 'default') {
                                    return;
                                }
                                if(pos.n.y == 0) {
                                    if(pos.n.z != 0) {
                                        // z
                                    } else {
                                        // x
                                    }
                                } else {
                                    let cardinal_direction = orientation.x;//BLOCK.getCardinalDirection(rotateDegree).z;
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
                            world.chunkManager.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, true, null, orientation, null, extra_data);
                        }
                    }
                    this.inventory.decrement();
                }
            } else if(destroyBlock) {
                // Destroy block
                if([BLOCK.BEDROCK.id, BLOCK.STILL_WATER.id].indexOf(world_block.id) < 0) {
                    this.destroyBlock(world_block, pos, this.getCurrentInstrument());
                }
            } else if(cloneBlock) {
                if(world_block && world.game_mode.canBlockClone()) {
                    this.inventory.cloneMaterial(world_block);
                }
            }
        }, pickat_dist);
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
        return this.lerpPos.add(new Vector(0.0, this.height, 0.0));
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
        return this.flying;
    }

    setFlying(value) {
        this.flying = value;
    }

    //
    getPlayerControl() {
        if(Game.world.game_mode.isSpectator()) {
            return this.pr_spectator;
        }
        return this.pr;
    }

    //
    nextGameMode() {
        let pc_previous = this.getPlayerControl();
        this.world.game_mode.next();
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
    }

    // Updates this local player (gravity, movement)
    update() {
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
            let isSpectator = this.world.game_mode.isSpectator();
            let delta = Math.min(1.0, (performance.now() - this.lastUpdate) / 1000);
            //
            let pc                 = this.getPlayerControl();
            this.posO              = new Vector(this.lerpPos);
            pc.controls.back       = !!(this.keys[KEY.S] && !this.keys[KEY.W]);
            pc.controls.forward    = !!(this.keys[KEY.W] && !this.keys[KEY.S]);
            pc.controls.right      = !!(this.keys[KEY.D] && !this.keys[KEY.A]);
            pc.controls.left       = !!(this.keys[KEY.A] && !this.keys[KEY.D]);
            pc.controls.jump       = !!this.keys[KEY.SPACE];
            pc.controls.sneak      = !!this.keys[KEY.SHIFT];
            pc.controls.sprint     = this.running;
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
            this.in_water_o = this.in_water;
            let velocity    = pc.player_state.vel;
            this.onGroundO  = this.onGround;
            this.onGround   = pc.player_state.onGround;
            this.in_water   = pc.player_state.isInWater;
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
        if(!Game.world.game_mode.isSurvival()) {
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

}