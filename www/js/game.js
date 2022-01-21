import {World} from "./world.js";
import {Renderer, ZOOM_FACTOR} from "./render.js";
import {Vector, AverageClockTimer} from "./helpers.js";
import {BLOCK} from "./blocks.js";
import {Resources} from "./resources.js";
import {ServerClient} from "./server_client.js";
import {HUD} from "./hud.js";
import {Sounds} from "./sounds.js";
import {Kb} from "./kb.js";
import {Hotbar} from "./hotbar.js";

const RES_SCALE = Math.max(Math.round(window.screen.availWidth * 0.2 / 352), 1);
globalThis.UI_ZOOM = Math.max(Math.round(window.devicePixelRatio), 1) * RES_SCALE;

console.log(UI_ZOOM, RES_SCALE);

export class GameClass {

    constructor() {
        this.is_server  = false;
        this.hud        = new HUD(0, 0);
        this.hotbar     = new Hotbar(this.hud);
        this.render     = new Renderer('renderSurface');
        this.current_player_state = {
            rotate:             new Vector(),
            pos:                new Vector(),
            ping:               0
        };
    }

    // Start
    async Start(server_url, world_guid, settings, resource_loading_progress) {
        // Load resources
        Resources.onLoading = resource_loading_progress;
        await Resources.load({
            imageBitmap:    true,
            glsl:           this.render.renderBackend.kind === 'webgl',
            wgsl:           this.render.renderBackend.kind === 'webgpu'
        });
        //
        await BLOCK.init(settings);
        // Create world
        this.world = new World(settings);
        await this.render.init(this.world, settings);
        let ws = new WebSocket(server_url + '?session_id=' + this.App.session.session_id + '&skin=' + this.skin.id + '&world_guid=' + world_guid);
        await this.world.connectToServer(ws);
        return this.world;
    }

    // Started...
    Started(player) {
        this.sounds             = new Sounds();
        this.player             = player;
        this.averageClockTimer  = new AverageClockTimer();
        this.block_manager      = BLOCK;
        this.prev_player_state  = null;
        //
        this.render.setPlayer(player);
        this.setInputCanvas('renderSurface');
        this.setupMousePointer(false);
        this.setupMouseListeners();
        //
        let bodyClassList = document.querySelector('body').classList;
        bodyClassList.add('started');
        // Run render loop
        this.loop = this.loop.bind(this);

        this.render.requestAnimationFrame(this.loop);
    }

