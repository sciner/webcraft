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

export class GameClass {

    constructor() {
        this.is_server  = false;
        this.hud        = new HUD(0, 0);
        this.hotbar     = new Hotbar(this.hud);
        this.render     = new Renderer('renderSurface');
    }

    // Start
    async Start(server_url, world_guid, settings, resource_loading_progress) {
        // Load resources
        Resources.onLoading = resource_loading_progress;
        await Resources.load({
            imageBitmap:    true,
            texture_pack:   settings.texture_pack,
            glsl:           this.render.renderBackend.kind === 'webgl',
            wgsl:           this.render.renderBackend.kind === 'webgpu'
        });
        //
        await BLOCK.init();
        // Create world
        this.world = new World();
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
        window.requestAnimationFrame(this.loop);
    }

    // Set the canvas the renderer uses for some input operations.
    setInputCanvas(element_id) {
        let player = this.player;
        let canvas = document.getElementById(element_id);
        this.kb = new Kb(canvas, {
            onMouseEvent: (e, x, y, type, button_id, shiftKey) => {
                let visibleWindows = this.hud.wm.getVisibleWindows();
                if(type == MOUSE.DOWN && visibleWindows.length > 0) {
                    this.hud.wm.mouseEventDispatcher({
                        type:       e.type,
                        shiftKey:   e.shiftKey,
                        button:     e.button,
                        offsetX:    this.player.controls.mouseX * (this.hud.width / this.render.canvas.width),
                        offsetY:    this.player.controls.mouseY * (this.hud.height / this.render.canvas.height)
                    });
                    return false;
                }
                if(!this.player.controls.enabled || player.chat.active || visibleWindows.length > 0) {
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
            onKeyEvent: (e, keyCode, down, first) => {
                e = {
                    keyCode: keyCode,
                    down: down,
                    first: first,
                    shiftKey: e.shiftKey,
                    ctrlKey: e.ctrlKey
                }
                // Chat
                if(player.chat.active) {
                    player.chat.onKeyEvent(e);
                    return false;
                }
                // Windows
                let vw = this.hud.wm.getVisibleWindows();
                if(vw.length > 0) {
                    switch(keyCode) {
                        // E (Inventory)
                        case KEY.ESC:
                        case KEY.E: {
                            if(!down) {
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
                switch(keyCode) {
                    // Page Up
                    case KEY.PAGE_UP: {
                        if(down) {
                            this.world.chunkManager.setRenderDist(player.state.chunk_render_dist + 1);
                        }
                        break;
                    }
                    // Set render distance [Page Down]
                    case KEY.PAGE_DOWN: {
                        if(down) {
                            this.world.chunkManager.setRenderDist(player.state.chunk_render_dist - 1);
                        }
                        break;
                    }
                    case KEY.SLASH: {
                        if(!down) {
                            if(!player.chat.active) {
                                player.chat.open(['/']);
                            }
                        }
                        break;
                    }
                    // Flying [Space]
                    case KEY.SPACE: {
                        if(this.world.game_mode.canFly() && !player.in_water && !player.onGround) {
                            if(down && first) {
                                if(!player.getFlying()) {
                                    // this.setFlying(true);
                                    console.log('flying');
                                }
                            }
                        }
                        break;
                    }
                    // [F1]
                    case KEY.F1: {
                        if(!down) {
                            this.hud.toggleActive();
                        }
                        return true;
                        break;
                    }
                    // [F3] Toggle info
                    case KEY.F3: {
                        if(!down) {
                            this.hud.toggleInfo();
                        }
                        return true;
                        break;
                    }
                    // [F4] Draw all blocks
                    case KEY.F4: {
                        if(!down) {
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
                        if(!down) {
                            this.render.testLightOn = !this.render.testLightOn;
                        }
                        return true;
                        break;
                    }
                    // [F7] Ddraw player "ghost"
                    case KEY.F7: {
                        if(!down) {
                            this.world.players.drawGhost(this.player);
                        }
                        return true;
                        break;
                    }
                    // [F8] Random teleport
                    case KEY.F8: {
                        if(!down) {
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
                        if(!down) {
                            this.render.toggleNight();
                        }
                        return true;
                        break;
                    }
                    // F10 (toggleUpdateChunks)
                    case KEY.F10: {
                        if(!down) {
                            player.nextGameMode();
                        }
                        return true;
                        break;
                    }
                    // R (Respawn)
                    case KEY.R: {
                        if(!down) {
                            this.player.world.server.Teleport('spawn');
                        }
                        return true;
                        break;
                    }
                    // E (Inventory)
                    case KEY.E: {
                        if(!down) {
                            if(this.hud.wm.getVisibleWindows().length == 0) {
                                player.inventory.open();
                                return true;
                            }
                        }
                        break;
                    }
                    // T (Open chat)
                    case KEY.T: {
                        if(!down) {
                            if(!player.chat.active) {
                                player.chat.open([]);
                            }
                        }
                        return true;
                        break;
                    }
                }        
                return player.onKeyEvent(e);
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

    // Render loop
    loop() {
        let player  = this.player;
        let tm      = performance.now();
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
        if (player.pickAt && Game.hud.active && this.world.game_mode.canBlockAction()) {
            player.pickAt.update(player.pos, this.world.game_mode.getPickatDistance());
        }
        // Draw world
        this.render.setCamera(player, player.getEyePos(), player.rotate);
        this.render.draw(this.hud.FPS.delta);
        // Send player state
        this.sendPlayerState(player);
        // Счетчик FPS
        this.hud.FPS.incr();
        this.averageClockTimer.add(performance.now() - tm);
        window.requestAnimationFrame(this.loop);
    }

    // Отправка информации о позиции и ориентации игрока на сервер
    sendPlayerState(player) {
        this.current_player_state = {
            rotate:             player.rotate,
            pos:                player.lerpPos.clone().multiplyScalar(100).round().divScalar(100),
            ping:               Math.round(this.player.world.server.ping_value)
        };
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
        let that = this;
        if(check_opened_windows && that.hud.wm.getVisibleWindows().length > 0) {
            return;
        }
        if(!that.world || that.player.controls.enabled) {
            return;
        }
        let element = that.render.canvas;
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
        if(that.player.controls.inited) {
            element.requestPointerLock();
            return;
        }
        let pointerlockchange = function(event) {
            if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
                that.setControlsEnabled(true);
            }  else {
                that.setControlsEnabled(false);
                if(that.hud.wm.getVisibleWindows().length == 0 && !that.player.chat.active) {
                    that.hud.frmMainMenu.show();
                }
                that.player.controls.clearStates();
            }
        }
        let pointerlockerror = function(event) {
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
        that.player.controls.inited = true;
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
                if(that.hud.wm.getVisibleWindows().length > 0) {
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
        document.addEventListener('mousemove', function(e) {
            let controls = that.player.controls;
            let z = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            let x = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            if(that.hud.wm.getVisibleWindows().length > 0) {
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
                x = (x / window.devicePixelRatio) * controls.mouse_sensitivity;
                z = (z / window.devicePixelRatio) * controls.mouse_sensitivity;
                if(that.player.zoom) {
                    x *= ZOOM_FACTOR * 0.5;
                    z *= ZOOM_FACTOR * 0.5;
                }
                //
                that.player.addRotate(new Vector(x, 0, z));
            }
        }, false);
    }

}