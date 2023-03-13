import { World } from "./world.js";
import { DEFAULT_FOV_NORMAL, Renderer, ZOOM_FACTOR } from "./render.js";
import { AverageClockTimer, isMobileBrowser, Mth, Vector} from "./helpers.js";
import { BLOCK } from "./blocks.js";
import { Resources } from "./resources.js";
import { Sounds } from "./sounds.js";
import { IKbOptions, Kb, KbEvent} from "./kb.js";
import { Hotbar } from "./hotbar.js";
import { Tracker_Player } from "./tracker_player.js";
import { KEY, MAGIC_ROTATE_DIV, MOUSE, MAX_FPS_DELTA_PROCESSED, MUSIC_INITIAL_PAUSE_SECONDS, DEFAULT_MUSIC_VOLUME, LIGHT_TYPE, DEFAULT_RENDER_DISTANCE } from "./constant.js";
import { JoystickController } from "./ui/joystick.js";
import { Lang } from "./lang.js";
import { BBModel_DropPaste } from "./bbmodel/drop_paste.js";

import type { Player, PlayerStateUpdate } from "./player.js";
import type { HUD } from "./hud.js";

// TrackerPlayer
(globalThis as any).TrackerPlayer = new Tracker_Player();

// Reset zoom
// TODO: pixi
(globalThis as any).UI_ZOOM = Math.max(Math.floor(window.screen.availWidth / 1024), 1) * window.devicePixelRatio;
console.debug('zoom', UI_ZOOM)
globalThis.UI_FONT = 'Ubuntu';

export class GameSettings {

    // control
    mouse_sensitivity:       float = 100
    forced_joystick_control: boolean = false
    // sound
    music_volume:            float = DEFAULT_MUSIC_VOLUME
    // resources
    texture_pack:            string = 'base'
    // camera
    fov:                     float = DEFAULT_FOV_NORMAL
    render_distance:         int = DEFAULT_RENDER_DISTANCE
    base_ambient_light_level:float = 100
    // quality
    use_light:               int = LIGHT_TYPE.RTX
    beautiful_leaves:        boolean = true
    leaf_fall:               boolean = true
    draw_improved_blocks:    boolean = true
    overlay_textures:        boolean = false
    mipmap:                  boolean = false
    // grids
    mobs_draw_debug_grid:    boolean = false
    chunks_draw_debug_grid:  boolean = false
    cluster_draw_debug_grid: boolean = false
    // interface
    window_size:             float = 100
    show_compass:            boolean = false

    //
    _json_url?: string
    _resource_packs_url?: string

    constructor() {
        this.load()
    }

    load() {
        const load_state = localStorage.getItem('settings')
        this.apply(load_state ? (JSON.parse(load_state) ?? {}) : {})
    }

    save() {
        localStorage.setItem('settings', JSON.stringify(this));
    }

    apply(state : {[key: string]: any}) {

        for(let k in state) {
            if(k in this) {
                this[k] = state[k]
            }
        }

        this.texture_pack               = 'base'
        this.fov                        = Mth.clamp(this.fov, 50, 120)
        this.mouse_sensitivity          = Mth.clamp(this.mouse_sensitivity, 25, 300)
        this.music_volume               = Mth.clamp(this.music_volume, 0, 100)
        this.base_ambient_light_level   = Mth.clamp(this.base_ambient_light_level, 0, 100)
        this.use_light                  = Mth.clamp(this.use_light, 0, 2)
        this.window_size                = Mth.clamp(this.window_size, 10, 300)

    }

}

// Main game class
export class GameClass {

    player                      : Player
    world                       : World
    render                      : Renderer
    hud                         : HUD
    sounds                      : Sounds
    averageClockTimer           : AverageClockTimer
    bbmodelDropPaste            : BBModel_DropPaste
    kb                          : Kb;
    Joystick                    : JoystickController
    hotbar                      : Hotbar
    block_manager?              : BLOCK

    is_server                   : boolean = false
    f3_used                     : boolean = false
    onStarted                   : Function = () => {}
    onControlsEnabledChanged    : Function = (value : boolean) => {}
    preLoopEnable               : boolean = true
    sendStateInterval?          : NodeJS.Timer

    App                         : any;
    skin                        : any;
    settings                    : GameSettings
    local_server_client?        : any
    prev_player_state?          : any
    free_cam?                   : any

