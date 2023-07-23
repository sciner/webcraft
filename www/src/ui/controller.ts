/// <reference path="../global-client.d.ts" />

import {CLIENT_MAX_SYNC_TIME_TWO_SIDED_LAG, Helpers, isMobileBrowser, MonotonicUTCDate, TApiSyncTimeResponse, Vector} from "../helpers.js";
import { UIApp } from "./app.js";
import { TexturePackManager } from "./texture_pack-manager.js";
import { SkinManager } from "./skin-manager.js";
import { GameClass } from "../game.js";
import {Player, PlayerOptions} from "../player.js";
import { Lang } from "../lang.js";
import { KEY, MOUSE } from "../constant.js";
import  registerTextFilter from "./angular/textfilter.js";
import { Resources } from "../resources.js";
import { ClipboardHelper } from "./clipboard.js";
import { HUD } from "../hud.js";
import { msdf } from "../../data/font.js";

globalThis.alphabet = {msdf}

function isSupported() {
    // we should support webgl2 strictly
    if(!('WebGL2RenderingContext' in self)) {
        console.error('Browser not supported:', 'Webgl2 context is required');
        return false;
    }

    const canvas = document.createElement('canvas');

    //
    try {

        // context should be stable and without fails
        const gl = canvas.getContext('webgl2', {stencil: true, failIfMajorPerformanceCaveat: true});

        if (!gl) {
            return false;
        }

        // free context
        gl.getExtension('WEBGL_lose_context').loseContext();
    } catch(e) {

        console.error('Browser not supported:', e.message);
        return false;
    }

    // GC issues on safari
    canvas.width = canvas.height = 0;

    const isFF = navigator.userAgent.indexOf('Mozilla') > -1;
    // safari 15 is ok
    const isSafari = navigator.userAgent.indexOf('Safari') > -1;
    const isChrome = navigator.userAgent.indexOf('Chrome') > -1 || ('chrome' in self);
    /*
        if (isFF) {
            console.error('Browser not supported:', 'Firefox not support modules for workers');
            return false;
        }
    */
    // chrome + safari
    return isSafari || isChrome || isFF;
}

// Mouse event enumeration
globalThis.MOUSE = MOUSE;
globalThis.KEY = KEY;

globalThis.randomUUID = () => {
    if(crypto.randomUUID) {
        return crypto.randomUUID()
    } else {
        return `${1e7}-${1e3}-${4e3}-${8e3}-${1e11}`.replace(/[018]/g, (c : any) =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )
    }
}

const app = angular.module('gameApp', []);
registerTextFilter(app);

class GameController {
    $scope:             any
    $timeout:           Function
    onShow:             {[key: string]: Function}
    onHide:             {[key: string]: Function}
    current_lang:       any = null
    loading:            {completed: boolean} = {completed: false}
    Lang:               object
    login_tab:          string = 'login'
    App:                UIApp
    skin:               SkinManager
    texture_pack:       TexturePackManager
    Qubatch:            any
    bg?:                any
    isSupportedBrowser: boolean
    links = {
        discord: 'https://discord.gg/QQw2zadu3T',
        youtube: 'https://www.youtube.com/channel/UCAcOZMpzYE8rk62giMgTwdw/videos'
    }
    shareGame: { visible: boolean; url: string; toggle: () => void; copy: () => void; };
    sunDir: { value: Vector; apply: () => void; getValue: () => string; };
    current_window: { id: string; show(id: any): void; toggle(id: any): void; getTitle(): any; };
    registration: { loading: boolean; form: { username: string; password: string; }; submit: () => boolean; reset: () => void; isValid: () => any; };
    settings: { show_advanced_settings: boolean, form: PlayerOptions; crosshairStyle: { list: { id: number; name: string; }[]; current: any; }; lightMode: { list: { id: number; name: string; }[]; current: any; }; chunkGeometryMode: { list: { id: number; name: string; }[]; current: any; }; chunkGeometryAlloc: { list: { id: number; name: string; }[]; current: any; }; save: () => void; toggle: () => boolean; updateSlider: (inputId: any) => void; };
    boot: { loading: boolean; latest_save: boolean; init(): void; };
    DeleteWorld: { world_guid: string; world_title: string; showModal(world_guid: any): void; delete(): any; };
    mygames: {
        list: any[]; shared_worlds: any[]; loading: boolean; toMain: () => void; load: () => any;
        // @deprecated
        save: () => void; add: (form: any) => void; enterWorld: { windowMod: string; worldInfo: any; getWorldGuid: () => string; joinWorld: (guid: string) => void; joinAfterApproving: () => void; joinToWorldIfNeed: () => void; showWorldInfo: (worldInfo: any, mode: any) => void; handleNoWorldOrOtherError: (error: any) => void; checkIsWorldUrl: () => void; };
    };
    newgame: { loading: boolean; form: {game_mode?: any; title: string; seed: string; generator: { id: any; options: any; }; }; reset(): void; init(): void; gamemodes: { index: number; list: any[]; current: any; select(game_mode: any): void; }; generators: { index: number; list: any[]; current: any; next(): void; select(generator: any): void; }; submit(): void; open(): void; close(): void; };
    modalWindow: { show: (modalId: string) => void; hide: (modalId: string) => void; };
    login: { logged: boolean; loading: boolean; form: { username: string; password: string; }; submit(): boolean; autoLogin(form: any): void; reset(): void; isValid(): any; init(): boolean; onSuccess(session: any): void; };

