import Chat from "./chat.js";
import {Helpers, Vector} from "./helpers.js";
import {BLOCK} from "./blocks.js";

// ==========================================
// Player
// This class contains the code that manages the local player.
// ==========================================

const PLAYER_HEIGHT     = 1.8;

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
        this.keys_fired             = {down: {}, up: {}};
        this.eventHandlers          = {};
        this.pos                    = world.saved_state ? new Vector(world.saved_state.pos.x, world.saved_state.pos.y, world.saved_state.pos.z) : world.spawnPoint;
        if(world.saved_state) {
            this.flying = !!world.saved_state.flying;
        }
        this.overChunk              = null;
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
        let canvas = this.canvas = document.getElementById( id );
        let t = this;
        document.onkeydown = function(e) {
            if (e.target.tagName != 'INPUT') {
                if(t._onKeyEvent(e, e.keyCode, true)) {
                    return false;
                }
            }
            if (e.ctrlKey) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        }
        document.onkeyup = function(e) {
            if (e.target.tagName != 'INPUT') {
                if(t._onKeyEvent(e, e.keyCode, false)) {
                    return false;
                }
            }
        }
        document.onkeypress = function(e) {
            if(t.onKeyPress(e)) {
                return false;
            }
        }
        canvas.onmousedown  = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.DOWN, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
        canvas.onmouseup    = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.UP, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
        canvas.onmousemove  = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.MOVE, e.which, e.shiftKey); return false; }
        canvas.onclick      = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.CLICK, e.which, e.shiftKey); return false; }
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
    _onKeyEvent(e, keyCode, down) {

        let resp = null;

        if(down) {
            if(this.keys_fired.up[keyCode]) {
                this.keys_fired.up[keyCode] = false;
            }
            let first_press = this.keys_fired.down[keyCode];
            resp = this.onKeyEvent(e, keyCode, down, !first_press);
            this.keys_fired.down[keyCode] = true;
        } else {
            if(this.keys_fired.down[keyCode]) {
                this.keys_fired.down[keyCode] = false;
            }
            let first_press = this.keys_fired.up[keyCode];
            resp = this.onKeyEvent(e, keyCode, down, !first_press);
            this.keys_fired.up[keyCode] = true;
        }

        return resp;

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

        //
        if(keyCode == KEY.PAGE_UP) {
            if(down) {
                Game.world.chunkManager.setRenderDist(Game.world.chunkManager.CHUNK_RENDER_DIST + 1);
            }
        }

        //
        if(keyCode == KEY.PAGE_DOWN) {
            if(down) {
                Game.world.chunkManager.setRenderDist(Game.world.chunkManager.CHUNK_RENDER_DIST - 1);
            }
        }

        //
        if(keyCode == KEY.SPACE) {
            if(this.velocity.y > 0) {
                if(down && first && !this.flying) {
                    console.log('flying');
                    this.velocity.y = 0;
                    this.flying = true;
                }
            }
        }

        this.keys[keyCode] = down;
        this.zoom = this.keys[KEY.C];

        switch(keyCode) {
            // F1
            case KEY.F1: {
                if(!down) {
                    Game.hud.toggleActive();
                }
                return true;
                break;
            }
            // F2 (Save)
            case KEY.F2: {
                if(!down) {
                    Game.world.saveToDB();
                    this.chat.messages.addSystem('Saved ... OK');
                }
                return true;
                break;
            }
            // F3 (Set spawnpoint)
            case KEY.F3: {
                if(!down) {
                    Game.hud.draw_info = !Game.hud.draw_info;
                }
                return true;
                break;
            }
            // F4 (Draw all blocks)
            case KEY.F4: {
                if(!down) {
                    if(e.shiftKey) {
                        let z = Math.round(Game.player.pos.z);
                        let x, startx = Math.round(Game.player.pos.x);
                        let y = Math.round(Game.player.pos.y);
                        let d = 10;
                        let cnt = 0;
                        for(let i = 0; i < Game.player.inventory.all.length; i++) {
                            if(Game.player.inventory.all[i].fluid) {
                                continue;
                            }
                            if(cnt % d == 0) {
                                x = startx;
                                y = y - 2;
                            }
                            x = x - 2;
                            Game.player.inventory.select(i);
                            Game.world.setBlock(x, y, z, Game.player.inventory.all[i]);
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
            // F7 (Export world)
            case KEY.F7: {
                if(!down) {
                    if(e.shiftKey) {
                        Game.world.createClone();
                    } else {
                        Game.world.exportJSON();
                    }
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
                    Game.world.chunkManager.toggleUpdateChunks();
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
            /*
            default: {
                if(!down) {
                    if(this.chat.active) {
                        this.chat.keyPress(keyCode);
                        return;
                    }
                }
                break;
            }*/
        }
        // 0...9 (Select material)
        if(!down && (keyCode >= 48 && keyCode <= 57)) {
            if(keyCode == 48) {
                keyCode = 58;
            }
            Game.inventory.select(keyCode - 49);
            return true;
        }
        // running
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
                    // Game.render.fov = 90; // setPerspective(85, 0.01, RENDER_DISTANCE);
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
        if (type == MOUSE.DOWN) {
            this.doBlockAction(button_id, shiftKey);
        }
    }

    // Called to perform an action based on the player's block selection and input.
    doBlockAction(button_id, shiftKey) {
        let that            = this;
        let destroyBlock    = button_id == 1;
        let cloneBlock      = button_id == 2;
        let createBlock     = button_id == 3;
        let world           = this.world;
        const playerRotate  = Game.world.rotateDegree;

        if (!this.canvas.renderer.pickAt) {
            return;
        }

        this.canvas.renderer.pickAt.get(function(block) {
            if(block != false) {
                let world_block = that.world.chunkManager.getBlock(block.x, block.y, block.z);
                let playerPos = that.getBlockPos();
                if(createBlock) {
                    if([BLOCK.CRAFTING_TABLE.id, BLOCK.CHEST.id, BLOCK.FURNACE.id, BLOCK.BURNING_FURNACE.id].indexOf(world_block.id) >= 0) {
                        if(!shiftKey) {
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
                            return;
                        }
                    }
                    if(playerPos.x == block.x && playerPos.z == block.z && (block.y >= playerPos.y - 1 || block.y <= playerPos.y + 1)) {
                        // block is occupied by player
                        return;
                    }
                    if(!that.buildMaterial || that.inventory.getCurrent().count < 1) {
                        return;
                    }
                    let matBlock = BLOCK.fromId(that.buildMaterial.id);
                    if(world_block && (world_block.fluid || world_block.id == BLOCK.GRASS.id)) {
                        // Replace block
                        if(matBlock.is_item || matBlock.is_entity) {
                            if(matBlock.is_entity) {
                                Game.world.server.CreateEntity(matBlock.id, new Vector(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z), playerRotate);
                            }
                        } else {
                            world.setBlock(block.x, block.y, block.z, that.buildMaterial, null, playerRotate);
                        }
                    } else {
                        // Create block
                        let blockUnder = that.world.chunkManager.getBlock(block.x + block.n.x, block.y + block.n.y - 1, block.z + block.n.z + 1);
                        if(BLOCK.isPlants(that.buildMaterial.id) && blockUnder.id != BLOCK.DIRT.id) {
                            return;
                        }
                        if(matBlock.is_item || matBlock.is_entity) {
                            if(matBlock.is_entity) {
                                Game.world.server.CreateEntity(matBlock.id, new Vector(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z), playerRotate);
                                let b = BLOCK.fromId(that.buildMaterial.id);
                                if(b.sound) {
                                    Game.sounds.play(b.sound, 'place');
                                }
                            }
                        } else {
                            if(['ladder'].indexOf(that.buildMaterial.style) >= 0) {
                                if(block.n.z != 0 || world_block.transparent) {
                                    return;
                                }
                            }
                            world.setBlock(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z, that.buildMaterial, null, playerRotate);
                        }
                    }
                    that.inventory.decrement();
                } else if(destroyBlock) {
                    // Destroy block
                    if(world_block.id != BLOCK.BEDROCK.id && world_block.id != BLOCK.STILL_WATER.id) {
                        world.chunkManager.destroyBlock(block, true);
                        if(world_block.id == BLOCK.CONCRETE.id) {
                            world_block = BLOCK.fromId(BLOCK.COBBLESTONE.id);
                        }
                        if([BLOCK.GRASS.id, BLOCK.CHEST.id].indexOf(world_block.id) < 0) {
                            that.inventory.increment(Object.assign({count: 1}, world_block));
                        }
                        let block_over = that.world.chunkManager.getBlock(block.x, block.y + 1, block.z);
                        // delete plant over deleted block
                        if(BLOCK.isPlants(block_over.id)) {
                            block.y++;
                            world.chunkManager.destroyBlock(block, true);
                        }
                    }
                } else if(cloneBlock) {
                    if(world_block) {
                        that.inventory.cloneMaterial(world_block);
                    }
                }
            }
        });
    }

    // Returns the position of the eyes of the player for rendering.
    getEyePos() {
        return this.pos.add(new Vector(0.0, this.height, 0.0));
    }

    // getBlockPos
    getBlockPos() {
        let v = new Vector(
            parseInt(this.pos.x),
            parseInt(this.pos.y),
            parseInt(this.pos.z)
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
            Math.floor(pos.x),
            Math.floor(pos.y),
            Math.floor(pos.z)
        );

        const {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, FOV_CHANGE_SPEED, RENDER_DISTANCE} = Game.render.options;

        if(this.lastUpdate != null) {
            // let delta = ( new Date().getTime() - this.lastUpdate ) / 1000;
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
            if(Math.round(velocity.x * 100000) / 100000 == 0) velocity.x = 0;
            if(Math.round(velocity.y * 100000) / 100000 == 0) velocity.y = 0;
            if(Math.round(velocity.z * 100000) / 100000 == 0) velocity.z = 0;
            this.walking = (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1) && !this.flying;
            if(this.prev_walking != this.walking) {
                // @toggle walking
                // this.walking_frame = 0;
            }
            if(this.walking) {
                this.walking_frame += delta;
                // console.log('this.walking_frame', Math.round(this.walking_frame * 1000) / 1000);
            } else {
                /*if(this.walking_frame != 0) {
                    this.walking_frame += delta;
                    if(Math.round(Math.cos(this.walking_frame * 15) * 100) / 100 == 0) {
                        this.walking_frame = 0;
                    }
                }*/
            }
            this.prev_walking = this.walking;
            // Walking
            let walkVelocity = new Vector(0, 0, 0);
            if (!this.falling || this.flying) {
                if(this.keys[KEY.W] && !this.keys[KEY.S]) {
                    walkVelocity.x += Math.cos(Math.PI / 2 - this.angles[2]);
                    walkVelocity.z += Math.sin(Math.PI / 2 - this.angles[2]);
                }
                if(this.keys[KEY.S] && !this.keys[KEY.W]) {
                    walkVelocity.x += Math.cos(Math.PI + Math.PI / 2 - this.angles[2]);
                    walkVelocity.z += Math.sin(Math.PI + Math.PI / 2 - this.angles[2]);
                }
                if(this.keys[KEY.A] && !this.keys[KEY.D]) {
                    walkVelocity.x += Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[2]);
                    walkVelocity.z += Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[2]);
                }
                if(this.keys[KEY.D] && !this.keys[KEY.A]) {
                    walkVelocity.x += Math.cos(-Math.PI / 2 + Math.PI / 2 - this.angles[2]);
                    walkVelocity.z += Math.sin(-Math.PI / 2 + Math.PI / 2 - this.angles[2]);
                }
            }

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
            if(walkVelocity.length() > 0) {
                let mul = 1; // this.flying ? 1 : 1;
                if(this.running) {
                    mul *= 1.5;
                    if(this.flying) {
                        mul *= 2.0;
                    }
                }
                walkVelocity = walkVelocity.normal();
                velocity.x = walkVelocity.x * 4 * mul;
                velocity.z = walkVelocity.z * 4 * mul;
            } else {
                // энерция торможения разная
                velocity.x /= this.falling ? 1.01 : 1.5;
                velocity.z /= this.falling ? 1.01 : 1.5;
            }
            // Resolve collision
            this.pos = this.resolveCollision(pos, bPos, velocity.mul(new Vector(delta, delta, delta)));
            this.pos.x = Math.round(this.pos.x * 1000) / 1000;
            this.pos.y = Math.round(this.pos.y * 1000) / 1000;
            this.pos.z = Math.round(this.pos.z * 1000) / 1000;
            // this.pos.y = Math.max(this.pos.y, 100);
            //
            let playerBlockPos  = Game.world.localPlayer.getBlockPos();
            let chunkPos        = Game.world.chunkManager.getChunkPos(playerBlockPos.x, playerBlockPos.y, playerBlockPos.z);
            this.overChunk      = Game.world.chunkManager.getChunk(chunkPos);
        }
        this.lastUpdate = performance.now(); // new Date().getTime();
    }

    // Resolves collisions between the player and blocks on XY level for the next movement step.
    resolveCollision(pos, bPos, velocity) {
        let world = this.world;
        let playerRect = {
            x: pos.x + velocity.x,
            y: pos.y + velocity.y,
            z: pos.z + velocity.z,
            size: 0.25
        };
        const shiftPressed = !!this.keys[KEY.SHIFT];
        // Collect XZ collision sides
        let collisionCandidates = [];
        for(let x = bPos.x - 1; x <= bPos.x + 1; x++) {
            for(let z = bPos.z - 1; z <= bPos.z + 1; z++) {
                for(let y = bPos.y; y <= bPos.y + 1; y++) {
                    let block = world.chunkManager.getBlock(x, y, z);
                    // Позволяет не падать с края блоков, если зажат [Shift]
                    if(block.passable && shiftPressed && !this.flying && y == bPos.y) {
                        let blockUnder = world.chunkManager.getBlock(x, y - 1, z);
                        if(blockUnder.passable) {
                            if (!world.chunkManager.getBlock(x - 1, y - 1, z).passable) collisionCandidates.push({x: x,      dir: -1,    z1: z, z2: z + 1});
                            if (!world.chunkManager.getBlock(x + 1, y - 1, z).passable) collisionCandidates.push({x: x + 1,  dir:  1,    z1: z, z2: z + 1});
                            if (!world.chunkManager.getBlock(x, y - 1, z - 1).passable) collisionCandidates.push({z: z,      dir: -1,    x1: x, x2: x + 1});
                            if (!world.chunkManager.getBlock(x, y - 1, z + 1).passable) collisionCandidates.push({z: z + 1,  dir:  1,    x1: x, x2: x + 1});
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
        // Solve XZ collisions
        for(let i in collisionCandidates)  {
            let side = collisionCandidates[i];
            if (Helpers.lineRectCollide(side, playerRect)) {
                if(side.x != null && velocity.x * side.dir < 0) {
                    pos.x = side.x + playerRect.size / 2 * ( velocity.x > 0 ? -1 : 1);
                    velocity.x = 0;
                } else if(side.z != null && velocity.z * side.dir < 0) {
                    pos.z = side.z + playerRect.size / 2 * ( velocity.z > 0 ? -1 : 1);
                    velocity.z = 0;
                }
            }
        }
        let falling = true;
        let playerFace = {
            x1: pos.x + velocity.x - 0.125,
            z1: pos.z + velocity.z - 0.125,
            x2: pos.x + velocity.x + 0.125,
            z2: pos.z + velocity.z + 0.125
        };
        let newBYLower = Math.floor(pos.y + velocity.y);
        let newBYUpper = Math.floor(pos.y + this.height + velocity.y * 1.1);
        // Collect Y collision sides
        collisionCandidates = [];
        for(let x = bPos.x - 1; x <= bPos.x + 1; x++) {
            for(let z = bPos.z - 1; z <= bPos.z + 1; z++) {
                if (!world.chunkManager.getBlock(x, newBYLower, z).passable)
                    collisionCandidates.push({y: newBYLower + 1, dir: 1, x1: x, z1: z, x2: x + 1, z2: z + 1});
                if (!world.chunkManager.getBlock( x, newBYUpper, z).passable)
                    collisionCandidates.push({y: newBYUpper, dir: -1, x1: x, z1: z, x2: x + 1, z2: z + 1});
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