    constructor() {
        this.render     = new Renderer('qubatchRenderSurface');
        this.settings   = new GameSettings()
        // Local server client
        this.local_server_client = ((globalThis as any).LocalServerClient !== undefined) ? new LocalServerClient() : null;
        this.preLoop = this.preLoop.bind(this)
    }

    // Start
    async Start(server_url : string, world_guid : string, resource_loading_progress? : (state : any) => {}) {
        Qubatch.game = this;
        
        const settings = this.settings

        // Load resources
        Resources.onLoading = resource_loading_progress;
        // we can use it both
        await Resources.load({
            imageBitmap:    true,
            glsl:           this.render.renderBackend.kind === 'webgl',
            wgsl:           this.render.renderBackend.kind === 'webgpu'
        });

        //
        const blockTask = BLOCK.init(settings);
        await Promise.all([blockTask]);

        // init world
        this.world = new World(settings, BLOCK);

        // Create world
        await this.render.init(this.world, settings)

        this.hotbar = new Hotbar(this.hud)

        // Connect to server
        const connection_string = server_url + '?session_id=' + this.App.session.session_id + '&skin=' + this.skin.id + '&world_guid=' + world_guid;
        const ws = this.local_server_client ? this.local_server_client.connect(connection_string) : new WebSocket(connection_string);

        await this.world.connectToServer(ws);
        return this.world;
    }

    /**
     * Started...
     */
    Started(player : Player) {
        this.player             = player;
        this.sounds             = new Sounds(player);
        this.averageClockTimer  = new AverageClockTimer();
        this.prev_player_state  = null;
        // start playing music
        this.sounds.music.volume = this.settings.music_volume * 0.01;
        this.sounds.music.schedulePlay(MUSIC_INITIAL_PAUSE_SECONDS * 1000 * Math.random());
        //
        this.render.setPlayer(player);
        this.setInputElement(this.render.canvas);
        this.setupMousePointer(false);
        this.onStarted();
        // Set render loop
        this.loop = this.loop.bind(this);
        // Interval functions
        this.sendStateInterval = setInterval(() => {
            this.world.history.deletOld();
            player.sendState();
        }, 50);
        // Run render loop
        this.preLoopEnable = false
        this.render.requestAnimationFrame(this.loop);
        //
        this.bbmodelDropPaste = new BBModel_DropPaste(this)
    }

