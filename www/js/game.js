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
    world:              null,
    render:             null, // renderer
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
            const sum = this.history.reduce((a, b) => a + b, 0);
            this.avg = (sum / this.history.length) || 0;
        }
    },

    // createNewWorld
    createNewWorld: function(form) {
        var spawnPoint = new Vector(
            2914.5,
            2884.5,
            150.0
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

    initGame: function(saved_world, settings) {
        
        var that = this;
        that.world_name = saved_world._id;
        that.seed       = saved_world.seed;
        saved_world     = that.ajustSavedState(saved_world);

        // Create a new world
        that.world = new World(saved_world, function() {
            that.render = new Renderer(that.world, 'renderSurface', settings, function() {
                that.physics    = new Physics();
                that.player     = new Player();
                that.inventory  = new Inventory(that.player, that.hud);
                that.player.setInputCanvas('renderSurface');
                that.hud.add(fps, 0);
                that.hotbar = new Hotbar(that.hud, that.inventory);
                that.physics.setWorld(that.world);
                that.player.setWorld(that.world);
                that.setupMousePointer();
                that.world.fixRotate();
                //
                that.hud.add(that.world.chunkManager, 0);
                //
                that.readMouseMove();
                that.startBackgroundMusic();
                document.querySelector('body').classList.add('started');
                // Run render loop
                window.requestAnimationFrame(that.loop);
                // setInterval(that.loop, 1);
            });
        });

    },
    startBackgroundMusic: function() {
        /*
        setTimeout(function(){
            try {
                var audioElement0 = document.createElement('audio');
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
    // Render loop
    loop: function() {
        var tm = performance.now();
        var that = Game;
        if(that.controls.enabled) {
            // Simulate physics
            that.physics.simulate();
            // Update local player
            that.player.update();
            that.world.update();
        } else {
            that.player.lastUpdate = null;
        }
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
        var current_player_state = {
            angles: this.world.localPlayer.angles,
            pos:    this.world.localPlayer.pos,
            ping:   Math.round(this.world.server.ping_value)
        };
        if(JSON.stringify(current_player_state) != this.prev_player_state) {
            this.prev_player_state = JSON.stringify(current_player_state);
            this.world.server.Send({
                name: ServerClient.EVENT_PLAYER_STATE,
                data: current_player_state
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
        var that = this;
        if(!that.world) {
            return;
        }
        if(that.controls.enabled) {
            return;
        }
        var element = that.canvas;
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
              
        if(that.controls.inited) {
            element.requestPointerLock();
            return;
        }
        var pointerlockchange = function(event) {
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
        var pointerlockerror = function(event) {
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
        var that = this;
        that.prevMovementX = 0;
        that.prevMovementY = 0;
        document.addEventListener('wheel', function(e) {
            if(that.player) {
                if(Game.controls.enabled) {
                    that.player.onScroll(e.deltaY > 0);
                }
            }
        });
        document.addEventListener('mousemove', function(e) {
            var x = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            var y = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            // bug fix https://bugs.chromium.org/p/chromium/issues/detail?id=781182
            if(Math.abs(x) > 300) {
                x = that.prevMovementX;
                y = that.prevMovementY;
            }
            that.prevMovementX = x;
            that.prevMovementY = y;
            if(Game.hud.wm.getVisibleWindows().length > 0) {
                if(that.controls.enabled) {
                    Game.mouseY += y;
                    Game.mouseX += x;
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
                that.world.addRotate(new Vector(y, x, 0));
            }
        }, false);
    },
};