import Chat from "./chat.js";
import {Helpers, Vector} from "./helpers.js";
import {BLOCK} from "./blocks.js";
import {Kb} from "./kb.js";
import {Game} from "./game.js";
import {PickAt} from "./pickat.js";
import {Instrument_Hand} from "./instrument/hand.js";

// ==========================================
// Player
// This class contains the code that manages the local player.
// ==========================================

const PLAYER_HEIGHT                     = 1.8;
const CONTINOUS_BLOCK_DESTROY_MIN_TIME  = .2; // минимальное время (мс) между разрушениями блоков без отжимания кнопки разрушения

// Creates a new local player manager.
export default class Player {

    constructor() {
        this.inventory              = null;
        this.client                 = null;
        this.falling                = false; // падает
        this.flying                 = false; // летит
        this.running                = false; // бежит
        this.moving                 = false; // двигается в стороны
        this.walking                = false; // идёт по земле
        this.walking_frame          = 0;
        this.zoom                   = false;
        this.height                 = PLAYER_HEIGHT;
        this.angles                 = [0, 0, Math.PI];
        this.chat                   = new Chat();
        this.velocity               = new Vector(0, 0, 0);
    }

    // Assign the local player to a world.
    setWorld(world) {
        this.previousForwardDown    = performance.now();
        this.previousForwardUp      = performance.now();
        this.world                  = world;
        this.world.localPlayer      = this;
        this.keys                   = {};
        this.eventHandlers          = {};
        this.pos                    = world.saved_state ? new Vector(world.saved_state.pos.x, world.saved_state.pos.y, world.saved_state.pos.z) : world.spawnPoint;
        if(world.saved_state) {
            this.flying = !!world.saved_state.flying;
        }
        this.overChunk              = null;
        // pickAt
        this.pickAt                 = new PickAt(this.world.renderer, (...args) => {
            return this.onTarget(...args);
        });
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
            let block           = BLOCK.BLOCK_BY_ID[world_block.id];
            let destroy_time    = BLOCK.getDestroyTime(block, this.world.game_mode.isCreative(), this.getCurrentInstrument());
            if(e.destroyBlock && e.number == 1 || e.number % 10 == 0) {
                this.world.destroyBlock(block, bPos, true);
            }
            if(destroy_time == 0 && e.number > 1 && times < CONTINOUS_BLOCK_DESTROY_MIN_TIME) {
                return false;
            }
            if(times < destroy_time) {
                this.pickAt.setDamagePercent(times / destroy_time);
                return false;
            }
            if(number > 1 && times < CONTINOUS_BLOCK_DESTROY_MIN_TIME) {
                this.pickAt.setDamagePercent(times / CONTINOUS_BLOCK_DESTROY_MIN_TIME);
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
        if(keyCode == KEY.SPACE && Game.world.game_mode.canFly()) {
            if(this.velocity.y > 0) {
                if(down && first) {
                    if(!this.flying) {
                        this.velocity.y = 0;
                        this.flying = true;
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
            // Save [F2]
            case KEY.F2: {
                if(!down) {
                    Game.world.saveToDB();
                    this.chat.messages.addSystem('Saved ... OK');
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
                        let x = (Game.player.pos.x | 0) - 11;
                        let y = Game.player.pos.y | 0;
                        let z = (Game.player.pos.z | 0) - 13;
                        let d = 10;
                        let cnt = 0;
                        let startx = x;
                        let all_items = BLOCK.getAll();
                        for(let i = 0; i < all_items.length; i++) {
                            let block = all_items[i]
                            if(block.fluid || block.is_item) {
                                continue;
                            }
                            if(cnt % d == 0) {
                                x = startx;
                                z += 2;
                            }
                            x += 2;
                            Game.world.setBlock(x, y, z, block);
                            cnt++;
                        }
                    } else {
                        let np = this.pos;
                        Game.world.spawnPoint = new Vector(np.x, np.y, np.z);
                        console.log('Spawnpoint changed');
                        this.chat.messages.addSystem('Spawnpoint changed');
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
                    //if(e.shiftKey) {
                    Game.world.createClone();
                    //}
                }
                return true;
                break;
            }
            // F8 (Random teleport)
            case KEY.F8: {
                if(!down) {
                    Game.world.randomTeleport();
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
                    this.world.game_mode.next();
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
                    this.pos.x = Game.world.spawnPoint.x;
                    this.pos.y = Game.world.spawnPoint.y;
                    this.pos.z = Game.world.spawnPoint.z;
                }
                return true;
                break;
            }
            // E (Inventory)
            case KEY.E: {
                if(!down) {
                    if(Game.hud.wm.getVisibleWindows().length == 0) {
                        Game.hud.wm.getWindow('frmInventory').toggleVisibility();
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
        const playerRotate  = Game.world.rotateDegree;
        // Picking
        this.pickAt.get((pos) => {
            if(pos === false) {
                return;
            }
            let world_block     = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
            let playerPos       = this.getBlockPos();
            let replaceBlock    = world_block && (world_block.fluid || world_block.id == BLOCK.GRASS.id);
            let isTrapdoor      = !e.shiftKey && createBlock && world_block && world_block.tags && world_block.tags.indexOf('trapdoor') >= 0;
            if(isTrapdoor) {
                // Trapdoor
                world_block.extra_data.opened = !world_block.extra_data.opened;
                if(world_block.sound) {
                    Game.sounds.play(world_block.sound, 'open');
                }
                world.setBlock(pos.x, pos.y, pos.z, world_block, null, world_block.rotate, null, world_block.extra_data);
            } else if(createBlock) {
                if(!replaceBlock) {
                    pos.x += pos.n.x;
                    pos.y += pos.n.y;
                    pos.z += pos.n.z;
                }
                if(playerPos.x == pos.x && playerPos.z == pos.z && (pos.y >= playerPos.y && pos.y <= playerPos.y + 1)) {
                    return;
                }
                if([BLOCK.CRAFTING_TABLE.id, BLOCK.CHEST.id, BLOCK.FURNACE.id, BLOCK.BURNING_FURNACE.id].indexOf(world_block.id) >= 0) {
                    if(!e.shiftKey) {
                        switch(world_block.id) {
                            case BLOCK.CRAFTING_TABLE.id: {
                                Game.hud.wm.getWindow('ct1').toggleVisibility();
                                break;
                            }
                            case BLOCK.CHEST.id: {
                                Game.hud.wm.getWindow('frmChest').load(world_block);
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
                            world.setBlock(pos.x, pos.y, pos.z, BLOCK.DIRT_PATH, null, world_block.rotate, null, extra_data);
                            // world.setBlock(pos.x, pos.y, pos.z, world_block, 15/16, world_block.rotate, null, extra_data);
                        }
                    }
                } else {
                    let extra_data = BLOCK.makeExtraData(this.buildMaterial, pos);
                    if(replaceBlock) {
                        // Replace block
                        if(matBlock.is_item || matBlock.is_entity) {
                            if(matBlock.is_entity) {
                                Game.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), playerRotate);
                            }
                        } else {
                            world.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, null, playerRotate, null, extra_data);
                        }
                    } else {
                        // Create block
                        let blockUnder = this.world.chunkManager.getBlock(pos.x, pos.y - 1, pos.z);
                        if(BLOCK.isPlants(this.buildMaterial.id) && blockUnder.id != BLOCK.DIRT.id) {
                            return;
                        }
                        if(matBlock.is_item || matBlock.is_entity) {
                            if(matBlock.is_entity) {
                                Game.world.server.CreateEntity(matBlock.id, new Vector(pos.x, pos.y, pos.z), playerRotate);
                                let b = BLOCK.fromId(this.buildMaterial.id);
                                if(b.sound) {
                                    Game.sounds.play(b.sound, 'place');
                                }
                            }
                        } else {
                            if(['ladder'].indexOf(this.buildMaterial.style) >= 0) {
                                if(pos.n.z != 0 || world_block.transparent) {
                                    return;
                                }
                            }
                            world.setBlock(pos.x, pos.y, pos.z, this.buildMaterial, null, playerRotate, null, extra_data);
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
        });
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
        return this.pos.add(new Vector(0.0, this.height, 0.0));
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

    // Updates this local player (gravity, movement)
    update() {
        let velocity  = this.velocity;
        let pos       = this.pos;
        let bPos      = new Vector(
            pos.x | 0,
            pos.y | 0,
            pos.z | 0
        );
        const {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, FOV_CHANGE_SPEED, RENDER_DISTANCE} = Game.render.options;
        if(this.lastUpdate != null) {
            let delta = (performance.now() - this.lastUpdate) / 1000;
            // View
            this.angles[0] = parseInt(this.world.rotateRadians.x * 100000) / 100000; // pitch | вверх-вниз (X)
            this.angles[2] = parseInt(this.world.rotateRadians.z * 100000) / 100000; // yaw | влево-вправо (Z)
            // Gravity
            if(this.falling && !this.flying) {
                velocity.y += -(30 * delta);
            }
            // Jumping | flying
            if(this.keys[KEY.SPACE]) {
                if(this.falling) {
                    if(this.flying) {
                        velocity.y = 8;
                    }
                } else {
                    velocity.y = 8;
                }
            } else {
                if(this.flying) {
                    velocity.y += -(15 * delta);
                    if(velocity.y < 0) {
                        velocity.y = 0;
                    }
                }
            }
            if(this.keys[KEY.SHIFT]) {
                if(this.flying) {
                    velocity.y = -8;
                }
            }
            if(this.keys[KEY.J] && !this.falling) {
                velocity.y = 20;
            }
            // Remove small changes
            if(Math.round(velocity.x * 100000) / 100000 == 0) velocity.x = 0;
            if(Math.round(velocity.y * 100000) / 100000 == 0) velocity.y = 0;
            if(Math.round(velocity.z * 100000) / 100000 == 0) velocity.z = 0;
            this.walking = (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1) && !this.flying;
            if(this.walking) {
                this.walking_frame += delta;
            }
            this.prev_walking = this.walking;

            // New walking
            let speed = 0;
            const SPEED_MUL = 0.4;
            let calcSpeed = (v) => {
                let passed = performance.now() - v;
                if(!this.flying) {
                    passed = 1000;
                } else if(passed < 500) {
                    passed = 500;
                }
                let resp = Math.max(speed, Math.min(passed / 1000, 1) * SPEED_MUL);
                return Math.min(resp, 5);
            }
            //
            if(this.keys[KEY.W] && !this.keys[KEY.S]) {
                speed = calcSpeed(this.keys[KEY.W]);
                velocity.x += Math.cos(Math.PI / 2 - this.angles[2]) * speed;
                velocity.z += Math.sin(Math.PI / 2 - this.angles[2]) * speed;
            }
            if(this.keys[KEY.S] && !this.keys[KEY.W]) {
                speed = calcSpeed(this.keys[KEY.S]);
                velocity.x += Math.cos(Math.PI + Math.PI / 2 - this.angles[2]) * speed;
                velocity.z += Math.sin(Math.PI + Math.PI / 2 - this.angles[2]) * speed;
            }
            if(this.keys[KEY.A] && !this.keys[KEY.D]) {
                speed = calcSpeed(this.keys[KEY.A]);
                velocity.x += Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[2]) * speed;
                velocity.z += Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[2]) * speed;
            }
            if(this.keys[KEY.D] && !this.keys[KEY.A]) {
                speed = calcSpeed(this.keys[KEY.D]);
                velocity.x += Math.cos(-Math.PI / 2 + Math.PI / 2 - this.angles[2]) * speed;
                velocity.z += Math.sin(-Math.PI / 2 + Math.PI / 2 - this.angles[2]) * speed;
            }

            let mul = 1;

            let y = delta / (1 / 60);
            let p = this.flying ? .97 : .9;
            p = (1 - (1 - p) * y);
            // x - (x - x * p) * y
            velocity.x *= p;
            velocity.z *= p;

            if(this.running) {
                mul *= this.flying ? 1.15 : 1.5;
            }

            velocity = velocity.mul(new Vector(mul, 1, mul));

            let current_speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

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
            // Resolve collision
            this.pos = this.resolveCollision(pos, bPos, velocity.mul(new Vector(delta, delta, delta)));
            this.pos.x = Math.round(this.pos.x * 1000) / 1000;
            this.pos.y = Math.round(this.pos.y * 1000) / 1000;
            this.pos.z = Math.round(this.pos.z * 1000) / 1000;
            //
            let playerBlockPos  = Game.world.localPlayer.getBlockPos();
            let chunkPos        = Game.world.chunkManager.getChunkPos(playerBlockPos.x, playerBlockPos.y, playerBlockPos.z);
            this.overChunk      = Game.world.chunkManager.getChunk(chunkPos);
        }
        this.lastUpdate = performance.now();
    }

    // Resolves collisions between the player and blocks on XY level for the next movement step.
    resolveCollision(pos, bPos, velocity) {
        let world = this.world;
        let v_margin = 0.3; // 0.125
        let size = 0.6; // 0.25
        let playerRect = {
            x: pos.x + velocity.x,
            y: pos.y + velocity.y,
            z: pos.z + velocity.z,
            size: size
        };
        let shiftPressed = !!this.keys[KEY.SHIFT] && !this.flying;
        // Collect XZ collision sides
        let collisionCandidates = [];
        if(!this.world.game_mode.isSpectator()) {
            for(let x = bPos.x - 1; x <= bPos.x + 1; x++) {
                for(let z = bPos.z - 1; z <= bPos.z + 1; z++) {
                    for(let y = bPos.y; y <= bPos.y + 1; y++) {
                        let block = world.chunkManager.getBlock(x, y, z);
                        // Позволяет не падать с края блоков, если зажат [Shift]
                        if(block.passable && shiftPressed && !this.flying && y == bPos.y) {
                            let blockUnder = world.chunkManager.getBlock(x, y - 1, z);
                            if(blockUnder.passable) {
                                if (!world.chunkManager.getBlock(x - 1, y - 1, z).passable) collisionCandidates.push({x: x + .5,      dir: -1,    z1: z, z2: z + 1});
                                if (!world.chunkManager.getBlock(x + 1, y - 1, z).passable) collisionCandidates.push({x: x + 1 - .5,  dir:  1,    z1: z, z2: z + 1});
                                if (!world.chunkManager.getBlock(x, y - 1, z - 1).passable) collisionCandidates.push({z: z + .5,      dir: -1,    x1: x, x2: x + 1});
                                if (!world.chunkManager.getBlock(x, y - 1, z + 1).passable) collisionCandidates.push({z: z + 1 - .5,  dir:  1,    x1: x, x2: x + 1});
                                continue;
                            }
                        }
                        if (!block.passable) {
                            if (world.chunkManager.getBlock(x - 1, y, z).passable) collisionCandidates.push({x: x,      dir: -1,    z1: z, z2: z + 1});
                            if (world.chunkManager.getBlock(x + 1, y, z).passable) collisionCandidates.push({x: x + 1,  dir:  1,    z1: z, z2: z + 1});
                            if (world.chunkManager.getBlock(x, y, z - 1).passable) collisionCandidates.push({z: z,      dir: -1,    x1: x, x2: x + 1});
                            if (world.chunkManager.getBlock(x, y, z + 1).passable) collisionCandidates.push({z: z + 1,  dir:  1,    x1: x, x2: x + 1});
                        }
                    }
                }
            }
        }
        // Solve XZ collisions
        for(let i in collisionCandidates)  {
            let side = collisionCandidates[i];
            if (Helpers.lineRectCollide(side, playerRect)) {
                if(side.x != null && velocity.x * side.dir < 0) {
                    pos.x = side.x + playerRect.size / 2 * (velocity.x > 0 ? -1 : 1);
                    velocity.x = 0;
                } else if(side.z != null && velocity.z * side.dir < 0) {
                    pos.z = side.z + playerRect.size / 2 * (velocity.z > 0 ? -1 : 1);
                    velocity.z = 0;
                }
            }
        }
        let falling = true;
        let playerFace = {
            x1: pos.x + velocity.x - v_margin,
            z1: pos.z + velocity.z - v_margin,
            x2: pos.x + velocity.x + v_margin,
            z2: pos.z + velocity.z + v_margin
        };
        let newBYLower = Math.floor(pos.y + velocity.y);
        let newBYUpper = Math.floor(pos.y + this.height + velocity.y * 1.1);
        // Collect Y collision sides
        collisionCandidates = [];
        if(!this.world.game_mode.isSpectator()) {
            for(let x = bPos.x - 1; x <= bPos.x + 1; x++) {
                for(let z = bPos.z - 1; z <= bPos.z + 1; z++) {
                    if (!world.chunkManager.getBlock(x, newBYLower, z).passable)
                        collisionCandidates.push({y: newBYLower + 1, dir: 1, x1: x, z1: z, x2: x + 1, z2: z + 1});
                    if (!world.chunkManager.getBlock( x, newBYUpper, z).passable)
                        collisionCandidates.push({y: newBYUpper, dir: -1, x1: x, z1: z, x2: x + 1, z2: z + 1});
                }
            }
        }
        // Solve Y collisions
        for(let i in collisionCandidates) {
            let face = collisionCandidates[i];
            if (Helpers.rectRectCollide(face, playerFace) && velocity.y * face.dir < 0) {
                if(velocity.y < 0) {
                    falling         = false;
                    pos.y           = face.y;
                    velocity.y      = 0;
                    this.velocity.y = 0;
                } else {
                    pos.y           = face.y - this.height;
                    velocity.y      = 0;
                    this.velocity.y = 0;
                }
                break;
            }
        }
        this.falling = falling;
        if(!falling && this.flying) {
            this.flying = false;
        }
        // Return solution
        // velocity.y = 0;
        return pos.add(velocity);
    }

}