    // Set the canvas the renderer uses for some input operations.
    setInputElement(el) {
        const that = this;
        const hud = this.hud;
        const player = this.player;
        const add_mouse_rotate = new Vector();
        const controls = that.player.controls;
        let freezeF4Up = false;
        const kb = this.kb = new Kb(el, {
            onPaste: (e) => {
                const clipboardData = e.clipboardData || (window as any).clipboardData;
                if(clipboardData) {
                    const pastedData = clipboardData.getData('Text');
                    if(pastedData) {
                        for(const window of Qubatch.hud.wm.visibleWindows()) {
                            if (window.onPaste && window.onPaste(pastedData)) {
                                return true;
                            }
                        }
                        player.chat.pasteText(pastedData);
                    }
                }
                return true;
            },
            onMouseEvent: (e, x, y, type, button_id, shiftKey) => {
                const hasVisibleWindow = hud.wm.hasVisibleWindow();
                const DPR = isMobileBrowser() ? 1 : window.devicePixelRatio;
                if(([MOUSE.DOWN, MOUSE.UP].includes(type)) && hasVisibleWindow) {
                    hud.wm.mouseEventDispatcher({
                        type:       e.type,
                        shiftKey:   e.shiftKey,
                        button_id:  e.button_id,
                        offsetX:    e.offsetX * DPR,
                        offsetY:    e.offsetY * DPR,
                    });
                    return false;
                } else if(type == MOUSE.MOVE) {
                    let z = e.movementX;
                    let x = e.movementY;
                    if(that.hud.wm.hasVisibleWindow()) {
                        if(controls.enabled) {
                            controls.mouseX = Math.min(Math.max(controls.mouseX + z, 0), that.hud.width);
                            controls.mouseY = Math.min(Math.max(controls.mouseY + x, 0), that.hud.height);
                        } else {
                            controls.mouseY = e.offsetY * DPR;
                            controls.mouseX = e.offsetX * DPR;
                        }
                        //
                        that.hud.wm.mouseEventDispatcher({
                            type:       e.type,
                            shiftKey:   e.shiftKey,
                            button_id:  e.button_id,
                            offsetX:    e.offsetX * DPR,
                            offsetY:    e.offsetY * DPR
                        });
                    } else {
                        x *= -1;
                        add_mouse_rotate.x = (x / DPR) * controls.mouse_sensitivity;
                        add_mouse_rotate.z = (z / DPR) * controls.mouse_sensitivity;
                        if(player.zoom) {
                            add_mouse_rotate.x *= ZOOM_FACTOR * 0.5;
                            add_mouse_rotate.z *= ZOOM_FACTOR * 0.5;
                        }
                        player.addRotate(add_mouse_rotate.divScalarSelf(MAGIC_ROTATE_DIV));
                    }
                    return true;
                } else if (type == MOUSE.WHEEL) {
                    if(player) {
                        if(controls.enabled) {
                            if(!player.changeSpectatorSpeed(-e.deltaY)) {
                                player.onScroll(e.deltaY > 0);
                            }
                        }
                        if(that.hud.wm.hasVisibleWindow()) {
                            that.hud.wm.mouseEventDispatcher({
                                original_event:     e,
                                type:               e.type,
                                shiftKey:           e.shiftKey,
                                button_id:          e.button_id,
                                offsetX:            controls.mouseX * (that.hud.width / that.render.canvas.width),
                                offsetY:            controls.mouseY * (that.hud.height / that.render.canvas.height)
                            });
                        }
                    }
                    if(e.ctrlKey) return;
                    return true;
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
                if(player.chat.active) {
                    player.chat.typeChar(charCode, typedChar);
                } else {
                    //
                    hud.wm.typeChar(e, charCode, typedChar);
                }
            },
            // Hook for keyboard input
            onKeyEvent: (e: KbEvent) => {
                // Chat
                if(player.chat.active && (e.keyCode < 112 || e.keyCode > 123)) {
                    player.chat.onKeyEvent(e);
                    return false;
                }
                //
                switch(e.keyCode) {
                    // [F1]
                    case KEY.F1: {
                        if(!e.down) {
                            hud.toggleActive();
                        }
                        return true;
                    }
                    // [F2]
                    case KEY.F2: {
                        if(!e.down) {
                            if(!hud.wm.hasVisibleWindow()) {
                                hud.wm.getWindow('frmScreenshot').make();
                            }
                        }
                        return true;
                    }
                    // [F3] Toggle info
                    case KEY.F3: {
                        if(e.down) {
                            kb.keys[KEY.F3] = performance.now();
                            this.f3_used = false
                        } else {
                            if(!this.f3_used) {
                                if (hud.wm.getWindow('frmMode').visible) {
                                    hud.wm.getWindow('frmMode').hide();
                                    this.setupMousePointer(false);
                                } else {
                                    hud.toggleInfo();
                                }
                                kb.keys[KEY.F3] = false;
                                kb.keys[KEY.F4] = false;
                                freezeF4Up = true;
                            }
                        }
                        return true;
                    }
                    // [F5] (Camera mode)
                    case KEY.F5: {
                        if(e.down && e.ctrlKey) {
                            location.reload()
                            return false
                        }
                        if(hud.frmMainMenu.visible) {
                            return false;
                        }
                        if(e.down) {
                            if(!hud.wm.hasVisibleWindow()) {
                                Qubatch.render.nextCameraMode();
                            }
                        }
                        if(e.e_orig) {
                            e.e_orig.preventDefault();
                            e.e_orig.stopPropagation();
                        }
                        return true
                    }
                    // [F6]
                    case KEY.F6: {
                        if(e.e_orig) {
                            e.e_orig.preventDefault();
                            e.e_orig.stopPropagation();
                        }
                        if(e.down && e.shiftKey) {
                            this.toggleFreeCam();
                        }
                        return true;
                    }
                }
                // Windows
                if(hud.wm.hasVisibleWindow()) {
                    if(e.down && e.keyCode == KEY.TAB) {
                        if(hud.wm.getWindow('frmQuests').visible) {
                            hud.wm.getWindow('frmQuests').hide();
                            return true;
                        }
                    }
                    if(e.keyCode == KEY.ESC) {
                        if(!e.down) {
                            if(hud.frmMainMenu.visible) {
                                hud.wm.closeAll();
                                Qubatch.setupMousePointer(false);
                                return true;
                            }
                        }
                    }
                    return hud.wm.onKeyEvent(e);
                }
                //
                switch(e.keyCode) {
                    // Page Up
                    case KEY.PAGE_UP: {
                        if(e.down) {
                            this.world.chunkManager.setRenderDist(player.state.chunk_render_dist + 1);
                        }
                        return true;
                    }
                    // Set render distance [Page Down]
                    case KEY.PAGE_DOWN: {
                        if(e.down) {
                            this.world.chunkManager.setRenderDist(player.state.chunk_render_dist - 1);
                        }
                        return true;
                    }
                    case KEY.SLASH: {
                        if(!e.down) {
                            if(!player.chat.active) {
                                player.chat.open(['/']);
                            }
                        }
                        return true;
                    }
                    // show mobs AABB
                    case KEY.B: {
                        if(e.down) {
                            if (kb.keys[KEY.F3]) {
                                this.world.mobs.toggleDebugGrid();
                                this.f3_used = true
                            }
                        }
                        break;
                    }
                    // show over player chunk grid
                    case KEY.G: {
                        if(e.down) {
                            if (kb.keys[KEY.F3]) {
                                this.world.chunkManager.toggleDebugGrid();
                                this.f3_used = true
                            }
                        }
                        break;
                    }
                    // [F4] set spawnpoint
                    case KEY.F4: {
                        if(e.down) {
                            if (kb.keys[KEY.F3]) {
                                if(!hud.wm.getWindow('frmMode').visible) {
                                    hud.wm.getWindow('frmMode').show();
                                }
                            }
                        } else {
                            if(freezeF4Up) {
                                freezeF4Up = false;
                            } else {
                                if(e.shiftKey) {
                                    this.world.chunkManager.setTestBlocks(new Vector((player.pos.x | 0) - 16, player.pos.y | 0, (player.pos.z | 0) - 16));
                                    Qubatch.render.addAsteroid(player.pos.add({x: 0, y: 16, z: 0}), 5);
                                } else if(kb.keys[e.keyCode]) {
                                    player.changeSpawnpoint();
                                }
                            }
                        }
                        break;
                    }
                    // [F7]
                    case KEY.F7: {
                        if(!e.down) {
                            this.render.testLightOn = !this.render.testLightOn;
                            if(player.world.players.exists(-1)) {
                                player.world.players.delete(-1);
                            } else {
                                const ghost: {data: PlayerStateUpdate, time: number} = {
                                    /* It's unused
                                    "name": ServerClient.CMD_PLAYER_JOIN,
                                    */
                                    "data": {
                                        "id":       -1,
                                        "username": Lang.im,
                                        "pos":      player.lerpPos.clone(),
                                        "rotate":   player.rotate.clone(),
                                        "skin":     player.skin,
                                        "hands":    player.state.hands,
                                        "sitting":  player.state.sitting,
                                        "lies":     player.state.lies,
                                        health:     player.state.indicators.live,
                                        armor:      player.inventory.exportArmorState(),
                                        sneak:      player.sneak,
                                        "sleep":    player.state.sleep
                                        /* It's unused, and it doesn't exist on player.state
                                        "scale":    player.state.scale
                                        */
                                    },
                                    "time": ~~(new Date())
                                };
                                player.world.players.add(ghost);
                            }
                        }
                        return true;
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
                                        player.teleport(null, pos, false);
                                    }
                                }, 1000);
                            } else {
                                player.teleport('random', null, false);
                            }
                        }
                        return true;
                    }
                    // F10 (toggleUpdateChunks)
                    case KEY.F10: {
                        if(!e.down) {
                            player.world.server.GameModeNext();
                        }
                        return true;
                    }
                    // R (Respawn)
                    case KEY.R: {
                        if(!e.down) {
                            this.player.world.server.Teleport('spawn', null, true);
                        }
                        return true;
                    }
                    // Q (Drop item)
                    case KEY.Q: {
                        if(!e.down) {
                            this.player.world.server.DropItem();
                        }
                        return true;
                    }
                    // E (Inventory)
                    case KEY.E: {
                        if(!e.down) {
                            if(!hud.wm.hasVisibleWindow()) {
                                player.inventory.open();
                                return true;
                            }
                        }
                        break;
                    }
                    // Tab (Quests)
                    case KEY.TAB: {
                        if(e.down) {
                            if(!hud.wm.hasVisibleWindow()) {
                                hud.wm.getWindow('frmQuests').toggleVisibility();
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
                    }
                    case KEY.ENTER: {
                        if(e.down && !e.first) { // !e.first is needed if we keep pressing ENTER after the chat is closed
                            if(!player.chat.active) {
                                player.chat.open([]);
                            }
                        }
                        return true;
                    }
                }
                // Player controls
                if(kb.keys[e.keyCode] && e.down) {
                    // do nothing
                } else {
                    kb.keys[e.keyCode] = e.down ? performance.now() : false;
                }
                if(!kb.keys[KEY.WIN]) {
                    player.controls.setState(
                        !!(kb.keys[KEY.W] && !kb.keys[KEY.S]),
                        !!(kb.keys[KEY.S] && !kb.keys[KEY.W]),
                        !!(kb.keys[KEY.A] && !kb.keys[KEY.D]),
                        !!(kb.keys[KEY.D] && !kb.keys[KEY.A]),
                        !!(kb.keys[KEY.SPACE]),
                        e.shiftKey,
                        player.controls.sprint
                    );
                    // 0...9 (Select material)
                    if(!e.down && (e.keyCode >= 48 && e.keyCode <= 57)) {
                        if(e.keyCode == 48) {
                            e.keyCode = 58;
                        }
                        player.inventory.select(e.keyCode - 49);
                        return true;
                    }
                    player.zoom = !!kb.keys[KEY.C];
                    //
                    if(e.ctrlKey && !player.isSneak) {
                        player.controls.sprint = !!kb.keys[KEY.W];
                    } else if(!e.down && e.keyCode == KEY.W) {
                        player.controls.sprint = false;
                    }
                    //
                    if(e.shiftKey && e.down && e.keyCode == KEY.SHIFT) {
                        player.standUp();
                    }
                }
                return false;
            },
            onDoubleKeyDown: (e) => {
                if(e.keyCode == KEY.W) {
                    player.controls.sprint = true;
                } else if (e.keyCode == KEY.SPACE) {
                    if(player.game_mode.canFly() && !player.in_water && !player.onGround) {
                        player.setFlying(!player.getFlying());
                    }
                }
            }
        } as IKbOptions);

        // Joystick
        this.Joystick = new JoystickController('stick', 64, 8, player, kb);

    }

    // setControlsEnabled
    setControlsEnabled(value : boolean) {
        this.player.controls.enabled = value;
        if(value) {
            delete(Qubatch.kb.keys[KEY.WIN]);
        }
        this.onControlsEnabledChanged(value);
    }

    preLoop() {
        if(this.preLoopEnable) {
            this.render.renderBackend.resetAfter();
            this.hud.draw(false)
            this.render.renderBackend.resetBefore();
            this.render.requestAnimationFrame(this.preLoop)
        }
    }

    /**
     * Main loop
     * @param time
     * @param args - args from raf, because it necessary for XR
     */
    loop(time : number = 0, ...args) {
        const player  = this.player;
        const tm      = performance.now();
        const delta   = this.hud.FPS.delta;

        if(!this.hud.splash.loading && delta <= MAX_FPS_DELTA_PROCESSED) {
            if(!this.free_cam) {
                player.update(delta);
            }
        } else {
            player.lastUpdate = null;
        }

        // Update visible winows, e.g. automaticaly close the chest window if the player is too far way.
        this.hud.wm.updateVisibleWindows();

        // update a sounds after player update
        this.sounds.update();

        this.world.chunkManager.update(player.pos, delta);

        // change camera location
        this.render.setCamera(player, this.free_cam ? this.getFreeCamPos(delta) : player.getEyePos(), player.rotate, !!this.free_cam);

        // Update world
        // this is necessary
        // because there are a cases when we should call draw without update
        // or update without draw
        // like XR, it quiery frame more that 60 fps (90, 120) and we shpuld render each frame
        // but update can be called slowly
        if(this.hud.FPS.frames % 3 == 0) {
            this.render.update(delta, args);
        }

        // Draw world
        this.render.draw(delta, args);

        this.Joystick.tick(delta);

        // Счетчик FPS
        this.hud.FPS.incr();
        this.averageClockTimer.add(performance.now() - tm);

        this.render.requestAnimationFrame(this.loop)

    }

    // releaseMousePointer
    releaseMousePointer() {
        try {
            // Attempt to unlock
            document.exitPointerLock();
        } catch(e) {
            console.error(e);
        }
    }

    // setupMousePointer...
    setupMousePointer(check_opened_windows : boolean) {

        if(check_opened_windows && this.hud.wm.hasVisibleWindow()) {
            return;
        }

        if(!this.world || !this.player || this.player.controls.enabled) {
            return;
        }

        // All windows closed
        this.hud.wm.allClosed = () => {
            console.info('All windows closed');
            this.setupMousePointer(false);
        };

        // requestPointerLock
        const element = this.render.canvas;
        element.requestPointerLock = element.requestPointerLock || element.webkitRequestPointerLock;
        const requestPointerLock = () => {
            if(isMobileBrowser()) {
                this.setControlsEnabled(true);
                this.hud.toggleInfo();
            } else {
                element.requestPointerLock();
            }
        }

        // If already inited
        if(this.player.controls.inited) {
            return requestPointerLock();
        }

        // pointerlockchange
        const pointerlockchange = (event) => {
            if (document.pointerLockElement === element || (document as any).webkitPointerLockElement === element) {
                this.setControlsEnabled(true);
            }  else {
                this.setControlsEnabled(false);
                this.player.stopAllActivity();
                if(!this.hud.wm.hasVisibleWindow() && !this.player.chat.active) {
                    // Safari emit ESC keyup since ~100 ms after pointer lock left event
                    // we should skip this ESC
                    // otherwise we never can open mine menu
                    this.kb.skipUntil(200);
                    this.hud.frmMainMenu.show();
                }

            }
        }

        // Catch pointer errors
        const pointerlockerror = function(event) {
            console.warn('Error setting pointer lock!', event);
        }

        // Hook pointer lock state change events
        document.addEventListener('pointerlockchange', pointerlockchange, false);
        document.addEventListener('mozpointerlockchange', pointerlockchange, false);
        document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
        document.addEventListener('pointerlockerror', pointerlockerror, false);
        document.addEventListener('mozpointerlockerror', pointerlockerror, false);
        document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

        // Lock and mark as inited
        requestPointerLock();
        this.player.controls.inited = true;

    }

    drawInstruments() {
        const instruments = [];
        for(let block of this.block_manager.getAll()) {
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

    // Draw chunks perf stat in console
    drawPerf() {
        const timers = {};
        var cnt = 0;
        for(let chunk of this.world.chunkManager.chunks) {
            if(chunk.timers) {
                for(let name in chunk.timers) {
                    if(!(name in timers)) {
                        timers[name] = {name, min: 99999, max: 0, avg: 0, total: 0, cnt_more_zero: 0};
                    }
                }
                cnt++;
                for(var name in timers) {
                    const tim = timers[name];
                    var t = chunk.timers[tim.name];
                    if(t !== undefined) {
                        if(t < tim.min) tim.min = t;
                        if(t > tim.max) tim.max = t;
                        tim.total += t;
                        if(t > 0) {
                            tim.cnt_more_zero++;
                        }
                    }
                }
            }
        }
        const round = (v) => {
            return Math.round(v * 100) / 100
        }
        for(var name in timers) {
            const tim = timers[name];
            delete(tim.name)
            tim.avg = tim.cnt_more_zero > 0 ? round(tim.total / tim.cnt_more_zero) : -1;
            tim.total = round(tim.total)
            tim.min = round(tim.min)
            tim.max = round(tim.max)
            tim.cnt = cnt;
        }
        console.table(timers);
    }

    toggleFreeCam() {
        if(this.free_cam) {
            this.free_cam = null;
        } else {
            this.free_cam = true;
            this.player.pr_spectator.player.entity.position.copyFrom(this.player.getEyePos());
            this.player.controls.sneak = false;
        }
        return true;
    }

    getFreeCamPos(delta) {
        const player = this.player;
        const pc = player.pr_spectator;
        pc.controls.back       = player.controls.back;
        pc.controls.forward    = player.controls.forward;
        pc.controls.right      = player.controls.right;
        pc.controls.left       = player.controls.left;
        pc.controls.jump       = player.controls.jump;
        pc.controls.sneak      = player.controls.sneak;
        pc.controls.sprint     = player.controls.sprint;
        pc.player_state.yaw    = player.rotate.z;
        pc.tick(delta / 1000 * 3., player.scale);
        return pc.player.entity.position;
    }

    //
    setSetting(name, value) {
        const form = this.world.settings
        form[name] = value;
        localStorage.setItem('settings', JSON.stringify(form));
    }

    exit() {
        location.href = '/';
    }

}