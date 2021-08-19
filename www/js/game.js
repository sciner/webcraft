import Sounds from "./sounds.js";
import World from "./world.js";
import Renderer from "./render.js";
import Physics from "./physics.js";
import Player from "./player.js";
import Inventory from "./inventory.js";
import {fps} from "./fps.js";
import {Hotbar} from "./hotbar.js";
import {Vector} from "./helpers.js";
import {BLOCK} from "./blocks.js";
import {Resources} from "./resources.js";
import ServerClient from "./server_client.js";

// Mouse event enumeration
export let MOUSE         = {};
    MOUSE.DOWN    = 1;
    MOUSE.UP      = 2;
    MOUSE.MOVE    = 3;
    MOUSE.CLICK   = 4;
    MOUSE.BUTTON_LEFT   = 0;
    MOUSE.BUTTON_WHEEL  = 1;
    MOUSE.BUTTON_RIGHT  = 2;

export let KEY           = {};
    KEY.BACKSPACE = 8;
    KEY.ENTER     = 13;
    KEY.SHIFT     = 16;
    KEY.ESC       = 27;
    KEY.SPACE     = 32;
    KEY.PAGE_UP   = 33;
    KEY.PAGE_DOWN = 34;
    KEY.A         = 65;
    KEY.C         = 67;
    KEY.D         = 68;
    KEY.E         = 69;
    KEY.J         = 74;
    KEY.R         = 82;
    KEY.S         = 83;
    KEY.T         = 84;
    KEY.W         = 87;
    KEY.F1        = 112;
    KEY.F2        = 113;
    KEY.F3        = 114;
    KEY.F4        = 115;
    KEY.F5        = 116;
    KEY.F7        = 118;
    KEY.F8        = 119;
    KEY.F9        = 120;
    KEY.F10       = 121;
    KEY.F11       = 122;
    KEY.SLASH     = 191;