    // Set the canvas the renderer uses for some input operations.
    setInputCanvas(element_id) {
        let player = this.player;
        let canvas = document.getElementById(element_id);
        let kb = this.kb = new Kb(canvas, {
            onPaste: (e) => {
                let clipboardData = e.clipboardData || window.clipboardData;
                if(clipboardData) {
                    let pastedData = clipboardData.getData('Text');
                    if(pastedData) {
                        player.chat.pasteText(pastedData);
                    }
                }
                return true;
            },
            onMouseEvent: (e, x, y, type, button_id, shiftKey) => {
                const hasVisibleWindow = this.hud.wm.hasVisibleWindow();
                if(type == MOUSE.DOWN && hasVisibleWindow) {
                    this.hud.wm.mouseEventDispatcher({
                        type:       e.type,
                        shiftKey:   e.shiftKey,
                        button:     e.button,
                        offsetX:    this.player.controls.mouseX * (this.hud.width / this.render.canvas.width),
                        offsetY:    this.player.controls.mouseY * (this.hud.height / this.render.canvas.height)
                    });
                    return false;
                }
                if(!this.player.controls.enabled || player.chat.active || hasVisibleWindow) {
                    return false
                }
                return player.onMouseEvent({type: type, button_id: button_id, shiftKey: shiftKey});
            },
            // Hook for keyboard input
            onKeyPress: (e) => {
                let charCode = (typeof e.which == 'number') ? e.which : e.keyCode;
                let typedChar = String.fromCharCode(charCode);
                player.chat.typeChar(charCode, typedChar);
            },
            // Hook for keyboard input
            onKeyEvent: (e) => {
                // Chat
                if(player.chat.active) {
                    player.chat.onKeyEvent(e);
                    return false;
                }
                // Windows
                if(this.hud.wm.hasVisibleWindow()) {
                    switch(e.keyCode) {
                        // E (Inventory)
                        case KEY.ESC:
                        case KEY.E: {
                            if(!e.down) {
                                this.hud.wm.closeAll();
                                this.setupMousePointer(false);
                                return true;
                            }
                            break;
                        }
                    }
                    return;
                }
                //
                switch(e.keyCode) {
                    // Page Up
                    case KEY.PAGE_UP: {
                        if(e.down) {
                            this.world.chunkManager.setRenderDist(player.state.chunk_render_dist + 1);
                        }
                        return true;
                        break;
                    }
                    // Set render distance [Page Down]
                    case KEY.PAGE_DOWN: {
                        if(e.down) {
                            this.world.chunkManager.setRenderDist(player.state.chunk_render_dist - 1);
                        }
                        return true;
                        break;
                    }
                    case KEY.SLASH: {
                        if(!e.down) {
                            if(!player.chat.active) {
                                player.chat.open(['/']);
                            }
                        }
                        return true;
                        break;
                    }
                    // [F1]
                    case KEY.F1: {
                        if(!e.down) {
                            this.hud.toggleActive();
                        }
                        return true;
                        break;
                    }
                    // [F2]
                    /*case KEY.F2: {
                        if(!e.down) {
                            this.render.screenshot();
                        }
                        return true;
                        break;
                    }*/
                    // [F3] Toggle info
                    case KEY.F3: {
                        if(!e.down) {
                            this.hud.toggleInfo();
                        }
                        return true;
                        break;
                    }
                    // [F4] Draw all blocks
                    case KEY.F4: {
                        if(!e.down) {
                            if(e.shiftKey) {
                                this.world.chunkManager.setTestBlocks(new Vector((player.pos.x | 0) - 11, player.pos.y | 0, (player.pos.z | 0) - 13));
                            } else {
                                player.changeSpawnpoint();
                            }
                        }
                        return true;
                        break;
                    }
                    // [F6] (Test light)
                    case KEY.F6: {
                        if(!e.down) {
                            this.render.testLightOn = !this.render.testLightOn;
                        }
                        return true;
                        break;
                    }
                    // [F7] Ddraw player "ghost"
                    case KEY.F7: {
                        if(!e.down) {
                            this.world.players.drawGhost(this.player);
                        }
                        return true;
                        break;
                    }
                    // [F8] Random teleport
                    case KEY.F8: {
                        if(!e.down) {
                            if(e.shiftKey) {
                                player.pickAt.get(player.pos, (pos) => {
                                    if(pos !== false) {
                                        if(pos.n.x != 0) pos.x += pos.n.x;
                                        if(pos.n.z != 0) pos.z += pos.n.z;
                                        if(pos.n.y != 0) {
                                            pos.y += pos.n.y;
                                            if(pos.n.y < 0) pos.y--;
                                        }
                                        player.teleport(null, pos);
                                    }
                                }, 1000);
                            } else {
                                player.teleport('random', null);
                            }
                        }
                        return true;
                        break;
                    }
                    // F9 (toggleNight | Under rain)
                    case KEY.F9: {
                        if(!e.down) {
                            this.render.toggleNight();
                        }
                        return true;
                        break;
                    }
                    // F10 (toggleUpdateChunks)
                    case KEY.F10: {
                        if(!e.down) {
                            player.world.server.GameModeNext();
                        }
                        return true;
                        break;
                    }
                    // R (Respawn)
                    case KEY.R: {
                        if(!e.down) {
                            this.player.world.server.Teleport('spawn');
                        }
                        return true;
                        break;
                    }
                    // Q (Drop item)
                    case KEY.Q: {
                        if(!e.down) {
                            this.player.world.server.DropItem();
                        }
                        return true;
                        break;
                    }
                    // E (Inventory)
                    case KEY.E: {
                        if(!e.down) {
                            if(!this.hud.wm.hasVisibleWindow()) {
                                player.inventory.open();
                                return true;
                            }
                        }
                        break;
                    }
                    // T (Open chat)
                    case KEY.T: {
                        if(!e.down) {
                            if(!player.chat.active) {
                                player.chat.open([]);
                            }
                        }
                        return true;
                        break;
                    }
                }
                // Player controls
                if(kb.keys[e.keyCode] && e.down) {
                    // do nothing
                } else {
                    kb.keys[e.keyCode] = e.down ? performance.now() : false;
                }
                player.controls.back    = !!(kb.keys[KEY.S] && !kb.keys[KEY.W]);
                player.controls.forward = !!(kb.keys[KEY.W] && !kb.keys[KEY.S]);
                player.controls.right   = !!(kb.keys[KEY.D] && !kb.keys[KEY.A]);
                player.controls.left    = !!(kb.keys[KEY.A] && !kb.keys[KEY.D]);
                player.controls.jump    = !!(kb.keys[KEY.SPACE]);
                player.controls.sneak   = e.shiftKey;
                // 0...9 (Select material)
                if(!e.down && (e.keyCode >= 48 && e.keyCode <= 57)) {
                    if(e.keyCode == 48) {
                        e.keyCode = 58;
                    }
                    player.inventory.select(e.keyCode - 49);
                    return true;
                }
                player.zoom = !!kb.keys[KEY.C];
                if(e.ctrlKey) {
                    player.controls.sprint = !!kb.keys[KEY.W];
                } else {
                    if(!e.down) {
                        if(e.keyCode == KEY.W) {
                            player.controls.sprint = false;
                        }
                    }
                }
                return false;
            },
            onDoubleKeyDown: (e) => {
                if(e.keyCode == KEY.W) {
                    player.controls.sprint = true;
                } else if (e.keyCode == KEY.SPACE) {
                    if(player.game_mode.canFly() && !player.in_water && !player.onGround) {
                        if(player.getFlying()) {
                            player.setFlying(false);
                        } else {
                            player.setFlying(true);
                        }
                    }
                }
            }
        });

    }

