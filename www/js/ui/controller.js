import {Vector, Helpers} from '../helpers.js';
import {UIApp} from './app.js';
import {TexturePackManager} from './texture_pack-manager.js';
import {SkinManager} from './skin-manager.js';
import {GameClass} from '../game.js';
import { Player } from '../player.js';
import { Lang } from "../lang.js";
import { KEY, MOUSE } from "../constant.js";
import { BgEffect } from './bg_effect.js';

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
    return crypto.randomUUID();
};

const app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = async function($scope, $timeout) {

    await Lang.init();

    globalThis.Qubatch              = new GameClass();
    $scope.App                      = Qubatch.App = new UIApp();
    $scope.Lang                     = Lang;

    $scope.changeLang = (item) => {
        Lang.change(item);
        // $window.location.reload(); // так не всё переводится, потому что уже какие-то игровые окошки прогружены
        location.reload();
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
        // Multilingual messages
        message = Lang[message]
        vt.error(message);
    };

    //
    $scope.shareGame = {
        visible: false,
        url: '',
        toggle: function() {
            this.url = location.protocol + '//' + location.host + '#world_' + Qubatch.world.info.guid;
            this.visible = !this.visible;
        },
        copy: function() {
            Clipboard.copy(this.url);
            vt.success(Lang.copied);
        }
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
    $scope.current_window.show('main');

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
            texture_pack: 'base',
            render_distance: 4,
            use_light: 1,
            mipmap: false
        },
        lightMode: {
            list: [{id: 0, name: 'No'}, {id: 1, name: 'Normal'}, {id: 2, name: 'RTX'}],
            getCurrent: function() {
                return this.list[$scope.settings.form.use_light];
            },
            next: function() {
                $scope.settings.form.use_light = ($scope.settings.form.use_light + 1) % this.list.length;
            }
        },
        save: function() {
            localStorage.setItem('settings', JSON.stringify(this.form));
        },
        toggle: function() {
            $scope.current_window.toggle('settings');
        },
        load: function() {
            const form = localStorage.getItem('settings');
            if(form) {
                this.form = Object.assign(this.form, JSON.parse(form));
                // fix texture_pack id
                if('texture_pack' in this.form) {
                    let found = false;
                    for(let tp of $scope.texture_pack.list) {
                        if(tp.id == this.form.texture_pack) {
                            found = true;
                        }
                    }
                    if(!found) {
                        this.form.texture_pack = $scope.texture_pack.list[0].id;
                    }
                }
                // add default render_distance
                if(!('render_distance' in this.form)) {
                    this.form.render_distance = 4;
                }
                // use_light
                if('use_light' in this.form) {
                    this.form.use_light = parseInt(this.form.use_light | 0);
                }
            }
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
    $scope.DeleteWorld = function(world_guid) {
        window.event.preventDefault();
        window.event.stopPropagation();
        if(!confirm(Lang.confirm_delete_world)) {
            return false;
        }
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
    };

    // Start world
    $scope.StartWorld = function(world_guid) {
        if(window.event) {
            window.event.preventDefault();
            window.event.stopPropagation();
        }
        console.log(`StartWorld: ${world_guid}`);
        // Check session
        const session = $scope.App.getSession();
        if(!session) {
            return;
        }
        document.getElementById('main-pictures')?.remove();
        document.getElementById('topbar')?.remove();
        document.getElementById('bg-canvas')?.remove();
        document.getElementById('bg-circles_area')?.remove();
        document.getElementById('main-menu')?.remove();
        // stop background animation effect
        $scope.bg?.stop();
        // Show Loading...
        Qubatch.hud.draw();
        $timeout(async function() {
            $scope.settings.save();
            const server_url = (window.location.protocol == 'https:' ? 'wss:' : 'ws:') +
                '//' + location.hostname +
                (location.port ? ':' + location.port : '') +
                '/ws';
            const world = await $scope.Qubatch.Start(server_url, world_guid, $scope.settings.form, (resource_loading_state) => {
                Qubatch.hud.draw(true);
            });
            if(!world.info) {
                debugger;
            }
            const player = new Player();
            player.JoinToWorld(world, () => {
                Qubatch.Started(player);
            });
        });
    };

    // loadingComplete
    $scope.loadingComplete = function() {
        document.getElementById('loading').classList.add('loading-complete');
    }

    // My games
    $scope.mygames = {
        list: [],
        shared_worlds: [],
        loading: false,
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
                    /*
                    that.shared_worlds = [];
                    for(let w of worlds) {
                        w.my = w.user_id == session.user_id;
                        if(!w.my) {
                            that.shared_worlds.push(w);
                        }
                    }*/
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
        worldExists: function(guid) {
            for(let world of this.list) {
                if(world.guid == guid) {
                    return true;
                }
            }
            return false;
        },
        checkInvite: function() {
            var that = this;
            let hash = window.location.hash;
            if(hash && hash.startsWith('#world_')) {
                if(!$scope.App.isLogged()) {
                    vt.success(Lang.error_not_logged);
                    return;
                }
                let world_guid = hash.substr(7);
                if(that.worldExists(world_guid)) {
                    return false;
                }
                $scope.App.JoinWorld({world_guid: world_guid}, (resp) => {
                    $timeout(() => {
                        that.list.push(resp);
                        vt.success(Lang.you_invited_to_world + ' ' + hash);
                        location.href = location.protocol + '//' + location.host;
                        that.loading = false;
                    });
                });
                return true;
            }
        }
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
        reset: function() {
            this.form.title = '';
            this.form.seed  = '';
        },
        generators: {
            index: 0,
            list: [
                {id: 'biome2', title: Lang.world_generator_type_default, options: {
                    auto_generate_mobs: {
                        title: Lang.world_generator_generate_mobs,
                        type: 'select',
                        options: [
                            {value: true, title: 'Yes'},
                            {value: false, title: 'No'}
                        ]
                    }
                }},
                {id: 'city', title: Lang.generator_city1},
                {id: 'city2', title: Lang.generator_city2},
                {id: 'bottom_caves', title: Lang.bottom_caves},
                {id: 'flat', title: Lang.generator_flat_world},
                // {id: 'test_trees', title: 'Тестовые деревья'},
                // {id: 'mine', title: 'Заброшенная шахта'}
            ],
            getCurrent: function() {
                return this.list[this.index];
            },
            next: function() {
                this.index = (this.index + 1) % this.list.length;
                this.select(this.getCurrent().id);
            },
            toggleSelect: function(key) {
                const form = $scope.newgame.form;
                if(!form.generator.options) {
                    return null;
                }
                const value = form.generator.options[key];
                const op = this.getCurrent().options[key];
                let next_index = 0;
                for(let i in op.options) {
                    const option = op.options[i];
                    if(value == option.value) {
                        next_index = parseInt(i) + 1;
                    }
                }
                form.generator.options[key] = op.options[next_index % op.options.length].value;
            },
            getSelectTitle: function(key) {
                const form = $scope.newgame.form;
                if(!form.generator.options) {
                    return null;
                }
                const value = form.generator.options[key];
                const op = this.getCurrent().options[key];
                for(let option of op.options) {
                    if(option.value == value) {
                        return option.title;
                    }
                }
                return value;
            },
            select: function(id) {
                $scope.newgame.form.generator.id = id;
                const form = $scope.newgame.form;
                this.getCurrent().options_form = form.generator.options = this.getCurrent().options_form || {};
                const options = this.getCurrent().options;
                if(options) {
                    for(let k in options) {
                        const op = options[k];
                        let value = null;
                        switch(op.type) {
                            case 'select': {
                                value = op.options[0].value;
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
            }
        },
        submit: function() {
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
        open: function() {
            this.generators.select(this.generators.list[0].id);
            $scope.current_window.show('newgame');
            this.form.seed = $scope.App.GenerateSeed(Helpers.getRandomInt(1000000, 4000000000));
        },
        close: function() {
            $scope.current_window.show('main');
        }
    };

    $scope.Qubatch      = globalThis.Qubatch;
    $scope.skin         = new SkinManager($scope);
    $scope.texture_pack = new TexturePackManager($scope);
    
    $scope.texture_pack.init().then(() => {
        $timeout(() => {
            $scope.settings.load();
            $scope.boot.init();
            $scope.login.init();
            $scope.skin.init();
            $scope.mygames.checkInvite();
        });
    });

    //
    $scope.bg = new BgEffect();

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