    //
    constructor($scope : any, $timeout : any) {
        this.$scope = $scope
        this.$timeout = $timeout
        this.Lang = Lang
        this.isSupportedBrowser = isSupported()

        const _ = (globalThis as any).Qubatch = new GameClass()

        this.Qubatch      = (globalThis as any).Qubatch
        this.skin         = new SkinManager(this, $timeout)
        this.texture_pack = new TexturePackManager(this)

        const instance = this // $scope

        //
        this.shareGame = {
            visible: false,
            url: '',
            toggle: function() {
                this.url = location.protocol + '//' + location.host + '/worlds/' + Qubatch.world.info.guid;
                this.visible = !this.visible;
            },
            copy: function() {
                ClipboardHelper.copy(this.url);
                vt.success(Lang.copied);
            }
        }

        // sun dir
        this.sunDir = {
            value: new Vector(1.1493, 1.0293, 0.6293),
            apply() {
                // 0.84 1 -1
                if(typeof Qubatch != 'undefined') {
                    Qubatch.render.sunDir = [this.value.x, this.value.y, this.value.z];
                }
            },
            getValue() {
                // 1.1493, 1.0293, 0.6293
                return [this.value.x, this.value.y, this.value.z].join(', ');
            }
        }

        // Current window
        this.current_window = {
            id: 'main',
            show(id : string) {
                if(!instance.isSupportedBrowser) {
                    id = 'not_supported_browser'
                }
                if(this.id) {
                    if (instance.onHide[this.id]) {
                        instance.onHide[this.id]()
                    }
                }
                this.id = id
                if (instance.onShow[id]) {
                    instance.onShow[id]()
                }
                instance.initSelects()
            },
            toggle(id) {
                if(this.id != id) {
                    this.show(id);
                } else {
                    this.show('main');
                }
            },
            getTitle() {
                switch(this.id) {
                    case 'hello': {
                        return 'MadCraft';
                        break;
                    }
                    case 'main': {
                        return 'Welcome!';
                        break;
                    }
                    default: {
                        return this.id;
                    }
                }
            }
        }

        // Login
        this.login = {
            logged: false,
            loading: false,
            form: {
                username: '',
                password: ''
            },
            submit() {
                if(!this.form.username) {
                    return false;
                }
                if(!this.form.password) {
                    return false;
                }
                //
                var that = this;
                that.loading = true;
                instance.App.Login(this.form, (resp) => {
                    $timeout(() => {
                        that.logged = true;
                        that.reset();
                        that.onSuccess(resp);
                        instance.current_window.show('main');
                        that.loading = false;
                    });
                });
            },
            autoLogin(form) {
                this.form.username = form.username;
                this.form.password = form.password;
                instance.current_window.show('login');
                this.submit();
            },
            reset() {
                this.form.username = '';
                this.form.password = '';
            },
            isValid() {
                return this.form.username && this.form.password;
            },
            init() {
                let session = instance.App.getSession();
                this.logged = !!session;
                if(!this.logged) {
                    instance.current_window.show('hello')
                    instance.loadingComplete()
                    return false
                }
                this.onSuccess(session);
            },
            onSuccess(session) {
                instance.mygames.load()
            }
        }

        // Registration
        this.registration = {
            loading: false,
            form: {
                username: '',
                password: ''
            },
            submit: function() {
                if(!this.form.username) {
                    return false;
                }
                if(!this.form.password) {
                    return false;
                }
                //
                var that = this;
                that.loading = true;
                instance.App.Registration(this.form, (resp) => {
                    $timeout(() => {
                        instance.login.autoLogin(that.form);
                        that.reset();
                    });
                });
            },
            reset: function() {
                this.form.username = '';
                this.form.password = '';
            },
            isValid: function() {
                return this.form.username && this.form.password;
            }
        }

        // Settings
        this.settings = {
            form: Qubatch.settings,
            show_advanced_settings: false,
            lightMode: {
                list: [{id: 0, name: 'No'}, {id: 1, name: 'Smooth'}, {id: 2, name: 'RTX'}],
                get current() {
                    return this.list[instance.settings.form.use_light];
                },
                set current(item) {
                    instance.settings.form.use_light = item.id;
                }
            },
            chunkGeometryMode: {
                list: [{id: 0, name: 'Auto'}, {id: 1, name: 'One per chunk'}, {id: 2, name: 'Big (multidraw)'}, {id: 3, name: 'Big (no multidraw)'}],
                get current() {
                    return this.list[instance.settings.form.chunk_geometry_mode];
                },
                set current(item) {
                    instance.settings.form.chunk_geometry_mode = item.id;
                }
            },
            chunkGeometryAlloc: {
                list: [{id: 0, name: 'Auto'}, {id: 64, name: '64 MB'}, {id: 125, name: '125 MB'}, {id: 250, name: '250 MB'}, {id: 375, name: '375 MB'},
                    {id: 500, name: '500 MB'}, {id: 750, name: '750 MB'}, {id: 1000, name: '1000 MB'}],
                get current() {
                    let t = this.list.find((x) => x.id === instance.settings.form.chunk_geometry_alloc);
                    if (!t) t = this.list[0];
                    return t;
                },
                set current(item) {
                    instance.settings.form.chunk_geometry_alloc = item.id;
                }
            },
            crosshairStyle: {
                list: [{id: 0, name: 'Hide'}, {id: 1, name: 'Classic'}, {id: 2, name: 'Dot'}, {id: 3, name: 'Cross'}],
                get current() {
                    return this.list[Qubatch.settings.crosshair_style];
                },
                set current(item) {
                    Qubatch.settings.crosshair_style = item.id;
                }
            },
            save: function() {
                this.form.save()
                instance.current_window.show('main');
            },
            toggle: function() {
                instance.current_window.toggle('settings');
                return false;
            },
            updateSlider: function (inputId) {
                const slider = (document.getElementById(inputId) as HTMLInputElement);
                const step = parseInt(slider.getAttribute("step"));
                const perc = (parseFloat(slider.value) - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min)) * 100;
                // track background
                slider.style.backgroundImage = "linear-gradient(to right, #FFAB00 " + perc + "%, #3F51B5 " + perc + "%)";
                // ticks set active
                const ticks = document.getElementById(inputId + '_ticks').children;
                const tickMarks = Array.prototype.slice.call(ticks);
                tickMarks.map(function (tick, index) {
                    var tickIndex = index * step;
                    tick.classList.remove("active");
                    tick.classList.remove("passed");
                    if (tickIndex <= Math.floor(parseFloat(slider.value))) {
                        tick.classList.add("passed");
                        if (tickIndex == Math.round(parseFloat(slider.value))) {
                            tick.classList.add("active");
                        }
                    }
                });
            }
        }

