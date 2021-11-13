import {World} from "./world.js";
import {Renderer, ZOOM_FACTOR} from "./render.js";
import {Vector, AverageClockTimer} from "./helpers.js";
import {BLOCK} from "./blocks.js";
import {Resources} from "./resources.js";
import {ServerClient} from "./server_client.js";
import {HUD} from "./hud.js";
import {Sounds} from "./sounds.js";
import {Physics} from "./physics.js";
import {Hotbar} from "./hotbar.js";
import {Player} from "./player.js";

export class GameClass {

    constructor() {
        this.hud        = new HUD(0, 0);
        this.sounds     = new Sounds();
        this.render     = new Renderer('renderSurface');
    }

    // Start
    async Start(server_url, world_guid, settings, resource_loading_progress) {
        Resources.onLoading = resource_loading_progress;
        await Resources.load({
            imageBitmap:    true,
            texture_pack:   settings.texture_pack,
            glsl:           this.render.renderBackend.kind === 'webgl',
            wgsl:           this.render.renderBackend.kind === 'webgpu'
        });
        this.world = new World();
        await BLOCK.init();
        await this.render.init(this.world, settings);
        return this.world.connect(server_url, this.App.session.session_id, world_guid);
    }

    // postServerConnect...
    postServerConnect(info) {
        this.world.setInfo(info.world);
        //
        this.block_manager      = BLOCK;
        this.physics            = new Physics(this.world);
        this.player             = new Player(this.world, info.player);
        this.hotbar             = new Hotbar(Game.hud, this.player.inventory);
        this.averageClockTimer  = new AverageClockTimer();
        this.prev_player_state  = null;
        // Controls
        this.controls = {
            mouseX: 0,
            mouseY: 0,
            mouse_sensitivity: 1.0,
            inited: false,
            enabled: false,
            clearStates: function() {
                let player = Game.player;
                player.keys[KEY.W] = false;
                player.keys[KEY.A] = false;
                player.keys[KEY.S] = false;
                player.keys[KEY.D] = false;
                player.keys[KEY.J] = false;
                player.keys[KEY.SPACE] = false;
                player.keys[KEY.SHIFT] = false;
            }
        };
        //
        this.player.setInputCanvas('renderSurface');
        this.setupMousePointer(false);
        this.render.updateViewport();
        this.setupMouseListeners();
        //
        this.setGameStarted(true);
        // Run render loop
        this.loop = this.loop.bind(this);
        window.requestAnimationFrame(this.loop);
    }

    // setGameStarted
    setGameStarted(value) {
        let bodyClassList = document.querySelector('body').classList;
        if(value) {
            bodyClassList.add('started');
        } else {
            bodyClassList.remove('started');
        }
    }

    // setControlsEnabled
    setControlsEnabled(value) {
        this.controls.enabled = value;
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
        if(this.controls.enabled && !this.hud.splash.loading) {
            // Simulate physics
            this.physics.simulate();
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
            ping:               Math.round(this.world.server.ping_value),
            chunk_render_dist:  this.world.chunkManager.CHUNK_RENDER_DIST
        };
        let current_player_state_json = JSON.stringify(this.current_player_state);
        if(current_player_state_json != this.prev_player_state) {
            this.prev_player_state = current_player_state_json;
            this.world.server.Send({
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
        if(!that.world || that.controls.enabled) {
            return;
        }
        let element = that.render.canvas;
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
        if(that.controls.inited) {
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
                that.controls.clearStates();
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
        that.controls.inited = true;
    }

    // setupMouseListeners...
    setupMouseListeners() {
        let that = this;
        // Mouse wheel
        document.addEventListener('wheel', function(e) {
            if(e.ctrlKey) return;
            if(that.player) {
                //
                if(that.controls.enabled) {
                    that.player.onScroll(e.deltaY > 0);
                }
                //
                if(that.hud.wm.getVisibleWindows().length > 0) {
                    that.hud.wm.mouseEventDispatcher({
                        original_event:     e,
                        type:               e.type,
                        shiftKey:           e.shiftKey,
                        button:             e.button,
                        offsetX:            that.controls.mouseX * (that.hud.width / that.render.canvas.width),
                        offsetY:            that.controls.mouseY * (that.hud.height / that.render.canvas.height)
                    });
                }
            }
        });
        // Mouse move
        document.addEventListener('mousemove', function(e) {
            let controls = that.controls;
            let z = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            let x = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            if(that.hud.wm.getVisibleWindows().length > 0) {
            	if(that.controls.enabled) {
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