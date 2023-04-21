/// <reference path="../global-client.d.ts" />

import {CLIENT_MAX_SYNC_TIME_TWO_SIDED_LAG, Helpers, isMobileBrowser, MonotonicUTCDate, TApiSyncTimeResponse, Vector} from '../helpers.js';
import { UIApp } from './app.js';
import { TexturePackManager } from './texture_pack-manager.js';
import { SkinManager } from './skin-manager.js';
import { GameClass } from '../game.js';
import { Player } from '../player.js';
import { Lang } from "../lang.js";
import { KEY, MOUSE } from "../constant.js";
import  registerTextFilter from './angular/textfilter.js';
import { Resources } from '../resources.js';
import { ClipboardHelper } from './clipboard.js';
import { HUD } from '../hud.js';
import { BBModel_Preview } from './bbmodel_preview.js';

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

let gameCtrl = async function($scope : any, $timeout : any) {

    // Working with lang
    await Lang.init();
    $scope.Lang = Lang;
    $scope.current_lang = null;
    $scope.loading_completed = false;
    for(let item of Lang.list) {
        if(item.active) {
            $scope.current_lang = item;
        }
    }
    $scope.changeLang = (item) => {
        Lang.change(item);
        // $window.location.reload(); // так не всё переводится, потому что уже какие-то игровые окошки прогружены
        location.reload();
    };

    //
    (globalThis as any).Qubatch     = new GameClass();
    $scope.App                      = Qubatch.App = new UIApp();
    $scope.login_tab                = 'login';

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
        const bodyClassList = document.querySelector('body').classList;
        bodyClassList.add('started');
    };

    Qubatch.exit = () => {
        location.href = '/';
    };

    $scope.links = {
        discord: 'https://discord.gg/QQw2zadu3T',
        youtube: 'https://www.youtube.com/channel/UCAcOZMpzYE8rk62giMgTwdw/videos'
    };

    //
    $scope.bbmodel_preview = new BBModel_Preview()

    //
    $scope.App.onLogin = (e) => {};
    $scope.App.onLogout = (result) => {
        $timeout(function(){
            $scope.current_window.show('hello');
            location.reload();
        });
    }
    $scope.App.onError = (message) => {
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
    };

    //
    $scope.shareGame = {
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
    };

    // Is mobile browser
    $scope.isMobileBrowser = isMobileBrowser;
    $scope.isJoystickControl = () => {
        return isMobileBrowser() || $scope.settings.form.forced_joystick_control;
    };

    // sun dir
    $scope.sunDir = {
        value: new Vector(1.1493, 1.0293, 0.6293),
        apply: function() {
            // 0.84 1 -1
            if(typeof Qubatch != 'undefined') {
                Qubatch.render.sunDir = [this.value.x, this.value.y, this.value.z];
            }
        },
        getValue: function() {
            // 1.1493, 1.0293, 0.6293
            return [this.value.x, this.value.y, this.value.z].join(', ');
        }
    };

    $scope.isSupportedBrowser = isSupported();

    // Current window
    $scope.current_window = {
        id: 'main',
        show: function(id) {
            if(!$scope.isSupportedBrowser) {
                id = 'not_supported_browser';
            }
            this.id = id;
            if ($scope.onShow[id]) {
                $scope.onShow[id]();
            }
        },
        toggle(id) {
            if(this.id != id) {
                this.show(id);
            } else {
                this.show('main');
            }
        },
        getTitle: function() {
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
    };

    // Login
    $scope.login = {
        logged: false,
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
            $scope.App.Login(this.form, (resp) => {
                $timeout(() => {
                    that.logged = true;
                    that.reset();
                    that.onSuccess(resp);
                    $scope.current_window.show('main');
                    that.loading = false;
                });
            });
        },
        autoLogin: function(form) {
            this.form.username = form.username;
            this.form.password = form.password;
            $scope.current_window.show('login');
            this.submit();
        },
        reset: function() {
            this.form.username = '';
            this.form.password = '';
        },
        isValid: function() {
            return this.form.username && this.form.password;
        },
        init: function() {
            let session = $scope.App.getSession();
            this.logged = !!session;
            if(!this.logged) {
                $scope.current_window.show('hello');
                $scope.loadingComplete();
                return false;
            }
            this.onSuccess(session);
        },
        onSuccess(session) {
            $scope.mygames.load();
        }
    };

    // Registration
    $scope.registration = {
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
            $scope.App.Registration(this.form, (resp) => {
                $timeout(() => {
                    $scope.login.autoLogin(that.form);
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
    };

    // Settings
    $scope.settings = {
        form: Qubatch.settings,
        lightMode: {
            list: [{id: 0, name: 'No'}, {id: 1, name: 'Smooth'}, {id: 2, name: 'RTX'}],
            get current() {
                return this.list[$scope.settings.form.use_light];
            },
            set current(item) {
                $scope.settings.form.use_light = item.id;
            }
        },
        chunkGeometryMode: {
            list: [{id: 0, name: 'Auto'}, {id: 1, name: 'One per chunk'}, {id: 2, name: 'Big (multidraw)'}, {id: 3, name: 'Big (no multidraw)'}],
            get current() {
                return this.list[$scope.settings.form.chunk_geometry_mode];
            },
            set current(item) {
                $scope.settings.form.chunk_geometry_mode = item.id;
            }
        },
        chunkGeometryAlloc: {
            list: [{id: 0, name: 'Auto'}, {id: 64, name: '64 MB'}, {id: 125, name: '125 MB'}, {id: 250, name: '250 MB'}, {id: 375, name: '375 MB'},
                {id: 500, name: '500 MB'}, {id: 750, name: '750 MB'}, {id: 1000, name: '1000 MB'}],
            get current() {
                let t = this.list.find((x) => x.id === $scope.settings.form.chunk_geometry_alloc);
                if (!t) t = this.list[0];
                return t;
            },
            set current(item) {
                $scope.settings.form.chunk_geometry_alloc = item.id;
            }
        },
        save: function() {
            this.form.save()
            $scope.current_window.show('main');
        },
        toggle: function() {
            $scope.current_window.toggle('settings');
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
    };

    // Boot
    $scope.boot = {
        loading: false,
        latest_save: false,
        init() {
            // do nothing
        }
    };

    // Delete world
    $scope.DeleteWorld = {
        world_guid: '',
        world_title: '',
        showModal(world_guid) {
            $scope.modalWindow.show('modal-delete-world');
            this.world_guid = world_guid;
            for(let w of $scope.mygames.list) {
                if(w.guid == world_guid) {
                    this.world_title = w.title;
                    break;
                }
            }
        },
        delete() {
            var world_guid = this.world_guid;
            window.event.preventDefault();
            window.event.stopPropagation();
            // if(!confirm(Lang.confirm_delete_world)) {
            //     return false;
            // }
            let world = null;
            for(let w of $scope.mygames.list) {
                if(w.guid == world_guid) {
                    world = w;
                    break;
                }
            }
            if(!world) {
                return Qubatch.App.showError('error_world_not_found', 4000);
            }
            world.hidden = true;
            $scope.App.DeleteWorld({world_guid}, () => {
                vt.success(Lang.success_world_deleted);
            }, (e) => {
                $timeout(() => {
                    world.hidden = false;
                });
                vt.error(e.message);
            });
            $scope.modalWindow.hide('modal-delete-world');
        },
    };

    //
    $scope.toggleMainMenu = function() {
        if(Qubatch.hud.wm.hasVisibleWindow()) {
            Qubatch.hud.wm.closeAll();
        } else {
            Qubatch.hud.frmMainMenu.show();
        }
    }

    //
    $scope.toggleFullscreen = function () {
        const el = document.getElementById('qubatch-canvas-container');
        if (!document.fullscreenElement) {
            el.requestFullscreen();
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    };

    // Start world
    $scope.StartWorld = async function(world_guid : string) {
        $scope.bbmodel_preview.stop()
        if(window.event) {
            window.event.preventDefault();
            window.event.stopPropagation();
            if(isMobileBrowser()) {
                $scope.toggleFullscreen();
            }
        }
        console.log(`StartWorld: ${world_guid}`);
        // Check session
        const session = $scope.App.getSession();
        if(!session) {
            return;
        }
        //
        $scope.current_window.show('world-loading');
        Array.from(document.getElementsByTagName('header')).map(h => h.remove());
        document.getElementById('bg-canvas')?.remove();
        document.getElementById('bg-circles_area')?.remove();
        // stop background animation effect
        $scope.bg?.stop();

        // Show Loading...
        await this.showSplash()

        // Continue loading
        $timeout(async function() {
            const options = $scope.settings.form;
            const server_url = (window.location.protocol == 'https:' ? 'wss:' : 'ws:') +
                '//' + location.hostname +
                (location.port ? ':' + location.port : '') +
                '/ws';
            const world = await $scope.Qubatch.Start(server_url, world_guid, (resource_loading_state) => {
                Qubatch.hud.draw(true);
            });
            if(!world.info) {
                debugger;
            }
            const player = new Player(options, Qubatch.render)
            // player.windows = new PlayerWindowManager(player)
            player.JoinToWorld(world, () => {
                Qubatch.Started(player);
            });
        })

    }

    $scope.showSplash = async () => {

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
    $scope.loadingComplete = function() {
        document.getElementById('loading').classList.add('loading-complete');
        $scope.loading_completed = true;
    }

    $scope.syncTime = function() {
        $scope.App.SyncTime((resp: TApiSyncTimeResponse) => {
            const twoSidedLag = MonotonicUTCDate.nowWithoutExternalCorrection() - resp.clientUTCDate
            if (twoSidedLag > CLIENT_MAX_SYNC_TIME_TWO_SIDED_LAG) {
                console.warn('Lag is too high to synchronize time: ', Math.round(twoSidedLag))
                $scope.syncTime()
            } else {
                const diff = Math.round(resp.serverUTCDate - (resp.clientUTCDate + twoSidedLag * 0.5))
                MonotonicUTCDate.setExternalCorrection(diff)
                console.log(`Time difference with server: ${diff} ms`)
                $scope.onMyGamesLoadedOrTimeSynchronized()
            }
        }, (err) => {
            // try until we succeed
            setTimeout(() => { $scope.syncTime() }, 1000)
        })
    }

    $scope.onMyGamesLoadedOrTimeSynchronized = function() {
        if (!$scope.mygames.loading && MonotonicUTCDate.externalCorrectionInitialized) {
            $scope.loadingComplete()
        }
    }

    // My games
    $scope.mygames = {
        list: [],
        shared_worlds: [],
        loading: false,
        toMain: function(){
            location.href = '/';
        },
        load: function() {
            const session = $scope.App.getSession();
            if(!session) {
                return $scope.loadingComplete();
            }
            const that = this;
            that.loading = true;
            $scope.syncTime();
            $scope.App.MyWorlds({}, (worlds) => {
                $timeout(() => {
                    that.list = worlds;
                    for(let w of worlds) {
                        w.game_mode_title = Lang[`gamemode_${w.game_mode}`];
                    }
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
                    $scope.onMyGamesLoadedOrTimeSynchronized();
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
            joinAfterApproving: function(){
                let worldGuid = this.getWorldGuid();
                $scope.App.JoinWorld({ world_guid: this.worldInfo.guid}, () => {
                    $timeout(() => $scope.StartWorld(worldGuid), error => this.handleNoWorldOrOtherError(error));
                });
            },
            joinToWorldIfNeed: function() {
                if (this.windowMod == 'world-not-found'){
                    return;
                }
                let worldGuid = this.getWorldGuid();
                if (worldGuid) {
                    for(let world of $scope.mygames.list) {
                        if(world.guid == worldGuid) {
                            $scope.StartWorld(worldGuid);
                            return;
                        }
                    }
                    // world is not found in exists
                    if (this.worldInfo){
                        this.showWorldInfo(this.worldInfo, 'approve-join')
                        return;
                    }
                    $scope.App.GetWorldPublicInfo({worldGuid},
                        worldInfo => this.showWorldInfo(worldInfo, 'approve-join'),
                        error => this.handleNoWorldOrOtherError(error));

                }

            },
            showWorldInfo: function(worldInfo, mode){
                this.worldInfo = worldInfo;
                this.windowMod = mode;
                $scope.current_window.show('enter-world');
                $scope.$apply();
            },
            handleNoWorldOrOtherError: function(error){
                if (error.message === 'error_world_not_found'){
                    this.windowMod = 'world-not-found'
                    $scope.current_window.show('enter-world');
                    $scope.$apply();
                } else {
                    vt.error(error.message);
                }
            },
            checkIsWorldUrl: function(){
                let worldGuid = this.getWorldGuid();
                if (worldGuid) {
                    if (!$scope.App.isLogged()) {
                        $scope.App.GetWorldPublicInfo({worldGuid},
                             worldInfo => this.showWorldInfo(worldInfo, 'login'),
                             error => this.handleNoWorldOrOtherError(error));
                    }
                }
            }
        },


    };

    // New world
    $scope.newgame = {
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
            $scope.App.Gamemodes({}, (gamemodes) => {
                $timeout(() => {
                    this.gamemodes.list = gamemodes;
                    for(let gm of this.gamemodes.list) {
                        gm.title = Lang[`gamemode_${gm.id}`]
                    }
                });
            });
            // generators
            $scope.App.Generators({}, (generators) => {
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
                const form = $scope.newgame.form;
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
                const form = $scope.newgame.form;
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
                $scope.initSelects('#world-generator-options .slim-select');
            }
        },
        submit() {
            var that = this;
            that.loading = true;
            let form = {...that.form};
            form.seed = $scope.App.GenerateSeed(form.seed);
            $scope.App.CreateWorld(form, (world) => {
                $timeout(() => {
                    that.reset();
                    $scope.mygames.add(world);
                    $scope.StartWorld(world.guid);
                    that.loading = false;
                });
            });
        },
        open() {
            this.generators.select(this.generators.list[0]);
            this.gamemodes.select(this.gamemodes.list[0]);
            $scope.current_window.show('newgame');
            this.form.seed = $scope.App.GenerateSeed(Helpers.getRandomInt(1000000, 4000000000));
        },
        close() {
            $scope.current_window.show('main');
        }
    };

    //
    $scope.initSelects = function(selector) {
        $timeout(() => {
            const selects = document.querySelectorAll(selector ?? '.slim-select')
            selects.forEach((selectElement) => {
                new SlimSelect({
                    select: selectElement,
                    showSearch: false
                });
                // setSlimData(selectElement)
            })
        }, 0);
    }

    // modal windows show/hide
    $scope.modalWindow = {
        show: function(modalId : string) {
            document.getElementById(modalId).style.visibility = 'visible';
            document.body.style.overflow = 'hidden';
        },
        hide: function(modalId : string) {
            document.getElementById(modalId).style.visibility = 'hidden';
            document.body.style.overflow = 'unset';
        },
    };

    $scope.Qubatch      = (globalThis as any).Qubatch;
    $scope.skin         = new SkinManager($scope, $timeout);
    $scope.texture_pack = new TexturePackManager($scope);
    $scope.onShow       = {
        'skin': () => { $scope.skin.onShow(); }
    };
    $scope.newgame.init();

    $scope.texture_pack.init().then(() => {
        $timeout(() => {
            $scope.boot.init();
            $scope.login.init();
            $scope.skin.init();
            $scope.mygames.enterWorld.checkIsWorldUrl();
        });
    });

    // Background animation
    // $scope.bg = new BgEffect()

    // show the window after everything is initilized
    $scope.current_window.show('main');
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
app.directive('myEnter', ['$q', directive]);

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
});