        // Boot
        this.boot = {
            loading: false,
            latest_save: false,
            init() {
                // do nothing
            }
        }

        // Delete world
        this.DeleteWorld = {
            world_guid: '',
            world_title: '',
            showModal(world_guid) {
                instance.modalWindow.show('modal-delete-world');
                this.world_guid = world_guid;
                for(let w of instance.mygames.list) {
                    if(w.guid == world_guid) {
                        this.world_title = w.title;
                        break;
                    }
                }
            },
            delete() {
                var world_guid = this.world_guid
                window.event.preventDefault()
                window.event.stopPropagation()
                // if(!confirm(Lang.confirm_delete_world)) {
                //     return false;
                // }
                let world = null;
                for(let w of instance.mygames.list) {
                    if(w.guid == world_guid) {
                        world = w;
                        break;
                    }
                }
                if(!world) {
                    return Qubatch.App.showError('error_world_not_found', 4000);
                }
                world.hidden = true;
                instance.App.DeleteWorld({world_guid}, () => {
                    vt.success(Lang.success_world_deleted);
                }, (e) => {
                    $timeout(() => {
                        world.hidden = false;
                    });
                    vt.error(e.message);
                });
                instance.modalWindow.hide('modal-delete-world');
            },
        }

        // My games
        this.mygames = {
            list: [],
            shared_worlds: [],
            loading: false,
            toMain: function(){
                location.href = '/';
            },
            load: function() {
                const session = instance.App.getSession();
                if(!session) {
                    return instance.loadingComplete();
                }
                const that = this;
                that.loading = true;
                instance.syncTime();
                instance.App.MyWorlds({}, (worlds) => {
                    $timeout(() => {
                        console.log(worlds)
                        that.shared_worlds = []
                        that.list = []
                        for(let w of worlds) {
                            w.game_mode_title = Lang[`gamemode_${w.game_mode}`];
                            w.my = w.user_id == session.user_id;
                           // if(w.public) {
                           //     that.shared_worlds.push(w)
                            //} else if (w.my) {
                               // that.list.push(w)  
                                //that.shared_worlds.push(w)
                            //}

                            if (w.my) {
                                that.list.push(w)
                            } else if (w.public == 1) {
                                that.shared_worlds.push(w)
                            }
                        }
                        console.log(that.list)
                        console.log(that.shared_worlds)
                        /*
                        that.shared_worlds = [];
                        for(let w of worlds) {
                            w.my = w.user_id == session.user_id;
                            if(!w.my) {
                                that.shared_worlds.push(w);
                            }
                        }*/
                        that.enterWorld.joinToWorldIfNeed();
                        that.loading = false;
                        instance.onMyGamesLoadedOrTimeSynchronized();
                    });
                });
            },
            // @deprecated
            save: function() {},
            add: function(form) {
                this.list.push(form);
            },
            enterWorld: {
                windowMod: 'off',
                worldInfo: null,
                getWorldGuid: function() {
                    let pathName = window.location.pathname;
                    if (pathName && pathName.startsWith('/worlds/')) {
                        return pathName.substr(8);
                    }
                    return null;
                },
                joinWorld: function(guid: string) {
                    instance.App.JoinWorld({ world_guid: guid}, () => {
                        $timeout(() => instance.StartWorld(guid), error => this.handleNoWorldOrOtherError(error));
                    });
                },
                joinAfterApproving: function(){
                    let worldGuid = this.getWorldGuid();
                    instance.App.JoinWorld({ world_guid: this.worldInfo.guid}, () => {
                        $timeout(() => instance.StartWorld(worldGuid), error => this.handleNoWorldOrOtherError(error));
                    });
                },
                joinToWorldIfNeed: function() {
                    if (this.windowMod == 'world-not-found'){
                        return;
                    }
                    let worldGuid = this.getWorldGuid();
                    if (worldGuid) {
                        for(let world of instance.mygames.list) {
                            if(world.guid == worldGuid) {
                                instance.StartWorld(worldGuid);
                                return;
                            }
                        }
                        // world is not found in exists
                        if (this.worldInfo){
                            this.showWorldInfo(this.worldInfo, 'approve-join')
                            return;
                        }
                        instance.App.GetWorldPublicInfo({worldGuid},
                            worldInfo => this.showWorldInfo(worldInfo, 'approve-join'),
                            error => this.handleNoWorldOrOtherError(error));

                    }

                },
                showWorldInfo: function(worldInfo, mode){
                    this.worldInfo = worldInfo;
                    this.windowMod = mode;
                    instance.current_window.show('enter-world');
                    $scope.$apply();
                },
                handleNoWorldOrOtherError: function(error){
                    if (error.message === 'error_world_not_found'){
                        this.windowMod = 'world-not-found'
                        instance.current_window.show('enter-world');
                        $scope.$apply();
                    } else {
                        vt.error(error.message);
                    }
                },
                checkIsWorldUrl: function(){
                    let worldGuid = this.getWorldGuid();
                    if (worldGuid) {
                        if (!instance.App.isLogged()) {
                            instance.App.GetWorldPublicInfo({worldGuid},
                                worldInfo => this.showWorldInfo(worldInfo, 'login'),
                                error => this.handleNoWorldOrOtherError(error));
                        }
                    }
                }
            },


        }

