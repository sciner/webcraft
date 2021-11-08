import {World} from "./world.js";
import {Renderer, ZOOM_FACTOR} from "./render.js";
import {fps} from "./fps.js";
import {Vector} from "./helpers.js";
import {BLOCK} from "./blocks.js";
import {Resources} from "./resources.js";
import ServerClient from "./server_client.js";
import HUD from "./hud.js";

import {Chat} from "./chat.js";
import Sounds from "./sounds.js";
import Physics from "./physics.js";
import Inventory from "./inventory.js";
import {Hotbar} from "./hotbar.js";
import {Player} from "./player.js";

export class GameClass {

    static hud = null;

    constructor() {}

    preload() {
        this.start_time             = performance.now();
        this.last_saved_time        = performance.now() - 20000;
        this.world_name             = null;
        this.username               = null;
        this.session_id             = null;
        this.canvas                 = document.getElementById('renderSurface');
        this.block_manager          = BLOCK;
        /**
        * @type { World }
        */
        this.world                  = null;
        /**
        * @type { Renderer }
        */
        this.render                 = null; // renderer
        this.physics                = null; // physics simulator
        this.mouseX                 = 0;
        this.mouseY                 = 0;
        this.inventory              = null;
        this.prev_player_state      = null;
        // Controls
        this.controls = {
            mouse_sensitivity: 1.0,
            inited: false,
            enabled: false,
            clearStates: function() {
                Game.world.player.keys[KEY.W] = false;
                Game.world.player.keys[KEY.A] = false;
                Game.world.player.keys[KEY.S] = false;
                Game.world.player.keys[KEY.D] = false;
                Game.world.player.keys[KEY.J] = false;
                Game.world.player.keys[KEY.SPACE] = false;
                Game.world.player.keys[KEY.SHIFT] = false;
            }
        };
        // loopTime
        this.loopTime = {
            history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
            ],
            prev: null,
            min: null,
            max: null,
            avg: null,
            add: function(value) {
                this.prev = value;
                if(this.min === null || this.min > value) {
                    this.min = value;
                }
                if(this.max === null || this.max < value) {
                    this.max = value;
                }
                this.history.shift();
                this.history.push(value);
                let sum = this.history.reduce((a, b) => a + b, 0);
                this.avg = (sum / this.history.length) || 0;
            }
        };
        //
        this.hud    = new HUD(0, 0);
        this.sounds = new Sounds();
        this.render = new Renderer('renderSurface');
    }

    load(settings) {
        return Resources.load({
            hd:             settings.hd,
            texture_pack:   settings.texture_pack,
            glsl:           this.render.renderBackend.kind === 'webgl',
            wgsl:           this.render.renderBackend.kind === 'webgpu',
            imageBitmap:    true
        });
    }

    async Start(session, world_guid, settings, resource_loading_progress) {
        // Create a new world
        // Resources
        Resources.onLoading = resource_loading_progress;
        this.load(settings)
            .then(() => {
                this.world = new World(session, world_guid, settings, BLOCK);
                this.render.init(this.world, settings).then(() => {
                    (async () => {
                        await BLOCK.load(Resources.resource_packs).then(() => {
                            return this.world.connect();
                        });
                    })();
                })
            })
    }

    // postServerConnect...
    postServerConnect() {
        //
        this.fps            = fps;
        this.physics        = new Physics(this.world);
        this.world.player   = new Player();
        this.world.player.setInputCanvas('renderSurface');
        //
        Game.hud.add(fps, 0);
        this.inventory      = new Inventory(this.world.player, Game.hud);
        this.hotbar         = new Hotbar(Game.hud, this.inventory);
        //
        this.world.player.setWorld(this.world);
        this.world.player.chat    = new Chat();
        //
        this.setupMousePointer();
        this.world.renderer.updateViewport();
        //
        this.readMouseMove();
        this.startBackgroundMusic();
        this.setGameStarted(true);
        this.loop = this.loop.bind(this);
        // Run render loop
        window.requestAnimationFrame(this.loop);
    }

    setGameStarted(value) {
        let bodyClassList = document.querySelector('body').classList;
        if(value) {
            bodyClassList.add('started');
        } else {
            bodyClassList.remove('started');
        }
    }

    setControlsEnabled(value) {
        this.controls.enabled = value;
        let bodyClassList = document.querySelector('body').classList;
        if(value) {
            bodyClassList.add('controls_enabled');
        } else {
            bodyClassList.remove('controls_enabled');
        }
    }

    startBackgroundMusic() {
        /*
        setTimeout(function(){
            try {
                let audioElement0 = document.createElement('audio');
                // audioElement0.setAttribute('src', '/volume_alpha_10_equinoxe.mp3');
                audioElement0.setAttribute('src', 'https://madcraft.io/forest.mp3');
                audioElement0.setAttribute('autoplay', 'autoplay');
                audioElement0.setAttribute('loop', 'loop');
                audioElement0.volume = 0.1;
            } catch(e) {
                // do nothing
            }
        }, 1000);
        */
    }

    // Render loop
    loop() {
        let tm = performance.now();
        let that = this;
        if(that.controls.enabled) {
            // Simulate physics
            that.physics.simulate();
            // Update local player
            that.world.player.update();
        } else {
            that.world.player.lastUpdate = null;
        }
        that.world.update();
        // Draw world
        that.render.setCamera(that.world.player.getEyePos(), that.world.player.rotate);
        that.render.draw(fps.delta);
        // Send player state
        that.sendPlayerState();
        // Счетчик FPS
        fps.incr();
        that.loopTime.add(performance.now() - tm);
        window.requestAnimationFrame(that.loop);
    }

    // Отправка информации о позиции и ориентации игрока на сервер
    sendPlayerState() {
        let pos = this.world.player.lerpPos.clone();
        this.current_player_state = {
            rotate:             this.world.player.rotate,
            pos:                pos.multiplyScalar(100).round().divScalar(100),
            ping:               Math.round(this.world.server.ping_value),
            chunk_render_dist:  this.world.chunkManager.CHUNK_RENDER_DIST
        };
        this.current_player_state_json = JSON.stringify(this.current_player_state);
        if(this.current_player_state_json != this.prev_player_state) {
            this.prev_player_state = this.current_player_state_json;
            this.world.server.Send({
                name: ServerClient.CMD_PLAYER_STATE,
                data: this.current_player_state
            });
        }
    }

    releaseMousePointer() {
        try {
            // this.canvas.exitPointerLock();
            // Attempt to unlock
            document.exitPointerLock();
        } catch(e) {
            console.error(e);
        }
    }

    setupMousePointerIfNoOpenWindows() {
        if(Game.hud.wm.getVisibleWindows().length > 0) {
            return;
        }
        this.setupMousePointer();
    }

    setupMousePointer() {
        let that = this;
        if(!that.world) {
            return;
        }
        if(that.controls.enabled) {
            return;
        }
        let element = that.canvas;
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
        if(that.controls.inited) {
            element.requestPointerLock();
            return;
        }
        let pointerlockchange = function(event) {
            if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
                that.setControlsEnabled(true);
                // console.log('Pointer lock enabled!');
            }  else {
                that.setControlsEnabled(false);
                if(Game.hud.wm.getVisibleWindows().length == 0 && !Game.world.player.chat.active) {
                    Game.hud.frmMainMenu.show();
                }
                that.controls.clearStates();
                // console.info('Pointer lock lost!');
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

    readMouseMove() {
        let that = this;
        // Mouse wheel
        document.addEventListener('wheel', function(e) {
            if(e.ctrlKey) return;
            if(that.world.player) {
                //
                if(Game.controls.enabled) {
                    that.world.player.onScroll(e.deltaY > 0);
                }
                //
                if(Game.hud.wm.getVisibleWindows().length > 0) {
                    Game.hud.wm.mouseEventDispatcher({
                        original_event:     e,
                        type:               e.type,
                        shiftKey:           e.shiftKey,
                        button:             e.button,
                        offsetX:            Game.mouseX * (Game.hud.width / Game.world.renderer.canvas.width),
                        offsetY:            Game.mouseY * (Game.hud.height / Game.world.renderer.canvas.height)
                    });
                }
            }
        });
        // Mouse move
        document.addEventListener('mousemove', function(e) {
            let z = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            let x = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            if(Game.hud.wm.getVisibleWindows().length > 0) {
            	if(that.controls.enabled) {
                    Game.mouseY += x;
                    Game.mouseX += z;
                    Game.mouseX = Math.max(Game.mouseX, 0);
                    Game.mouseY = Math.max(Game.mouseY, 0);
                    Game.mouseX = Math.min(Game.mouseX, Game.hud.width);
                    Game.mouseY = Math.min(Game.mouseY, Game.hud.height);
                } else {
                    Game.mouseY = e.offsetY * window.devicePixelRatio;
                    Game.mouseX = e.offsetX * window.devicePixelRatio;
                }
                Game.hud.wm.mouseEventDispatcher({
                    type:       e.type,
                    shiftKey:   e.shiftKey,
                    button:     e.button,
                    offsetX:    Game.mouseX * (Game.hud.width / Game.world.renderer.canvas.width),
                    offsetY:    Game.mouseY * (Game.hud.height / Game.world.renderer.canvas.height)
                });
            } else {
                // x = (x / window.devicePixelRatio) * Game.controls.mouse_sensitivity;
                // z = (z / window.devicePixelRatio) * Game.controls.mouse_sensitivity;
                x = (x / window.devicePixelRatio) * Game.controls.mouse_sensitivity;
                z = (z / window.devicePixelRatio) * Game.controls.mouse_sensitivity;
                if(that.world.player.zoom) {
                    x *= ZOOM_FACTOR * 0.5;
                    z *= ZOOM_FACTOR * 0.5;
                }
                //
                that.world.player.addRotate(new Vector(x, 0, z));
            }
        }, false);
    }

}