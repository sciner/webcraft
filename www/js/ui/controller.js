import {Vector, Helpers} from '../helpers.js';
import {UIApp} from './app.js';
import {TexturePackManager} from './texture_pack-manager.js';
import {SkinManager} from './skin-manager.js';
import {GameClass} from '../game.js';

// Mouse event enumeration
window.MOUSE      = {};
    MOUSE.DOWN    = 1;
    MOUSE.UP      = 2;
    MOUSE.MOVE    = 3;
    MOUSE.CLICK   = 4;
    MOUSE.BUTTON_LEFT   = 0;
    MOUSE.BUTTON_WHEEL  = 1;
    MOUSE.BUTTON_RIGHT  = 2;

window.KEY          = {};
    KEY.BACKSPACE   = 8;
    KEY.ENTER       = 13;
    KEY.SHIFT       = 16;
    KEY.ESC         = 27;
    KEY.SPACE       = 32;
    KEY.PAGE_UP     = 33;
    KEY.PAGE_DOWN   = 34;
    KEY.ARROW_UP    = 38;
    KEY.ARROW_DOWN  = 40;
    KEY.A           = 65;
    KEY.C           = 67;
    KEY.D           = 68;
    KEY.E           = 69;
    KEY.J           = 74;
    KEY.R           = 82;
    KEY.S           = 83;
    KEY.T           = 84;
    KEY.W           = 87;
    KEY.F1          = 112;
    KEY.F2          = 113;
    KEY.F3          = 114;
    KEY.F4          = 115;
    KEY.F5          = 116;
    KEY.F6          = 117;
    KEY.F7          = 118;
    KEY.F8          = 119;
    KEY.F9          = 120;
    KEY.F10         = 121;
    KEY.F11         = 122;
    KEY.SLASH       = 191;
    KEY.F11         = 122;

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = function($scope, $timeout) {

    window.Game                     = new GameClass();

    Game.preload();

    $scope.App                      = Game.App = new UIApp();
    $scope.texture_pack             = new TexturePackManager($scope);
    $scope.skin                     = new SkinManager($scope);

    //
    $scope.App.onLogin = (e) => {

    };
    $scope.App.onLogout = () => $scope.current_window.show('hello');
    $scope.App.onError = (message) => {
        // Multilingual messages
        if(message in $scope.lang) {
            message = $scope.lang[message];
        }
        vt.error(message);
    };

    // Lang
    $scope.lang = {
        enter_your_name: 'Enter your name',
        enter_your_password: 'Enter password',
        error_user_already_registered: 'User already registered',
        error_invalid_login_or_password: 'Invalid login or password',
        error_player_exists_in_selected_world: 'You already exists in this world',
        share_game_with_friends: 'Share world with friends',
        error_not_logged: 'Login before open invite link',
        copied: 'Copied',
        copy: 'Copy',
        registration: 'Registration',
        submit: 'Submit',
        back: 'Back',
        login: 'Login',
        enter: 'Enter'
    };

    //
    $scope.shareGame = {
        visible: false,
        url: '',
        toggle: function() {
            this.url = location.protocol + '//' + location.host + '#world_' + Game.world.info.guid;
            this.visible = !this.visible;
        },
        copy: function() {
            Clipboard.copy(this.url);
            vt.success($scope.lang.copied);
        }
    };

    // sun dir
    $scope.sunDir = {
        value: new Vector(1.1493, 1.0293, 0.6293),
        apply: function() {
            // 0.84 1 -1
            if(typeof Game != 'undefined') {
                Game.render.sunDir = [this.value.x, this.value.y, this.value.z];
            }
        },
        getValue: function() {
            // 1.1493, 1.0293, 0.6293
            return [this.value.x, this.value.y, this.value.z].join(', ');
        }
    };

    // Current window
    $scope.current_window = {
        id: 'main',
        show: function(id) {
            this.id = id;
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
            hd: false,
            texture_pack: 'terrain_hd',
            mipmap: false
        },
        save: function() {
            localStorage.setItem('settings', JSON.stringify(this.form));
        },
        load: function() {
            let form = localStorage.getItem('settings');
            if(form) {
                this.form = Object.assign(this.form, JSON.parse(form));
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

    // Start world
    $scope.StartWorld = function(world_guid) {
        // Check session
        let session = $scope.App.getSession();
        if(!session) {
            return;
        }
        // Show Loading...
        Game.hud.draw();
        $timeout(function(){
            // $scope.current_window.show('loading');
            $scope.settings.save();
            $scope.Game.Start(world_guid, $scope.settings.form, (resource_loading_state) => {
                Game.hud.draw(true);
                /*
                $timeout(function(){
                    $scope.resource_loading_state = resource_loading_state;
                });
                */
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
        load: function() {
            let session = $scope.App.getSession();
            if(!session) {
                return that.loadingComplete();
            }
            var that = this;
            that.loading = true;
            $scope.App.MyWorlds({}, (worlds) => {
                $timeout(() => {
                    that.list = worlds;
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
                    vt.success($scope.lang.error_not_logged);
                    return;
                }
                let world_guid = hash.substr(7);
                if(that.worldExists(world_guid)) {
                    return false;
                }
                helperService.api.call($scope.App, '/api/Game/JoinWorld', {world_guid: world_guid}, function(resp) {
                    that.list.push(resp);
                    vt.success('You invited to world ' + hash);
                    location.href = location.protocol + '//' + location.host;
                }, null, null, function() {
                    that.loading = false;
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
                id: null
            }
        },
        reset: function() {
            this.form.title = '';
            this.form.seed  = '';
        },
        generators: {
            index: 0,
            list: [
                {id: 'biome2', title: 'Стандартный'},
                {id: 'city', title: 'Город'},
                {id: 'city2', title: 'Город 2'},
                {id: 'flat', title: 'Плоский мир'}
            ],
            next: function() {
                this.index = (this.index + 1) % this.list.length;
                $scope.newgame.form.generator.id = this.getCurrent().id;
            },
            getCurrent: function() {
                return this.list[this.index];
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
            this.form.generator.id = this.generators.list[0].id;
            $scope.current_window.show('newgame');
            this.form.seed = $scope.App.GenerateSeed(Helpers.getRandomInt(1000000, 4000000000));
        },
        close: function() {
            $scope.current_window.show('main');
        }
    };

    $scope.Game = window.Game;

    $scope.settings.load();
    $scope.boot.init();
    $scope.login.init();
    $scope.skin.init();
    $scope.mygames.checkInvite();

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