        // New world
        this.newgame = {
            loading: false,
            form: {
                title:  '',
                seed:   '',
                generator: {
                    id: null,
                    options: null
                }
            },
            reset() {
                this.form.title = '';
                this.form.seed  = '';
            },
            init() {
                // game modes
                instance.App.Gamemodes({}, (gamemodes) => {
                    $timeout(() => {
                        this.gamemodes.list = gamemodes;
                        for(let gm of this.gamemodes.list) {
                            gm.title = Lang[`gamemode_${gm.id}`]
                        }
                    });
                });
                // generators
                instance.App.Generators({}, (generators) => {
                    $timeout(() => {
                        this.generators.list = generators;
                    });
                });
            },
            gamemodes: {
                index: 0,
                list: [],
                get current() {
                    return this.list[this.index];
                },
                set current(item) {
                    for(let i in this.list) {
                        const t = this.list[i];
                        if(t.id == item.id) {
                            this.index = i;
                            break;
                        }
                    }
                },
                select(game_mode) {
                    const form = instance.newgame.form;
                    form.game_mode = game_mode.id;
                }
            },
            generators: {
                index: 0,
                list: [],
                get current() {
                    return this.list[this.index];
                },
                set current(item) {
                    for(let i in this.list) {
                        const t = this.list[i];
                        if(t.id == item.id) {
                            this.index = i;
                            break;
                        }
                    }
                },
                next() {
                    this.index = (this.index + 1) % this.list.length
                    this.select(this.current)
                },
                select(generator) {
                    const form = instance.newgame.form;
                    form.generator.id = generator.id;
                    const current = this.current;
                    if(!('has_options' in current)) {
                        current.has_options = !!current.options;
                    }
                    current.options_form = form.generator.options = current.options_form || {};
                    const options = current.options;
                    if(options) {
                        for(let k in options) {
                            const op = options[k];
                            let value = null;
                            switch(op.type) {
                                case 'checkbox': {
                                    value = op.default_value;
                                    break;
                                }
                                case 'select': {
                                    value = op.default_value ? op.default_value + '': op.options[0].value;
                                    break;
                                }
                                default: {
                                    console.error('Invalid generator option type');
                                    break;
                                }
                            }
                            form.generator.options[k] = value;
                        }
                    }
                    instance.initSelects('#world-generator-options .slim-select');
                }
            },
            submit() {
                var that = this;
                that.loading = true;
                let form = {...that.form};
                form.seed = instance.App.GenerateSeed(form.seed);
                instance.App.CreateWorld(form, (world) => {
                    $timeout(() => {
                        that.reset();
                        instance.mygames.add(world);
                        instance.StartWorld(world.guid);
                        that.loading = false;
                    });
                });
            },
            open() {
                this.generators.select(this.generators.list[0]);
                this.gamemodes.select(this.gamemodes.list[0]);
                instance.current_window.show('newgame');
                this.form.seed = instance.App.GenerateSeed(Helpers.getRandomInt(1000000, 4000000000));
            },
            close() {
                instance.current_window.show('main');
            }
        }

