import { Helpers, isMobileBrowser, Vector } from '../helpers.js';
import { DEFAULT_FOV_NORMAL } from '../render.js';
import { UIApp } from './app.js';
import { TexturePackManager } from './texture_pack-manager.js';
import { SkinManager } from './skin-manager.js';
import { GameClass } from '../game.js';
import { Player } from '../player.js';
import { Lang } from "../lang.js";
import { KEY, MOUSE, DEFAULT_MUSIC_VOLUME } from "../constant.js";
// import { BgEffect } from './bg_effect.js';
import  registerTextFilter from './angular/textfilter.js';
import { Resources } from '../resources.js';
// import { PlayerWindowManager } from '../player_window_manager.js';

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
    const isChrome = navigator.userAgent.indexOf('Chrome') > -1 || self.chrome;
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
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )
    }
}

const app = angular.module('gameApp', []);
registerTextFilter(app);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = async function($scope, $timeout) {

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
    globalThis.Qubatch              = new GameClass();
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
        location = '/';
    };

    $scope.links = {
        discord: 'https://discord.gg/QQw2zadu3T',
        youtube: 'https://www.youtube.com/channel/UCAcOZMpzYE8rk62giMgTwdw/videos'
    };

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
        }
        // special option - show alert
        let alert = false
        if (message.startsWith('!alert')) {
            message = message.substring(6)
            console.error(message)
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
            Clipboard.copy(this.url);
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
        form: {
            fov: DEFAULT_FOV_NORMAL,
            music_volume: DEFAULT_MUSIC_VOLUME,
            texture_pack: 'base',
            render_distance: 4,
            use_light: 1,
            beautiful_leaves: true,
            mipmap: false,
            mobs_draw_debug_grid: false,
            chunks_draw_debug_grid: false,
            cluster_draw_debug_grid: false
        },
        lightMode: {
            list: [{id: 0, name: 'No'}, {id: 1, name: 'Smooth'}, {id: 2, name: 'RTX'}],
            get current() {
                return this.list[$scope.settings.form.use_light];
            },
            set current(item) {
                $scope.settings.form.use_light = item.id;
            }
        },
        save: function() {
            localStorage.setItem('settings', JSON.stringify(this.form));
            $scope.current_window.show('main');
        },
        toggle: function() {
            $scope.current_window.toggle('settings');
            return false;
        },
        load: function() {
            const form = localStorage.getItem('settings');
            if(form) {
                this.form = Object.assign(this.form, JSON.parse(form));
            }
            // add default render_distance
            if(!('render_distance' in this.form)) {
                this.form.render_distance = 4;
            }
            // use_light
            if('use_light' in this.form) {
                this.form.use_light = parseInt(this.form.use_light | 0);
            }
            // forced Joystick control
            if(!('forced_joystick_control' in this.form)) {
                this.form.forced_joystick_control = false;
            }
            // draw improved blocks
            if(!('draw_improved_blocks' in this.form)) {
                this.form.draw_improved_blocks = true;
            }
            // mouse sensitivity
            if(!('mouse_sensitivity' in this.form)) {
                this.form.mouse_sensitivity = 100;
            }
            this.form.fov = this.form.fov || DEFAULT_FOV_NORMAL;
            this.form.music_volume = this.form.music_volume ?? DEFAULT_MUSIC_VOLUME;
        },
        updateSlider: function (inputId) {
            const slider = document.getElementById(inputId);
            const step = parseInt(slider.getAttribute("step"));
            const perc = (slider.value - slider.min) / (slider.max - slider.min) * 100;
            // track background
            slider.style.backgroundImage = "linear-gradient(to right, #FFAB00 " + perc + "%, #3F51B5 " + perc + "%)";
            // ticks set active
            const ticks = document.getElementById(inputId + '_ticks').children;
            const tickMarks = Array.prototype.slice.call(ticks);
            tickMarks.map(function (tick, index) {
                var tickIndex = index * step;
                tick.classList.remove("active");
                tick.classList.remove("passed");
                if (tickIndex <= Math.floor(slider.value)) {
                    tick.classList.add("passed");
                    if (tickIndex == Math.round(slider.value)) {
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
        init: function() {
            // do nothing
        }
    };

    // Delete world
    $scope.DeleteWorld = {
        world_guid: '',
        world_title: '',
        showModal: function(world_guid) {
            $scope.modalWindow.show('modal-delete-world');
            this.world_guid = world_guid;
            for(let w of $scope.mygames.list) {
                if(w.guid == world_guid) {
                    this.world_title = w.title;
                    break;
                }
            }
        },
        delete: function() {
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
        if (!document.fullscreenElement &&    // alternative standard method
            !document.mozFullScreenElement && !document.webkitFullscreenElement) {  // current working methods
            if (el.requestFullscreen) {
                el.requestFullscreen();
            } else if (el.mozRequestFullScreen) {
                el.mozRequestFullScreen();
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        } else {
            if (document.cancelFullScreen) {
                document.cancelFullScreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            }
        }
    };

    // Start world
    $scope.StartWorld = async function(world_guid) {
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
            const world = await $scope.Qubatch.Start(server_url, world_guid, options, (resource_loading_state) => {
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

        /**
         * @type {GameClass}
         */
        const Q = Qubatch
        const render = Q.render
        const renderBackend = render.renderBackend

        // we can use it both
        await Resources.preload({
            imageBitmap:    true,
            glsl:           renderBackend.kind === 'webgl',
            wgsl:           renderBackend.kind === 'webgpu'
        })

        await renderBackend.init({
            blocks: Resources.shaderBlocks
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

    // My games
    $scope.mygames = {
        list: [],
        shared_worlds: [],
        loading: false,
        toMain: function(){
            location = '/';
        },
        load: function() {
            const session = $scope.App.getSession();
            if(!session) {
                return that.loadingComplete();
            }
            const that = this;
            that.loading = true;
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
                    $scope.loadingComplete();
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
                    vt.error(message);
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
        show: function(modalId) {
            document.getElementById(modalId).style.visibility = 'visible';
            document.body.style.overflow = 'hidden';
        },
        hide: function(modalId) {
            document.getElementById(modalId).style.visibility = 'hidden';
            document.body.style.overflow = 'unset';
        },
    };

    $scope.settings.load();
    $scope.Qubatch      = globalThis.Qubatch;
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

gameCtrl.$inject = injectParams;
app.controller('gameCtrl', gameCtrl);

// myEnter directive
let myEnterInjectParams = ['$q'];
let directive = function($q) {
    return function(scope, element, attrs) {
        element.bind('keydown keypress', function(event) {
            if(event.which === 13) {
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
directive.$inject = myEnterInjectParams;
app.directive('myEnter', directive);

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