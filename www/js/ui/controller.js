import {Vector, Helpers, SpiralGenerator} from '../helpers.js';
import {UIApp} from './app.js';
import {TexturePackManager} from './texture_pack-manager.js';
import {SkinManager} from './skin-manager.js';
import {GameClass} from '../game.js';
import { Player } from '../player.js';
import { Lang } from "../lang.js";
import { KEY, MOUSE } from "../constant.js";

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

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = async function($scope, $timeout) {

    await Lang.init();

    globalThis.Game                 = new GameClass();
    $scope.App                      = Game.App = new UIApp();
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
            this.url = location.protocol + '//' + location.host + '#world_' + Game.world.info.guid;
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
            if(typeof Game != 'undefined') {
                Game.render.sunDir = [this.value.x, this.value.y, this.value.z];
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
            use_light: true,
            mipmap: false
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
        Game.App.showError('Запрещено удалять мир', 4000);
        window.event.preventDefault();
        window.event.stopPropagation();
    };

    // Start world
    $scope.StartWorld = function(world_guid) {
        // Check session
        let session = $scope.App.getSession();
        if(!session) {
            return;
        }
        document.getElementById('main-pictures')?.remove();
        document.getElementById('topbar')?.remove();
        document.getElementById('bg-canvas')?.remove();
        document.getElementById('main-menu')?.remove();
        // Show Loading...
        Game.hud.draw();
        $timeout(async function(){
            $scope.settings.save();
            let server_url = (window.location.protocol == 'https:' ? 'wss:' : 'ws:') +
                '//' + location.hostname +
                (location.port ? ':' + location.port : '') +
                '/ws';
            let world = await $scope.Game.Start(server_url, world_guid, $scope.settings.form, (resource_loading_state) => {
                Game.hud.draw(true);
            });
            if(!world.info) {
                debugger;
            }
            let player = new Player();
            player.JoinToWorld(world, () => {
                Game.Started(player);
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
            let session = $scope.App.getSession();
            if(!session) {
                return that.loadingComplete();
            }
            var that = this;
            that.loading = true;
            $scope.App.MyWorlds({}, (worlds) => {
                $timeout(() => {
                    that.shared_worlds = [];
                    that.list = worlds;
                    for(let w of worlds) {
                        w.my = w.user_id == session.user_id;
                        if(!w.my) {
                            that.shared_worlds.push(w);
                        }
                    }
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
                {id: 'city', title: 'Город'},
                {id: 'city2', title: 'Город 2'},
                {id: 'flat', title: 'Плоский мир'},
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

    $scope.Game         = window.Game;
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

    $scope.darwBg = () => {

        var canvas = document.getElementById('bg-canvas');

        /********************
          Random Number
        ********************/
    
        function rand(min, max) {
          return Math.floor(Math.random() * (max - min + 1) + min);
        }
    
        /********************
          Var
        ********************/
    
        var ctx = canvas.getContext('2d');
        var X = canvas.width = window.innerWidth;
        var Y = canvas.height = window.innerHeight;
        var mouseX = null;
        var mouseY = null;
        var dist = 80;
        var lessThan = Math.sqrt(dist * dist + dist * dist);
        var mouseDist = 150;
        var shapeNum;
        var shapes = [];
        var ease = 0.3;
        var friction = 0.9;
        var lineWidth = 5;
        X > Y ? shapeNum = X / dist : shapeNum = Y / dist;
    
        if (X < 768) {
          lineWidth = 2;
          dist = 40;
          lessThan = Math.sqrt(dist * dist + dist * dist);
          mouseDist = 50;
          X > Y ? shapeNum = X / dist : shapeNum = Y / dist;
        }
    
        /********************
          Animation
        ********************/
    
        window.requestAnimationFrame =
          window.requestAnimationFrame ||
          window.mozRequestAnimationFrame ||
          window.webkitRequestAnimationFrame ||
          window.msRequestAnimationFrame ||
          function(cb) {
            setTimeout(cb, 17);
          };
    
        /********************
          Shape
        ********************/
        
        function Shape(ctx, x, y, i) {
          this.ctx = ctx;
          this.init(x, y, i);
        }
        
        Shape.prototype.init = function(x, y, i) {
          this.x = x;
          this.y = y;
          this.xi = x;
          this.yi = y;
          this.i = i;
          this.r = 1;
          this.v = {
            x: 0,
            y: 0
          };
          this.c = rand(0, 360);
        };
    
        Shape.prototype.draw = function() {
          var ctx  = this.ctx;
          ctx.save();
          ctx.fillStyle = 'hsl(' + this.c + ', ' + '80%, 60%)';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, false);
          ctx.fill();
          ctx.restore();
        };
    
        Shape.prototype.mouseDist = function() {
          var x = mouseX - this.x;
          var y = mouseY - this.y;
          var d = x * x + y * y;
          var dist = Math.sqrt(d);
          if (dist < mouseDist) {
            this.v.x = +this.v.x;
            this.v.y = +this.v.y;
            var colAngle = Math.atan2(mouseY - this.y, mouseX - this.x);
            this.v.x = -Math.cos(colAngle) * 5;
            this.v.y = -Math.sin(colAngle) * 5;
            this.x += this.v.x;
            this.y += this.v.y;
          } else if (dist > mouseDist && dist < mouseDist + 10) {
            this.v.x = 0;
            this.v.y = 0;
          } else {
            this.v.x += (this.xi - this.x) * ease;
            this.v.y += (this.yi - this.y) * ease;
            this.v.x *= friction;
            this.v.y *= friction;
            this.x += this.v.x;
            this.y += this.v.y;
          }
        };
    
        Shape.prototype.drawLine = function(i) {
          var j = i;
          for (var i = 0; i < shapes.length; i++) {
            if (j !== i) {
              var x = this.x - shapes[i].x;
              var y = this.y - shapes[i].y;
              var d = x * x + y * y;
              var dist = Math.floor(Math.sqrt(d));
              if (dist <= lessThan) {
                ctx.save();
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = 'hsl(' + this.c + ', ' + '80%, 60%)';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(shapes[i].x, shapes[i].y);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        };
    
        Shape.prototype.render = function(i) {
          this.drawLine(i);
          if (mouseX !== null) this.mouseDist();
          this.draw();
        };
        
        for (var i = 0; i < shapeNum + 1; i++) {
          for (var j = 0; j < shapeNum + 1; j++) {
            if (j * dist - dist > Y) break;
            var s = new Shape(ctx, i * dist, j * dist, i, j);
            shapes.push(s);
          }
        }
       
        /********************
          Render
        ********************/
        
        function render() {
          ctx.clearRect(0, 0, X, Y);
          for (var i = 0; i < shapes.length; i++) {
            shapes[i].render(i);
          }
          requestAnimationFrame(render);
        }
    
        render();
    
        /********************
          Event
        ********************/
        
        function onResize() {
          X = canvas.width = window.innerWidth;
          Y = canvas.height = window.innerHeight;
          shapes = [];
          if (X < 768) {
            lineWidth = 2;
            dist = 40;
            lessThan = Math.sqrt(dist * dist + dist * dist);
            mouseDist = 50;
            X > Y ? shapeNum = X / dist : shapeNum = Y / dist;
          } else {
            lineWidth = 5;
            dist = 80;
            lessThan = Math.sqrt(dist * dist + dist * dist);
            mouseDist = 150;
            X > Y ? shapeNum = X / dist : shapeNum = Y / dist;
          }
          for (var i = 0; i < shapeNum + 1; i++) {
            for (var j = 0; j < shapeNum + 1; j++) {
              if (j * dist - dist > Y) break;
              var s = new Shape(ctx, i * dist, j * dist, i, j);
              shapes.push(s);
            }
          }
        }
    
        window.addEventListener('resize', function() {
          onResize();
        });
    
        window.addEventListener('mousemove', function(e) {
          mouseX = e.clientX;
          mouseY = e.clientY;
        }, false);
    
        canvas.addEventListener('touchmove', function(e) {
          var touch = e.targetTouches[0];
          mouseX = touch.pageX;
          mouseY = touch.pageY;
        });
    
    };
    $scope.darwBg();

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