        // modal windows show/hide
        this.modalWindow = {
            show: function(modalId : string) {
                document.getElementById(modalId).style.visibility = 'visible';
                document.body.style.overflow = 'hidden';
            },
            hide: function(modalId : string) {
                document.getElementById(modalId).style.visibility = 'hidden';
                document.body.style.overflow = 'unset';
            },
        }

        this.onShow = {
            'skin': () => { this.skin.onShow() }
        }

        this.onHide = {
            'skin': () => { this.skin.onHide() }
        }
    
    }

    // Init
    async init()  {

        //
        const App = this.App = Qubatch.App = new UIApp()

        const that = this
        const {$timeout, $scope} = this

        // Working with lang
        await Lang.init()
        for(let item of Lang.list) {
            if(item.active) {
                this.current_lang = item
            }
        }

        this.current_window.show('main')
        this.newgame.init();
    
        this.texture_pack.init().then(() => {
            this.$timeout(() => {
                this.boot.init()
                this.login.init()
                this.mygames.enterWorld.checkIsWorldUrl()
            })
        })

        //
        Qubatch.onControlsEnabledChanged = (value) => {
            const bodyClassList = document.querySelector('body').classList;
            if(value) {
                bodyClassList.add('controls_enabled');
            } else {
                bodyClassList.remove('controls_enabled');
            }
        };

        Qubatch.onStarted = () => {
            const bodyClassList = document.querySelector('body').classList
            bodyClassList.add('started')
        }

        Qubatch.exit = () => {
            location.href = '/'
        }

        //
        App.onLogin = (e) => {}

        App.onLogout = (result) => {
            $timeout(() => {
                this.current_window.show('hello');
                location.reload()
            })
        }

        App.onError = (message) => {
            if (typeof message !== 'string') {
                // It happens: an exception Object is thrown on the server and sent as an error.
                // Don't show it, but log it.
                console.error(JSON.stringify(message))
                message = 'error'
            } else {
                console.error(message)
            }
            // special option - show alert
            let alert = false
            if (message.startsWith('!alert')) {
                message = message.substring(6)
                alert = true
            }
            // Multilingual messages
            message = Lang[message]

            if (alert) {
                window.alert(message)
            } else {
                vt.error(message)
            }
        }

    }

    //
    toggleMainMenu() {
        if(Qubatch.hud.wm.hasVisibleWindow()) {
            Qubatch.hud.wm.closeAll()
        } else {
            Qubatch.hud.frmMainMenu.show()
        }
    }

    //
    toggleFullscreen() {
        const el = document.getElementById('qubatch-canvas-container')
        if (!document.fullscreenElement) {
            el.requestFullscreen();
        } else if (document.exitFullscreen) {
            document.exitFullscreen()
        }
    }

    // Start world
    async StartWorld(world_guid : string) {

        this.skin.stop()
        if(window.event) {
            window.event.preventDefault();
            window.event.stopPropagation();
            if(isMobileBrowser()) {
                this.toggleFullscreen();
            }
            if((window.event as any).ctrlKey) {
                ClipboardHelper.copy(world_guid)
                vt.success(Lang.copied)
                return    
            }
        }
        console.log(`StartWorld: ${world_guid}`);

        // Check session
        const session = this.App.getSession()
        if(!session) {
            return;
        }

        //
        this.current_window.show('world-loading');
        Array.from(document.getElementsByTagName('header')).map(h => h.remove());
        document.getElementById('bg-canvas')?.remove();
        document.getElementById('bg-circles_area')?.remove();

        // stop background animation effect
        this.bg?.stop()

        // Show Loading...
        await this.showSplash()

        const instance = this // $scope

        // Continue loading
        this.$timeout(async () => {
            const options = instance.settings.form
            const location = window.location
            const form : IEnterWorld = {
                options,
                world_guid,
                location: {
                    protocol: location.protocol,
                    hostname: location.hostname,
                    port: location.port,
                }
            }
            instance.App.EnterToWorld(form, async (resp) => {
                const {server_url, world_guid} = resp
                const world = await instance.Qubatch.Start(server_url, world_guid, (resource_loading_state) => {
                    Qubatch.hud.draw(true)
                })
                Qubatch.hud.draw(true)
                if(!world.info) {
                    debugger
                }
                const player = new Player(options, Qubatch.render)
                // player.windows = new PlayerWindowManager(player)
                player.JoinToWorld(world, () => {
                    Qubatch.Started(player)
                })
            })
        })

    }

    async showSplash() {

        const Q: GameClass = Qubatch
        const render = Q.render
        const renderBackend = render.renderBackend

        Q.hud = new HUD(render.canvas)

        // we can use it both
        await Resources.preload({
            imageBitmap:    true,
            glsl:           renderBackend.kind === 'webgl',
            wgsl:           renderBackend.kind === 'webgpu'
        })

        await renderBackend.init({
            shaderPreprocessor: Resources.shaderPreprocessor
        })

        render.resetAfter();
        Q.hud.wm.initRender(render)
        render.resetBefore();

        const bodyClassList = document.querySelector('body').classList
        bodyClassList.add('started')

        // Start drawing HUD with loading screen
        render.requestAnimationFrame(Q.preLoop)
    }

    // loadingComplete
    loadingComplete() {
        document.getElementById('loading').classList.add('loading-complete')
        this.loading.completed = true
    }

    syncTime() {
        this.App.SyncTime((resp: TApiSyncTimeResponse) => {
            const twoSidedLag = MonotonicUTCDate.nowWithoutExternalCorrection() - resp.clientUTCDate
            if (twoSidedLag > CLIENT_MAX_SYNC_TIME_TWO_SIDED_LAG) {
                console.warn('Lag is too high to synchronize time: ', Math.round(twoSidedLag))
                this.syncTime()
            } else {
                const diff = Math.round(resp.serverUTCDate - (resp.clientUTCDate + twoSidedLag * 0.5))
                MonotonicUTCDate.setExternalCorrection(diff)
                console.log(`Time difference with server: ${diff} ms`)
                this.onMyGamesLoadedOrTimeSynchronized()
            }
        }, (err) => {
            // try until we succeed
            setTimeout(() => { this.syncTime() }, 1000)
        })
    }

    onMyGamesLoadedOrTimeSynchronized() {
        if (!this.mygames.loading && MonotonicUTCDate.externalCorrectionInitialized) {
            this.loadingComplete()
        }
    }

    //
    initSelects(selector? : string) {
        selector = selector ?? '.slim-select'
        this.$timeout(() => {
            const selects = document.querySelectorAll(selector)
            try {
                selects.forEach((selectElement) => {
                    new SlimSelect({
                        select: selectElement,
                        showSearch: false
                    });
                    // setSlimData(selectElement)
                })
            } catch(e) {
                console.debug('error', e)
            }
        }, 0)
    }

    // Is mobile browser
    isMobileBrowser() {
        return isMobileBrowser()
    }

    isJoystickControl() {
        return isMobileBrowser() || this.settings.form.forced_joystick_control
    }
    
    changeLang(item) {
        Lang.change(item)
        // $window.location.reload() // так не всё переводится, потому что уже какие-то игровые окошки прогружены
        location.reload()
    }

}