    // setControlsEnabled
    setControlsEnabled(value) {
        this.player.controls.enabled = value;
        let bodyClassList = document.querySelector('body').classList;
        if(value) {
            bodyClassList.add('controls_enabled');
        } else {
            bodyClassList.remove('controls_enabled');
        }
    }

    /**
     * Main loop
     * @param {number} time 
     * @param  {...any} args - args from raf, because it necessary for XR
     */
    loop(time = 0, ...args) {
        let player  = this.player;
        let tm      = performance.now();
        let delta   = this.hud.FPS.delta;

        if(this.player.controls.enabled && !this.hud.splash.loading) {
            // Simulate physics
            this.world.physics.simulate();
            // Update local player
            player.update();
        } else {
            player.lastUpdate = null;
        }

        this.world.chunkManager.update(player.pos);

        // Picking target
        if (player.pickAt && Game.hud.active && player.game_mode.canBlockAction()) {
            player.pickAt.update(player.pos, player.game_mode.getPickatDistance());
        }

        // change camera location
        this.render.setCamera(player, player.getEyePos(), player.rotate);

        // Update world
        // this is necessary
        // because there are a cases when we should call draw without update
        // or update without draw
        // like XR, it quiery frame more that 60 fps (90, 120) and we shpuld render each frame
        // but update can be called slowly
        this.render.update(delta, args);

        // Draw world
        this.render.draw(delta, args);

        // Send player state
        this.sendPlayerState(player);

        // Счетчик FPS
        this.hud.FPS.incr();
        this.averageClockTimer.add(performance.now() - tm);

        // we must request valid loop
        this.render.requestAnimationFrame(this.loop);
    }

    // Отправка информации о позиции и ориентации игрока на сервер
    sendPlayerState(player) {
        this.current_player_state.rotate.set(player.rotate.x, player.rotate.y, player.rotate.z);
        this.current_player_state.pos.set(Math.round(player.lerpPos.x * 1000) / 1000, Math.round(player.lerpPos.y * 1000) / 1000, Math.round(player.lerpPos.z * 1000) / 1000);
        this.ping = Math.round(this.player.world.server.ping_value);
        let current_player_state_json = JSON.stringify(this.current_player_state);
        if(current_player_state_json != this.prev_player_state) {
            this.prev_player_state = current_player_state_json;
            this.player.world.server.Send({
                name: ServerClient.CMD_PLAYER_STATE,
                data: this.current_player_state
            });
        }
    }

    // releaseMousePointer
    releaseMousePointer() {
        try {
            // this.render.canvas.exitPointerLock();
            // Attempt to unlock
            document.exitPointerLock();
        } catch(e) {
            console.error(e);
        }
    }

    // setupMousePointer...
    setupMousePointer(check_opened_windows) {
        if(check_opened_windows && this.hud.wm.hasVisibleWindow()) {
            return;
        }

        if(!this.world || this.player.controls.enabled) {
            return;
        }

        const element = this.render.canvas;
        element.requestPointerLock = element.requestPointerLock || element.webkitRequestPointerLock;

        if(this.player.controls.inited) {
            element.requestPointerLock();
            return;
        }

        const pointerlockchange = (event) => {

            if (document.pointerLockElement === element || document.webkitPointerLockElement === element) {
                this.setControlsEnabled(true);
            }  else {
                this.setControlsEnabled(false);
                this.kb.clearStates();

                if(!this.hud.wm.hasVisibleWindow() && !this.player.chat.active) {

                    // Safari emit ESC keyup since ~100 ms after pointer lock left event
                    // we should skip this ESC
                    // otherwise we never can open mine menu
                    this.kb.skipUntil(200);
                    this.hud.frmMainMenu.show();
                }

            }
        }

        const pointerlockerror = function(event) {
            console.error('Error setting pointer lock!', event);
        }

        // Hook pointer lock state change events
        document.addEventListener('pointerlockchange', pointerlockchange, false);
        document.addEventListener('mozpointerlockchange', pointerlockchange, false);
        document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
        document.addEventListener('pointerlockerror', pointerlockerror, false);
        document.addEventListener('mozpointerlockerror', pointerlockerror, false);
        document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

        element.requestPointerLock();
        this.player.controls.inited = true;
    }

