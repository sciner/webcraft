import Saves from '../saves.js';
import {Vector, Helpers} from '../helpers.js';
import {UIApp} from './app.js';
import {TexturePackManager} from './texture_pack-manager.js';
import {SkinManager} from './skin-manager.js';
import {DemoMapManager} from './demo_map-manager.js';

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout', 'helperService'];
let gameCtrl = function($scope, $timeout, helperService) {

    $scope.App              = new UIApp($scope);
    $scope.texture_pack     = new TexturePackManager($scope);
    $scope.skin             = new SkinManager($scope);
    $scope.demoMaps         = new DemoMapManager($scope, $timeout);

    // Lang
    $scope.lang = {
        enter_your_name: 'Enter your name',
        enter_your_password: 'Enter password',
        error_user_already_registered: 'User already registered',
        error_invalid_login_or_password: 'Invalid login or password',
        registration: 'Registration',
        submit: 'Submit',
        back: 'Back',
        login: 'Login',
        enter: 'Enter'
    };

    // sun dir
    $scope.sunDir = {
        value: new Vector(1.1493, 1.0293, 0.6293),
        apply: function() {
            // 0.84 1 -1
            if(typeof Game != 'undefined') {
                Game.world.renderer.sunDir = [this.value.x, this.value.y, this.value.z];
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
            helperService.api.call($scope.App, '/api/User/Login', this.form, function(resp) {
                that.logged = true;
                localStorage.setItem('username', resp.username);
                localStorage.setItem('session_id', resp.session_id);
                that.reset();
                that.onSuccess(resp.username, resp.session_id);
                $scope.current_window.show('main');
            }, null, null, function() {
                that.loading = false;
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
            let username = localStorage.getItem('username');
            let session_id = localStorage.getItem('session_id');
            this.logged = !!session_id;
            if(!this.logged) {
                $scope.current_window.show('hello');
                return false;
            }
            this.onSuccess(username, session_id);
        },
        onSuccess(username, session_id) {
            $scope.Game.username = username;
            $scope.Game.session_id = session_id;
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
            helperService.api.call($scope.App, '/api/User/Registration', this.form, function(resp) {
                $scope.login.autoLogin(that.form);
                that.reset();
            }, null, null, function() {
                that.loading = false;
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
            this.saves = new Saves(function(instance) {
                $scope.Game.saves = instance;
            });
            $scope.demoMaps.load();
        }
    };

    // My games
    $scope.mygames = {
        list: [],
        load: function() {
            let list = localStorage.getItem('mygames');
            if(list) {
                list = JSON.parse(list);
                if(list) {
                    for(let item of list) {
                        if(!item.hasOwnProperty('id')) {
                            item.id = item._id;
                        }
                    }
                    this.list = list;
                }
            }
        },
        save: function() {
            localStorage.setItem('mygames', JSON.stringify(this.list));
        },
        add: function(form) {
            this.list.push(form);
            this.save();
        }
    };

    // Генараторы мира
    $scope.generators = {
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
    };

    // New world
    $scope.newgame = {
        form: {
            id: '',
            title: '',
            generator: {
                id: $scope.generators.list[0].id
            },
            seed: ''
        },
        submit: function() {
            $scope.mygames.add(this.form);
            $scope.settings.save();
            $scope.current_window.show('loading');
            this.form = $scope.Game.createNewWorld(this.form);
            $scope.boot.saves.addNew(this.form);
            $scope.Game.initGame(this.form, $scope.settings.form);
        },
        open: function() {
            $scope.current_window.show('newgame');
            this.form.seed = Helpers.getRandomInt(1000000, 4000000000) + '';
            this.form.id = Helpers.generateID();
        },
        close: function() {
            $scope.current_window.show('main');
        }
    }

    // Start world
    $scope.StartWorld = function(world_name) {
        $scope.settings.save();
        $scope.boot.saves.load(world_name, function(saved_world) {
            $scope.Game.initGame(saved_world, $scope.settings.form);
        }, function(err) {
            alert('World not found');
        });
    };

    import('/js/game.js')
        .then(module => {
            $scope.Game = window.Game = module.Game;
            window.MOUSE    = module.MOUSE;
            window.BLOCK    = module.BLOCK;
            window.KEY      = module.KEY;
            $scope.settings.load();
            $scope.boot.init();
            $scope.login.init();
            $scope.skin.init();
        });

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

/**
* Утилиты
*/
var helperServiceInjectParams = ['$http', '$q', '$timeout'];
var helperServiceService = function($http, $q, $timeout) {
    var helperService = {
        api: {
            // Организует вызов API, обработку ответа и вызов callback-функции
            call: function(App, url, data, callback, callback_error, callback_progress, callback_final) {
                let domains_api     = '';
                let sessionID       = null;
                url                 = domains_api + url;
                callback_error      = callback_error || null;
                callback_progress   = callback_progress || null;
                callback_final      = callback_final || null;
                var deferred        = $q.defer();
                var headers = {
                    'X-Language-Locale': 'ru'
                };
                if(sessionID) {
                    headers['X-Session-ID'] = sessionID;
                }
                var options = {
                    method:                 'POST',
                    url:                    url,
                    headers:                headers,
                    data:                   data instanceof FormData ? data : JSON.parse(JSON.stringify(data)),
                    uploadEventHandlers:    {}
                };
                if(callback_progress instanceof Function) {
                    options.uploadEventHandlers.progress = callback_progress;
                }
                if(data instanceof FormData) {
                    options.headers['Content-Type'] = undefined;
                }
                var promise = $http(options);
                promise.then(function(result) {
                    result = result.data;
                    if (result.error) {
                        result = result.error;
                        result.status = 'error';
                    }
                    if (result.status == 'error') {
                        if (callback_error && callback_error instanceof Function) {
                            callback_error(result);
                        } else {
                            if (result.code == 401) {
                                if (result, app.back.index_scope.pages.url == 'index.login') {
                                    App.showError(result.message, 4000);
                                } else {
                                    App.logout();
                                }
                            } else {
                                App.showError(result.message, 4000);
                            }
                        }
                    } else {
                        if (callback && callback instanceof Function) {
                            callback(result);
                        }
                    }
                    if (callback_final && callback_final instanceof Function) {
                        callback_final(result);
                    }
                }, function(reason) {
                    App.showError('Failed: ' + reason, 4000);
                    if (callback_final && callback_final instanceof Function) {
                        callback_final(reason);
                    }
                }, function(update) {
                    alert('Got notification: ' + update);
                });
            }
        }
    };
    return helperService;
};
helperServiceService.$inject = helperServiceInjectParams;
app.factory('helperService', helperServiceService);