const gameCtrl = async function($scope : any, $timeout : any) {

    const gc = new GameController($scope, $timeout)
    await gc.init()
    for(const func_name of ['isMobileBrowser', 'changeLang', 'StartWorld', 'isJoystickControl', 'initSelects', 'onMyGamesLoadedOrTimeSynchronized', 'syncTime', 'loadingComplete', 'showSplash', 'toggleMainMenu', 'toggleFullscreen', 'init']) {
        $scope[func_name] = gc[func_name].bind(gc)
    }

    Object.assign($scope, gc)

}

app.controller('gameCtrl', ['$scope', '$timeout', gameCtrl]);

// myEnter directive
const directive = function($q) {
    return function(scope, element, attrs) {
        element.bind('keydown keypress', function(event) {
            if(event.which === KEY.ENTER) {
                if(!event.shiftKey) {
                    scope.$apply(function() {
                        scope.$eval(attrs.myEnter);
                    });
                    event.preventDefault();
                }
            }
        });
    };
};
app.directive('myEnter', ['$q', directive])

// from https://stackoverflow.com/questions/20146713/ng-change-on-input-type-file
app.directive("ngUploadChange",function(){
    return{
        scope:{
            ngUploadChange:"&"
        },
        link:function($scope, $element, $attrs){
            $element.on("change",function(event){
                $scope.$apply(function(){
                    $scope.ngUploadChange({$event: event})
                })
            })
            $scope.$on("$destroy",function(){
                $element.off();
            });
        }
    }
})