export let Game = {
    shift:              {x: 0, y: 0, z: 0},
    start_time:         performance.now(),
    last_saved_time:    performance.now() - 20000,
    world_name:         null, // 'infinity',
    hud:                null,
    canvas:             document.getElementById('renderSurface'),
    /**
     * @type { World }
     */
    world:              null,
    /**
     * @type { Renderer }
     */
    render:             null, // renderer
    resources:          null,
    physics:            null, // physics simulator
    player:             null,
    mouseX:             0,
    mouseY:             0,
    inventory:          null,
    prev_player_state:  null,
    controls:           {
        inited: false,
        enabled: false
    },
    // createNewWorld
    createNewWorld: function(form) {
        let spawnPoint = new Vector(
            2914.5,
            150.0,
            2884.5
        );
        return Object.assign(form, {
            spawnPoint: spawnPoint,
            pos: spawnPoint,
            brightness: 1.0,
            modifiers: {},
            rotate: new Vector(0, 0, 0),
            inventory: {
                items: BLOCK.getStartInventory(),
                current: {
                    index: 0,
                    id: null
                }
            }
        })
    },
    // Ajust world state
    ajustSavedState: function(saved_state) {
        return saved_state;
    },

    load(settings) {
        this.resources = new Resources();
        return this.resources.load({
            hd: settings.hd,
            texture_pack: settings.texture_pack,
            glsl: this.render.renderBackend.kind === 'webgl',
            wgsl: this.render.renderBackend.kind === 'webgpu',
            imageBitmap: true
        });
    },

    initGame(saved_world, settings) {
        this.world_name = saved_world._id;
        this.seed       = saved_world.seed;
        saved_world     = this.ajustSavedState(saved_world);
        this.sounds     = new Sounds();
        // Create a new world
        this.world = new World(saved_world);
        this.world.init()
            .then(() => {
                this.render = new Renderer('renderSurface');
                return this.load(settings);
            })
            .then(()=>{
                return this.render.init(this.world, settings, this.resources);
            })
            .then(this.postInitGame.bind(this))
    },

    postInitGame() {
        this.physics    = new Physics();
        this.player     = new Player();
        this.inventory  = new Inventory(this.player, this.hud);
        this.player.setInputCanvas('renderSurface');
        this.hud.add(fps, 0);
        this.hotbar = new Hotbar(this.hud, this.inventory);
        this.physics.setWorld(this.world);
        this.player.setWorld(this.world);
        this.setupMousePointer();
        this.world.renderer.updateViewport();
        this.world.fixRotate();
        //
        this.readMouseMove();
        this.startBackgroundMusic();
        document.querySelector('body').classList.add('started');

        this.loop = this.loop.bind(this);
        // Run render loop
        window.requestAnimationFrame(this.loop);
        // setInterval(that.loop, 1);
    },

    startBackgroundMusic: function() {
        /*
        setTimeout(function(){
            try {
                let audioElement0 = document.createElement('audio');
                // audioElement0.setAttribute('src', '/volume_alpha_10_equinoxe.mp3');
                audioElement0.setAttribute('src', 'https://webcraft.whiteframe.ru/forest.mp3');
                audioElement0.setAttribute('autoplay', 'autoplay');
                audioElement0.setAttribute('loop', 'loop');
                audioElement0.volume = 0.1;
            } catch(e) {
                // do nothing
            }
        }, 1000);
        */
    },
    loopTime: {
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
    },
    // Render loop
    loop() {
        let tm = performance.now();
        let that = this;
        if(that.controls.enabled) {
            // Simulate physics
            that.physics.simulate();
            // Update local player
            that.player.update();
        } else {
            that.player.lastUpdate = null;
        }
        that.world.update();
        // Draw world
        that.render.setCamera(that.player.getEyePos().toArray(), that.player.angles);
        that.render.draw(fps.delta);
        // Send player state
        that.sendPlayerState();
        // Счетчик FPS
        fps.incr();
        that.loopTime.add(performance.now() - tm);
        window.requestAnimationFrame(that.loop);
    },
    // Отправка информации о позиции и ориентации игрока на сервер
    sendPlayerState: function() {
        this.current_player_state = {
            angles: this.world.localPlayer.angles.map(value => Math.round(value * 1000) / 1000),
            pos:    this.world.localPlayer.pos,
            ping:   Math.round(this.world.server.ping_value)
        };
        this.current_player_state_json = JSON.stringify(this.current_player_state);
        if(this.current_player_state_json != this.prev_player_state) {
            this.prev_player_state = this.current_player_state_json;
            this.world.server.Send({
                name: ServerClient.EVENT_PLAYER_STATE,
                data: this.current_player_state
            });
        }
    },
    releaseMousePointer: function() {
        try {
            // this.canvas.exitPointerLock();
            // Attempt to unlock
            document.exitPointerLock();
            console.info('ok');
        } catch(e) {
            console.error(e);
        }
    },
    setupMousePointerIfNoOpenWindows: function() {
        if(this.hud.wm.getVisibleWindows().length > 0) {
            return;
        }
        this.setupMousePointer();
    },
    setupMousePointer: function() {
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
                that.controls.enabled = true;
                console.log('Pointer lock enabled!');
            }  else {
                that.controls.enabled = false;
                if(Game.hud.wm.getVisibleWindows().length == 0 && !Game.world.localPlayer.chat.active) {
                    Game.hud.frmMainMenu.show();
                }
                console.info('Pointer lock lost!');
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
    },
    readMouseMove: function() {
        let that = this;
        that.prevMovementX = 0;
        that.prevMovementZ = 0;
        document.addEventListener('wheel', function(e) {
            if(that.player) {
                if(Game.controls.enabled) {
                    that.player.onScroll(e.deltaY > 0);
                }
            }
        });
        document.addEventListener('mousemove', function(e) {
            let z = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            let x = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            // bug fix https://bugs.chromium.org/p/chromium/issues/detail?id=781182
            if(Math.abs(z) > 300) {
                x = that.prevMovementX;
                z = that.prevMovementZ;
            }
            that.prevMovementX = x;
            that.prevMovementZ = z;
            if(that.player.zoom) {
                x *= ZOOM_FACTOR * 0.5;
                z *= ZOOM_FACTOR * 0.5;
            }
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
                //
                that.world.addRotate(new Vector(x, 0, z));
            }
        }, false);
    },
};