    // setupMouseListeners...
    setupMouseListeners() {
        let that = this;
        // Mouse wheel
        document.addEventListener('wheel', function(e) {
            if(e.ctrlKey) return;
            if(that.player) {
                //
                if(that.player.controls.enabled) {
                    that.player.onScroll(e.deltaY > 0);
                }
                //
                if(that.hud.wm.hasVisibleWindow()) {
                    that.hud.wm.mouseEventDispatcher({
                        original_event:     e,
                        type:               e.type,
                        shiftKey:           e.shiftKey,
                        button:             e.button,
                        offsetX:            that.player.controls.mouseX * (that.hud.width / that.render.canvas.width),
                        offsetY:            that.player.controls.mouseY * (that.hud.height / that.render.canvas.height)
                    });
                }
            }
        });
        // Mouse move
        let add_mouse_rotate = new Vector();
        document.addEventListener('mousemove', function(e) {
            let controls = that.player.controls;
            let z = e.movementX;
            let x = e.movementY;
            if(that.hud.wm.hasVisibleWindow()) {
            	if(controls.enabled) {
                    controls.mouseY += x;
                    controls.mouseX += z;
                    controls.mouseX = Math.max(controls.mouseX, 0);
                    controls.mouseY = Math.max(controls.mouseY, 0);
                    controls.mouseX = Math.min(controls.mouseX, that.hud.width);
                    controls.mouseY = Math.min(controls.mouseY, that.hud.height);
                } else {
                    controls.mouseY = e.offsetY * window.devicePixelRatio;
                    controls.mouseX = e.offsetX * window.devicePixelRatio;
                }
                //
                that.hud.wm.mouseEventDispatcher({
                    type:       e.type,
                    shiftKey:   e.shiftKey,
                    button:     e.button,
                    offsetX:    controls.mouseX * (that.hud.width / that.render.canvas.width),
                    offsetY:    controls.mouseY * (that.hud.height / that.render.canvas.height)
                });
            } else {
                x *= -1;
                add_mouse_rotate.x = (x / window.devicePixelRatio) * controls.mouse_sensitivity;
                add_mouse_rotate.z = (z / window.devicePixelRatio) * controls.mouse_sensitivity;
                if(that.player.zoom) {
                    add_mouse_rotate.x *= ZOOM_FACTOR * 0.5;
                    add_mouse_rotate.z *= ZOOM_FACTOR * 0.5;
                }
                that.player.addRotate(add_mouse_rotate.divScalar(900));
            }
        }, false);
    }

    drawInstruments() {
        let instruments = [];
        for(let block of this.block_manager.getAll().values()) {
            if(block.item?.instrument_id) {
                instruments.push({
                    id:                 block.id,
                    name:               block.name,
                    material:           block.material.id,
                    instrument_id:      block.item.instrument_id,
                    instrument_boost:   block.material.mining.instrument_boost,
                    power:              block.power,
                    item:               JSON.stringify(block.item),
                    texture:            JSON.stringify(block.texture)
                });
            }
        }
        console.table(instruments);
    }

    // drawPerf
    drawPerf() {
        var timers = [
            {name: 'init', min: 99999, max: 0, avg: 0, total: 0},
            {name: 'generate_terrain', min: 99999, max: 0, avg: 0, total: 0},
            {name: 'apply_modify', min: 99999, max: 0, avg: 0, total: 0},
            {name: 'build_vertices', min: 99999, max: 0, avg: 0, total: 0}
        ];
        var cnt = 0;
        for(let chunk of this.world.chunkManager.chunks.values()) {
            if(chunk.timers) {
                cnt++;
                for(var tim of timers) {
                    var t = chunk.timers[tim.name];
                    if(t < tim.min) tim.min = t;
                    if(t > tim.max) tim.max = t;
                    tim.total += t;
                }
            }
        }
        for(var tim of timers) {
            tim.avg = Math.round(tim.total / cnt * 100) / 100;
            tim.total = Math.round(tim.total * 100) / 100;
            tim.cnt = cnt;
        }
        console.table(timers);
    }

}