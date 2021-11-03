import {Helpers, ROTATE, Vector} from "./helpers.js";
import {getChunkAddr} from "./chunk.js";
import {Kb} from "./kb.js";
import {BLOCK} from "./blocks.js";
import {PickAt} from "./pickat.js";
import {Instrument_Hand} from "./instrument/hand.js";
import {PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../vendors/prismarine-physics/using.js";
import {SpectatorPlayerControl} from "./spectator-physics.js";

const PLAYER_HEIGHT                     = 1.7;
const CONTINOUS_BLOCK_DESTROY_MIN_TIME  = .2; // минимальное время (мс) между разрушениями блоков без отжимания кнопки разрушения

// Creates a new local player manager.
export class Player {

    constructor() {
        this.inventory              = null;
        this.client                 = null;
        this.falling                = false; // падает
        this.flying                 = false; // летит
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
        this.velocity               = new Vector(0, 0, 0);
        this.walkDist               = 0;
        this.walkDistO              = 0;
        this.bob                    = 0;
        this.oBob                   = 0;
        this.blockPos               = new Vector(0, 0, 0);
        this.blockPosO              = new Vector(0, 0, 0);
        this.chunkAddr              = new Vector(0, 0, 0);
        this.overChunk              = null;
        this.step_count             = 0;
    }

    // Assign the local player to a world.
    setWorld(world) {
        this.previousForwardDown    = performance.now();
        this.previousForwardUp      = performance.now();
        this.world                  = world;
        this.keys                   = {};
        this.eventHandlers          = {};
        // Position
        this.pos                    = new Vector(world.saved_state.pos.x, world.saved_state.pos.y, world.saved_state.pos.z);
        this.prevPos                = new Vector(this.pos);
        this.lerpPos                = new Vector(this.pos);
        this.posO                   = new Vector(0, 0, 0);
        // Rotate
        this.rotateDegree           = new Vector(0, 0, 0);
        this.setRotate(world.saved_state.rotate);
        // Flying state
        if(world.saved_state) {
            this.setFlying(!!world.saved_state.flying);
        }
        // pickAt
        this.pickAt                 = new PickAt(this.world, this.world.renderer, (...args) => {
            return this.onTarget(...args);
        });
        // Prismarine player control
        this.pr                     = new PrismarinePlayerControl(world, this.pos);
        this.pr_spectator           = new SpectatorPlayerControl(world, this.pos);
    }

    addRotate(vec3) {
        vec3.divScalar(900); // .multiplyScalar(Math.PI);
        this.rotate.x   -= vec3.x; // взгляд вверх/вниз (pitch)
        this.rotate.z   += vec3.z; // Z поворот в стороны (yaw)
        this.setRotate(this.rotate);
    }

    // setRotate
    // @var vec3 (0 ... PI)
    setRotate(vec3) {

        this.rotate = new Vector(vec3);
        // let halfPitch = (Game.render.canvas.height || window.innerHeight) / 1800;

        if(this.rotate.z < 0) {
            this.rotate.z = (Math.PI * 2) + this.rotate.z;
        }

        this.rotate.x = Helpers.clamp(this.rotate.x, -Math.PI / 2, Math.PI / 2);
        this.rotate.z = this.rotate.z % (Math.PI * 2);

        // rad to degree
        this.rotateDegree.x = (this.rotate.x / Math.PI) * 180;
        this.rotateDegree.y = (this.rotate.y - Math.PI) * 180 % 360;
        this.rotateDegree.z = (this.rotate.z / (Math.PI * 2) * 360 + 180) % 360;

        // this.update();
    }

    // Сделан шаг игрока по поверхности (для воспроизведения звука шагов)
    onStep(step_side) {
        this.step_count++;
        let world = this.world;
        let player = world.player;
        if(!player || player.in_water || !player.walking || !Game.controls.enabled) {
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

    // onTarget
    onTarget(bPos, e, times, number) {
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
                this.world.destroyBlock(block, bPos, true);
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

    // Вызывается при переключении активного слота в инвентаре
    onInventorySelect(inventory_item) {
        if(this.pickAt) {
            this.pickAt.resetProgress();
        }
    }

    // Assign the local player to a socket client.
    setClient(client) {
        this.client = client;
    }

    // Assign player to a inventory
    setInventory(inventory) {
        this.inventory = inventory;
    }

    // Set the canvas the renderer uses for some input operations.
    setInputCanvas(id) {
        this.canvas = document.getElementById(id);
        this.kb = new Kb(this.canvas, {
            onMouseEvent: (...args) => {return this.onMouseEvent(...args);},
            onKeyPress: (...args) => {return this.onKeyPress(...args);},
            onKeyEvent: (...args) => {return this.onKeyEvent(...args);}
        });
    }

    // Hook a player event.
    on(event, callback) {
        this.eventHandlers[event] = callback;
    }

    //
    onScroll(down) {
        if(down) {
            this.inventory.next();
        } else {
            this.inventory.prev();
        }
    }

    // Hook for keyboard input.
    onKeyPress(e) {
        let charCode = (typeof e.which == 'number') ? e.which : e.keyCode;
        let typedChar = String.fromCharCode(charCode);
        this.chat.typeChar(typedChar);
    }

    // Hook for keyboard input.
    onKeyEvent(e, keyCode, down, first) {

        // Chat
        if(this.chat.active) {
            switch(keyCode) {
                case KEY.ARROW_UP:
                case KEY.ARROW_DOWN: {
                    if(down) {
                        this.chat.historyNavigate(keyCode == KEY.ARROW_UP);
                        return true;
                    }
                    break;
                }
                case KEY.F5: {
                    return false;
                    break;
                }
                case KEY.ESC: {
                    if(down) {
                        this.chat.close();
                        // Game.setupMousePointerIfNoOpenWindows();
                        return true;
                    }
                    break;
                }
                case KEY.BACKSPACE: {
                    if(down) {
                        this.chat.backspace();
                        break;
                    }
                    return true;
                }
                case KEY.ENTER: {
                    if(!down) {
                        this.chat.submit();
                    }
                    return true;
                    break;
                }
            }
            return false;
        }

        let vw = Game.hud.wm.getVisibleWindows();
        if(vw.length > 0) {
            switch(keyCode) {
                // E (Inventory)
                case KEY.ESC:
                case KEY.E: {
                    if(!down) {
                        Game.hud.wm.closeAll();
                        Game.setupMousePointer();
                        return true;
                    }
                    break;
                }
            }
            return;
        }

        // Page Up
        if(keyCode == KEY.PAGE_UP) {
            if(down) {
                Game.world.chunkManager.setRenderDist(Game.world.chunkManager.CHUNK_RENDER_DIST + 1);
            }
        }

        // Set render distance [Page Down]
        if(keyCode == KEY.PAGE_DOWN) {
            if(down) {
                Game.world.chunkManager.setRenderDist(Game.world.chunkManager.CHUNK_RENDER_DIST - 1);
            }
        }

        // Flying [Space]
        if(keyCode == KEY.SPACE && Game.world.game_mode.canFly() && !this.in_water) {
            if(this.velocity.y > 0) {
                if(down && first) {
                    if(!this.getFlying()) {
                        this.velocity.y = 0;
                        this.setFlying(true);
                        console.log('flying');
                    }
                }
            }
        }

        if(this.keys[keyCode] && down) {
            // do nothing
        } else {
            this.keys[keyCode] = down ? performance.now(): false;
        }
        this.zoom = this.keys[KEY.C];

        switch(keyCode) {
            // [F1]
            case KEY.F1: {
                if(!down) {
                    Game.hud.toggleActive();
                }
                return true;
                break;
            }
            // Set spawnpoint [F3]
            case KEY.F3: {
                if(!down) {
                    Game.hud.toggleInfo();
                }
                return true;
                break;
            }
            // Draw all blocks [F4]
            case KEY.F4: {
                if(!down) {
                    if(e.shiftKey) {
                        let x = (Game.world.player.pos.x | 0) - 11;
                        let y = Game.world.player.pos.y | 0;
                        let z = (Game.world.player.pos.z | 0) - 13;
                        let d = 10;
                        let cnt = 0;
                        let startx = x;
                        let all_items = BLOCK.getAll();
                        for(let i = 0; i < all_items.length; i++) {
                            let block = all_items[i]
                            if(block.fluid || block.is_item || !block.spawnable) {
                                continue;
                            }
                            if(cnt % d == 0) {
                                x = startx;
                                z += 2;
                            }
                            x += 2;
                            Game.world.setBlock(x, y, z, block, null, null, null, block.extra_data);
                            cnt++;
                        }
                    } else {
                        this.changeSpawnpoint();
                    }
                }
                return true;
                break;
            }
            // F6 (Test light)
            case KEY.F6: {
                if(!down) {
                    Game.world.renderer.testLightOn = !Game.world.renderer.testLightOn;
                }
                return true;
                break;
            }
            // Export world [F7]
            case KEY.F7: {
                if(!down) {
                    Game.world.createClone();
                }
                return true;
                break;
            }
            // F8 (Random teleport)
            case KEY.F8: {
                if(!down) {
                    if(e.shiftKey) {
                        this.pickAt.get((pos) => {
                            if(pos !== false) {
                                if(pos.n.x != 0) pos.x += pos.n.x;
                                if(pos.n.z != 0) pos.z += pos.n.z;
                                if(pos.n.y != 0) {
                                    pos.y += pos.n.y;
                                    if(pos.n.y < 0) pos.y--;
                                }
                                this.teleport(null, pos);
                            }
                        }, 1000);
                    } else {
                        this.teleport('random', null);
                    }
                }
                return true;
                break;
            }
            // F9 (toggleNight | Under rain)
            case KEY.F9: {
                if(!down) {
                    // Game.world.underWaterfall();
                    Game.world.renderer.toggleNight();
                }
                return true;
                break;
            }
            // F10 (toggleUpdateChunks)
            case KEY.F10: {
                if(!down) {
                    this.nextGameMode();
                }
                return true;
                break;
            }
            case KEY.C: {
                if(first) {
                    Game.world.renderer.updateViewport();
                    return true;
                }
                break;
            }
            // R (Respawn)
            case KEY.R: {
                if(!down) {
                    Game.world.server.Teleport('spawn');
                }
                return true;
                break;
            }
            // E (Inventory)
            case KEY.E: {
                if(!down) {
                    if(Game.hud.wm.getVisibleWindows().length == 0) {
                        this.inventory.open();
                        return true;
                    }
                }
                break;
            }
            // T (Open chat)
            case KEY.T: {
                if(!down) {
                    if(!this.chat.active) {
                        this.chat.open([]);
                    }
                }
                return true;
                break;
            }
            case KEY.SLASH: {
                if(!down) {
                    if(!this.chat.active) {
                        this.chat.open(['/']);
                    }
                }
                break;
            }
            case KEY.ENTER: {
                if(!down) {
                    this.chat.submit();
                }
                break;
            }
        }
        // 0...9 (Select material)
        if(!down && (keyCode >= 48 && keyCode <= 57)) {
            if(keyCode == 48) {
                keyCode = 58;
            }
            Game.inventory.select(keyCode - 49);
            return true;
        }
        // Running
        // w = 87 // up
        // d = 68 // right
        // a = 65 // left
        // s = 83 // down
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
        if(e.ctrlKey) {
            if(this.keys[KEY.W]) {
                this.running = true;
            } else {
                this.running = false;
            }
        } else {
            if(!down) {
                if(keyCode == KEY.W) {
                    this.running = false;
                }
            }
        }
        return false;
    }

    // Hook for mouse input.
    onMouseEvent(e, x, y, type, button_id, shiftKey) {
        let visibleWindows = Game.hud.wm.getVisibleWindows();
        if(visibleWindows.length > 0) {
            if (type == MOUSE.DOWN) {
                Game.hud.wm.mouseEventDispatcher({
                    type:       e.type,
                    shiftKey:   e.shiftKey,
                    button:     e.button,
                    offsetX:    Game.mouseX * (Game.hud.width / Game.world.renderer.canvas.width),
                    offsetY:    Game.mouseY * (Game.hud.height / Game.world.renderer.canvas.height)
                });
                return false;
            }
        }
        if(!Game.controls.enabled || this.chat.active || visibleWindows.length > 0) {
            return false
        }
        x = Game.render.canvas.width * 0.5;
        y = Game.render.canvas.height * 0.5;
        // Mouse actions
        if (type == MOUSE.DOWN) {
            this.pickAt.setEvent({button_id: button_id, shiftKey: shiftKey});
        } else if (type == MOUSE.UP) {
            this.pickAt.clearEvent();
        }
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
        let pickat_dist     = this.world.getPickatDistance();
        // Picking
        this.pickAt.get((pos) => {
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
                world.setBlock(pos.x, pos.y, pos.z, world_block, null, rotate, null, extra_data);
            } else if(createBlock) {
                let replaceBlock = world_block && BLOCK.canReplace(world_block.id); // (world_block.fluid || world_block.id == BLOCK.GRASS.id);
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
                let matBlock = BLOCK.fromId(this.buildMaterial.id);
                // Запрет на списание инструментов как блоков
                if(matBlock.instrument_id) {
                    if(matBlock.instrument_id == 'shovel') {
                        if(world_block.id == BLOCK.DIRT.id) {
                            let extra_data = null;
                            pos.x -= pos.n.x;
                            pos.y -= pos.n.y;
                            pos.z -= pos.n.z;
                            world.setBlock(pos.x, pos.y, pos.z, BLOCK.DIRT_PATH, null, rotate, null, extra_data);
                        }
                    }
                } else {
                    let rotateDegree = this.rotateDegree;
                    let extra_data = BLOCK.makeExtraData(this.buildMaterial, pos);
                    if(replaceBlock) {
                        // Replace block
                        if(matBlock.is_item || matBlock.is_entity) {
                            if(matBlock.is_entity) {
                                Game.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), rotateDegree);
                            }
                        } else {
                            world.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, null, rotateDegree, null, extra_data);
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
                                Game.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), rotateDegree);
                                let b = BLOCK.fromId(this.buildMaterial.id);
                                if(b.sound) {
                                    Game.sounds.play(b.sound, 'place');
                                }
                            }
                        } else {
                            if(['ladder'].indexOf(this.buildMaterial.style) >= 0) {
                                if(world_block.transparent && !(this.buildMaterial.tags && this.buildMaterial.tags.indexOf('anycardinal') >= 0)) {
                                    return;
                                }
                                if(pos.n.y == 0) {
                                    if(pos.n.z != 0) {
                                        // z
                                    } else {
                                        // x
                                    }
                                } else {
                                    let cardinal_direction = BLOCK.getCardinalDirection(rotateDegree).z;
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
                            world.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, null, rotateDegree, null, extra_data);
                        }
                    }
                    this.inventory.decrement();
                }
            } else if(destroyBlock) {
                // Destroy block
                if(world_block.id != BLOCK.BEDROCK.id && world_block.id != BLOCK.STILL_WATER.id) {
                    this.destroyBlock(world_block, pos, this.getCurrentInstrument());
                    let block_over = this.world.chunkManager.getBlock(pos.x, pos.y + 1, pos.z);
                    // delete plant over deleted block
                    if(BLOCK.isPlants(block_over.id)) {
                        pos.y++;
                        world.chunkManager.destroyBlock(pos, true);
                    }
                }
            } else if(cloneBlock) {
                if(world_block && world.game_mode.canBlockClone()) {
                    this.inventory.cloneMaterial(world_block);
                }
            }
        }, pickat_dist);
    }

    changeSpawnpoint() {
        let pos = this.lerpPos.clone().multiplyScalar(1000).floored().divScalar(1000);
        Game.world.server.SetPosSpawn(pos);
        this.chat.messages.addSystem('Установлена точка возрождения ' + pos.toString());
    }

    // randomTeleport
    teleport(place_id, pos) {
        if(place_id != null) {
            return Game.world.server.Teleport(place_id);
        } else if(typeof pos != 'undefined' && pos) {
            Game.world.server.Teleport(null, pos);
        }
    }

    //
    getCurrentInstrument() {
        let buildMaterial = this.buildMaterial;
        let instrument = new Instrument_Hand(buildMaterial, this.inventory);
        if(buildMaterial && buildMaterial.instrument_id) {
            // instrument = new Instrument_Hand();
        }
        return instrument;
    }

    // Удалить блок используя инструмент
    destroyBlock(block, pos, instrument) {
        instrument.destroyBlock(block);
        this.world.chunkManager.destroyBlock(pos, true);
    }

    // Returns the position of the eyes of the player for rendering.
    getEyePos() {
        return this.lerpPos.add(new Vector(0.0, this.height, 0.0));
    }

    // getBlockPos
    getBlockPos() {
        let v = new Vector(
            this.pos.x | 0,
            this.pos.y | 0,
            this.pos.z | 0
        );
        if(this.pos.x < 0) {
            v.x--;
        }
        if(this.pos.z < 0) {
            v.z--;
        }
        return v;
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
    setPosition(vec) {
        Game.world.chunkManager.clearNerby();
        let pc = this.getPlayerControl();
        pc.player.entity.position.copyFrom(vec);
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
        if(this.lastUpdate != null && !Game.hud.splash.loading) {
            let isSpectator = this.world.game_mode.isSpectator();
            let delta = (performance.now() - this.lastUpdate) / 1000;
            delta = Math.min(delta, 1.0);

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

            if(isSpectator || this.getFlying()) {
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

            // pc.player_state.onGround
            this.in_water_o = this.in_water;
            let velocity    = pc.player_state.vel;
            this.onGroundO = this.onGround;
            this.onGround   = pc.player_state.onGround;
            this.in_water   = pc.player_state.isInWater;

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

            //
            this.applyFov(delta);

        }
        this.lastUpdate = performance.now();
    }

    // Emulate user keyboard control
    walk(direction, duration) {
        let key = null;
        switch(direction) {
            case 'forward': key = KEY.W; break;
            case 'back': key = KEY.S; break;
            case 'left': key = KEY.A; break;
            case 'right': key = KEY.D; break;
            default: throw 'Invalid direction';
        }
        this.onKeyEvent({ctrlKey: false}, key, true, true);
        setTimeout(() => {this.onKeyEvent({ctrlKey: false}, key, false, true);}, duration);
    }

    // Проверка падения (урон)
    checkFalling() {
        if(!Game.world.game_mode.isSurvival()) {
            return;
        }
        if(!this.onGround) {
            // do nothing
        } else if(this.onGround != this.onGroundO && this.lastOnGroundTime) {
            let bp = this.getBlockPos();
            let height = bp.y - this.lastBlockPos.y;
            if(height < 0) {
                let damage = -height - 3;
                // let falling_time = performance.now() - this.lastOnGroundTime;
                if(damage > 0) {
                    Game.hotbar.damage(damage / 20, 'falling');
                }
            }
            this.lastOnGroundTime = null;
        } else {
            this.lastOnGroundTime = performance.now();
            this.lastBlockPos = this.getBlockPos();
        }
    }

    //
    applyFov(delta) {
        const {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, FOV_CHANGE_SPEED, RENDER_DISTANCE} = Game.render.options;
        if(this.zoom) {
            if(Game.render.fov > FOV_ZOOM) {
                let fov = Math.max(Game.render.fov - FOV_CHANGE_SPEED * delta, FOV_ZOOM);
                Game.render.setPerspective(fov, 0.01, RENDER_DISTANCE);
            }
        } else {
            if(this.running) {
                if(Game.render.fov < FOV_WIDE) {
                    let fov = Math.min(Game.render.fov + FOV_CHANGE_SPEED * delta, FOV_WIDE);
                    Game.render.setPerspective(fov, 0.01, RENDER_DISTANCE);
                }
            } else if(Game.render.fov < FOV_NORMAL) {
                let fov = Math.min(Game.render.fov + FOV_CHANGE_SPEED * delta, FOV_NORMAL);
                Game.render.setPerspective(fov, 0.01, RENDER_DISTANCE);
            } else {
                if(Game.render.fov > FOV_NORMAL) {
                    let fov = Math.max(Game.render.fov - FOV_CHANGE_SPEED * delta, FOV_NORMAL);
                    Game.render.setPerspective(fov, 0.01, RENDER_DISTANCE);
                }
            }
        }
    }

}