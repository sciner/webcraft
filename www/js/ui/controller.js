import {Vector, Helpers} from '../helpers.js';
import {UIApp} from './app.js';
import {TexturePackManager} from './texture_pack-manager.js';
import {SkinManager} from './skin-manager.js';
import {GameClass} from '../game.js';
import { Player } from '../player.js';
import {impl as alea} from "../../vendors/alea.js";

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

    const isFF = navigator.userAgent.indexOf('Firefox') > -1;
    // safari 15 is ok
    const isSafari = navigator.userAgent.indexOf('Safari') > -1;
    const isChrome = navigator.userAgent.indexOf('Chrome') > -1 || self.chrome;

    if (isFF) {
        console.error('Browser not supported:', 'Firefox not support modules for workes');

        return false;
    }

    // chrome + safari
    return isSafari || isChrome;
}

// Mouse event enumeration
globalThis.MOUSE = {};
    MOUSE.DOWN    = 1;
    MOUSE.UP      = 2;
    MOUSE.MOVE    = 3;
    MOUSE.CLICK   = 4;
    MOUSE.BUTTON_LEFT   = 0;
    MOUSE.BUTTON_WHEEL  = 1;
    MOUSE.BUTTON_RIGHT  = 2;

globalThis.KEY = {};
    KEY.BACKSPACE   = 8;
    KEY.TAB         = 9;
    KEY.ENTER       = 13;
    KEY.SHIFT       = 16;
    KEY.ESC         = 27;
    KEY.SPACE       = 32;
    KEY.PAGE_UP     = 33;
    KEY.PAGE_DOWN   = 34;
    KEY.END         = 35;
    KEY.HOME        = 36;
    KEY.ARROW_LEFT  = 37;
    KEY.ARROW_UP    = 38;
    KEY.ARROW_RIGHT = 39;
    KEY.ARROW_DOWN  = 40;
    KEY.DEL         = 46;
    KEY.A           = 65;
    KEY.C           = 67;
    KEY.D           = 68;
    KEY.E           = 69;
    KEY.Q           = 81;
    KEY.R           = 82;
    KEY.S           = 83;
    KEY.T           = 84;
    KEY.V           = 86;
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

globalThis.randomUUID = () => {
    return crypto.randomUUID();
};

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = async function($scope, $timeout) {

    window.Game                     = new GameClass();
    $scope.App                      = Game.App = new UIApp();

    // Dev sandbox
    globalThis.DIR_HOR = 0;
    globalThis.DIR_VER = 1;

    // Sandbox
    $scope.sandbox = {
        map: [],
        cell_map: [],
        complex_buildings: [],
        cb_cell_map: [],
        house_list: [],
        settings: {
            size: 128,
            road_dist: 2,
            margin: 8,
            quant: 10,
            init_depth: 2,
            road_ext_value: 0, // Это значение расширения дороги, 0 = один пиксель
            house_intencity: 0.3,
            colors: {
                'house': 2,
            }
        },
        open: function() {
            $scope.current_window.show('sandbox');
            this.generator();
        },
        generator: function () {
            this.randoms = new alea(+new Date());
            const cnv = document.getElementById('sandbox_canvas');
            const ctx = cnv.getContext('2d');
            // var random_seed = Math.random();
            // random_seed = .1211112;
            let t = performance.now();
            for(let i = 0; i < 1; i++) {
                this.map = new Array(this.settings.size * this.settings.size).fill(0);
                this.cell_map = [];
                this.cb_cell_map = [];
                this.complex_buildings = [];
                const center_x_corr = Math.floor((this.randoms.double() - this.randoms.double()) * 10);
                const center_z_corr = Math.floor((this.randoms.double() - this.randoms.double()) * 10);
                this.push_branch((this.settings.size / 2) + center_x_corr, (this.settings.size / 2) + center_z_corr, DIR_HOR, this.settings.init_depth);
                this.push_branch((this.settings.size / 2) + center_x_corr, (this.settings.size / 2) + center_z_corr, DIR_VER, this.settings.init_depth);
                for(let cb_key in this.complex_buildings) {
                    // Если не пересекается с существующими complex_building, то отправляем на карту
                    let cb_building = this.complex_buildings[cb_key];
                    let house = this.put_building_complex(cb_building.x, cb_building.z, cb_building.cell_count_x, cb_building.cell_count_z, cb_building.path_dir);
                    if(house !== null) {
                        this.house_list[cb_building.z * this.settings.size + cb_building.z] = house;
                    }
                }
            }
            t = performance.now() - t;
            //console.log(t);
            // Распечатка канваса
            for (var x_iter = 0; x_iter < this.settings.size; x_iter++) {
                for (var z_iter = 0; z_iter < this.settings.size; z_iter++) {
                    const cell = this.map[z_iter * this.settings.size + x_iter]
                    if(cell === 1) {
                        ctx.fillStyle = "#000000";
                    } else if(cell === 2) {
                        ctx.fillStyle = "#FF0000";
                    } else {
                        ctx.fillStyle = "#FFFFFF";
                    }
                    ctx.fillRect( x_iter, z_iter, 1, 1);
                }
            }
        },
        push_branch(x, z, axe, depth) {
            // Один рандом на ветку
            let branch_rnd = this.randoms.double();
            const settings = this.settings;
            let ln = (depth + 1) * settings.quant + 25;
            const is_x_mod = axe === DIR_HOR ? 1 : 0;
            const is_z_mod = axe === DIR_VER ? 1 : 0;
            var rnd = branch_rnd;
            rnd = rnd > .25 ? rnd : .25;
            rnd = rnd > .75 ? .75 : rnd;
            const pre_part = Math.floor(rnd * ln / settings.quant) * settings.quant;
            const post_part = Math.floor((ln - pre_part) / settings.quant) * settings.quant;
            for (var process = 0; process <= (pre_part + post_part); process++) {
                let xprint = x - (pre_part - process) * is_x_mod;
                let zprint = z - (pre_part - process) * is_z_mod;
                if(xprint >= settings.margin
                    && xprint < (settings.size - settings.margin)
                    && zprint >= settings.margin
                    && zprint < (settings.size - settings.margin)
                ) {
                    for(let road_step = 0; road_step <= settings.road_ext_value; road_step++) {
                        this.map[(zprint + (road_step * is_x_mod)) * settings.size + (xprint + (road_step * is_z_mod))] = 1;
                    }
                }
            }
            // Установка домов вдоль линии
            // Количество ячеек для строений в pre_part и post_part
            const positions = [Math.floor(pre_part / settings.quant), Math.floor(post_part / settings.quant)];
            for(let dir in positions) {
                let sign = dir === '1' ? 1 : -1;
                for(let i = 0; i < positions[dir]; i++) {
                    // Справа или слева
                    let side_mod = (branch_rnd * (i + 7)) % 1 > .5 ? 1 : -1; // Слева
                    // Дом по правой стороне от линии
                    let q_mod = sign === -1 ? settings.quant : 0;
                    let house_cell_x = x + (sign * settings.quant * i - q_mod) * is_x_mod;
                    let house_cell_z = z + (sign * settings.quant * i - q_mod) * is_z_mod;
                    if(side_mod < 0) {
                        if(axe === DIR_HOR) {
                            house_cell_z -= settings.quant;
                        } else {
                            house_cell_x -= settings.quant;
                        }
                    }
                    let building_rnd = this.randoms.double(); // (branch_rnd * house_cell_z * house_cell_x) % 1;
                    if(building_rnd < settings.house_intencity || building_rnd > (1-settings.house_intencity)) {
                        let house = this.put_building(house_cell_x, house_cell_z);
                        if (house !== null) {
                            // Калькуляция точки начала и конца дорожки для обычного дома
                            let dot_pos_x = house_cell_x, dot_pos_z = house_cell_z;
                            if (axe === DIR_HOR) {
                                dot_pos_x += Math.round(settings.quant / 2 +settings.road_ext_value / 2);
                                dot_pos_z += side_mod > 0 ? 1 : (settings.quant + 1 - settings.road_dist);
                            } else {
                                dot_pos_x += side_mod > 0 ? 1 : (settings.quant  + 1 - settings.road_dist);
                                dot_pos_z += Math.round(settings.quant / 2 + settings.road_ext_value / 2);
                            }
                            // Добавляем house в реестр по координате
                            house.door = this.put_path(dot_pos_x, dot_pos_z, axe === DIR_HOR ? 0 : 1, axe === DIR_HOR ? 1 : 0);
                            this.house_list[house_cell_z * settings.size + house_cell_x] = house;
                        }
                    }
                }
                // В одном случае из ста делаем комбо дом затирая 2-4 ячейки, тут нам известно с какой стороны рисовать тропу к дому
                // Сложные дома справа, поэтому тропинки либо слева направо, либо сверху вниз, так проще реализация, для разнообразия карту можно вращать
                const cb_random_param = (1 - settings.house_intencity);
                if(branch_rnd > cb_random_param && positions[dir] > 1) {
                    this.complex_buildings[z * settings.size + x] = ({
                        x: x,
                        z: z,
                        cell_count_x: is_x_mod ? 2 : branch_rnd > cb_random_param ? 2 : 1,
                        cell_count_z: is_z_mod ? 2 : branch_rnd < (1 - cb_random_param) ? 2 : 1,
                        path_dir: axe === DIR_HOR ? 'up' : 'left'
                    });
                }
            }
            // Установка домов вдоль линии дороги
            const next_dir = axe === DIR_VER ? DIR_HOR : DIR_VER;
            if(depth > 0) {
                let inc_amount = 0;
                if(post_part >= settings.quant) {
                    inc_amount = settings.quant * Math.floor(post_part / settings.quant);
                    let new_branch_rnd = this.randoms.double(); // ((x + (inc_amount * is_x_mod)) * (z + (settings.quant * is_z_mod)) / 1000) % 1;
                    this.push_branch(x + (inc_amount * is_x_mod), z + (settings.quant * is_z_mod), next_dir, depth - 1, new_branch_rnd);
                }
                if(pre_part >= settings.quant) {
                    // let new_branch_rnd = ((x - (inc_amount * is_x_mod)) * (z - (settings.quant * is_z_mod)) / 1000) % 1;
                    inc_amount = settings.quant * Math.floor(pre_part / settings.quant);
                    this.push_branch(x - (inc_amount * is_x_mod), z - (settings.quant * is_z_mod), next_dir, depth - 1, branch_rnd);
                }
            }
        },
        put_path(x, z, x_dir, z_dir) {
            let xprint = x, zprint = z;
            for (var process = 0; process < this.settings.road_dist + this.settings.road_ext_value - 1; process++) {
                this.put_dot(xprint, zprint, 1);
                xprint += x_dir;
                zprint += z_dir;
            }
            // Возвращает координату двери и ее направленность
            let door = {
                x: z_dir === 0 ? x : xprint - x_dir,
                z: x_dir === 0 ? z : zprint - z_dir,
                door_x_axe: x_dir, door_z_axe: z_dir,
            }
            return door;
        },
        put_building(x, z) {
            const settings = this.settings;
            let key = z * settings.size + x;
            if(this.cell_map[key] !== undefined) {
                return null;
            }
            this.cell_map[key] = 1;
            // Отступы от дорог
            x += settings.road_dist;
            z += settings.road_dist;
            let x_size = settings.quant - settings.road_dist * 2 - settings.road_ext_value;
            let z_size = x_size;
            // Проверка удаленности дома от границы кластера
            if(x >= settings.margin
                && (x + x_size) < (settings.size - settings.margin)
                && z >= settings.margin
                && (z + z_size) < (settings.size - settings.margin)
            ) {
                // Отрисовка площадки под дом
                for(var x_cursor = 0; x_cursor < x_size + 1; x_cursor++) {
                    for(var z_cursor = 0; z_cursor < z_size + 1; z_cursor++) {
                        this.map[(z + z_cursor + settings.road_ext_value) * settings.size + (x + x_cursor + settings.road_ext_value)] = 2;
                    }
                }
                let house = {
                    x: x,
                    z: z,
                    width: x_size,
                    height: z_size,
                    door: null,
                };
                return house;
            } else {
                return null;
            }
        },
        put_dot(x, z, value) {
            const settings = this.settings;
            if(x >= settings.margin
                && x < (settings.size - settings.margin)
                && z >= settings.margin
                && z < (settings.size - settings.margin)
            ) {
                this.map[z * settings.size + x] = value;
                return true;
            } else {
                return false;
            }
        },
        put_building_complex(x, z, cell_count_x, cell_count_z, path_dir) {
            // Настройки
            const settings = this.settings;
            // Начальные параметры
            const x_init = x;
            const z_init = z;
            // Проверяем на непересечение с другими complex_building, для обозначения cell берется стартовая координата ячейки
            let local_cb_cell_map = [];
            for (var cell_x = 0; cell_x < cell_count_x; cell_x++) {
                for (var cell_z = 0; cell_z < cell_count_z; cell_z++) {
                    let tmp_x = x + (cell_x * settings.quant);
                    let tmp_z = z + (cell_z * settings.quant);
                    let key = tmp_z * settings.size + tmp_x;
                    local_cb_cell_map[key] = 1;
                }
            }
            for(let lcm_key in local_cb_cell_map) {
                if(this.cb_cell_map[lcm_key] !== undefined) {
                    return null;
                } else {
                    this.cb_cell_map[lcm_key] = 1;

                }
            }
            // Заполняем сектор занятости карты
            if(x >= 0
                && (x + cell_count_x * settings.quant + settings.road_ext_value - 1) < settings.size
                && z >= 0
                && (z + cell_count_x * settings.quant + settings.road_ext_value - 1) < settings.size
            ) {
                for (let x_cursor = settings.road_ext_value + 1; x_cursor < cell_count_x * settings.quant; x_cursor++) {
                    for (let z_cursor = settings.road_ext_value + 1; z_cursor < cell_count_z * settings.quant; z_cursor++) {
                        this.map[(z + z_cursor) * settings.size + (x + x_cursor)] = 0;
                    }
                }
            }
            // Отступы от дорог
            x += settings.road_dist + settings.road_ext_value;
            z += settings.road_dist + settings.road_ext_value;
            let x_size = settings.quant * cell_count_x - settings.road_dist * 2 + 1 - settings.road_ext_value;
            let z_size = settings.quant * cell_count_z - settings.road_dist * 2 + 1 - settings.road_ext_value;
            // Проверка удаленности дома от границы кластера
            if(x >= settings.margin
                && (x + x_size) < (settings.size - settings.margin)
                && (z) >= settings.margin
                && (z + z_size) < (settings.size - settings.margin)
            ) {
                // Отрисовка площадки под дом
                for(let x_cursor = 0; x_cursor < x_size; x_cursor++) {
                    for(let z_cursor = 0; z_cursor < z_size; z_cursor++) {
                        this.map[(z + z_cursor) * settings.size + (x + x_cursor)] = 2;
                    }
                }
                // Отрисовка дороги вокруг дома, чтобы не было разрывов
                // Снизу
                for(let x_cursor = 0; x_cursor <= settings.quant * cell_count_x + settings.road_ext_value; x_cursor++) {
                    for(let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                        this.put_dot((x_init + x_cursor), (z_init + settings.quant * cell_count_z + road_step), 1);
                    }
                }
                // Слева и справа с половины, если вход слева
                if(path_dir === 'left') {
                    for (let z_cursor = Math.ceil(settings.quant * cell_count_z / 2); z_cursor <= settings.quant * cell_count_z + settings.road_ext_value; z_cursor++) {
                        for (let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                            this.put_dot((x_init + road_step), (z_init + z_cursor), 1);
                            this.put_dot((x_init + road_step + settings.quant * cell_count_x), (z_init + z_cursor), 1);
                        }
                    }
                }
                // Отрисовка тропинки
                let path_x = x_init + 1;
                let path_z = z_init + 1;
                if(path_dir === 'up') {
                    path_x = x_init + (cell_count_x * settings.quant) / 2;
                } else {
                    path_z = z_init + (cell_count_z * settings.quant) / 2;
                }
                // Затираем обычные дома под сложным домом
                for(let x_cell = x_init; x_cell <= x_init + (settings.quant * cell_count_x); x_cell += settings.quant) {
                    for(let z_cell = z_init; z_cell <= z_init + (settings.quant * cell_count_z); z_cell += settings.quant) {
                        if(this.house_list[z_cell * settings.size + x_cell] !== undefined) {
                            delete this.house_list[z_cell * settings.size + x_cell];
                        }
                    }
                }
                // Возвращаем дом
                let house = {
                    x: x,
                    z: z,
                    width: x_size,
                    height: z_size,
                    door: this.put_path(path_x, path_z, path_dir === 'up' ? 0 : 1, path_dir === 'up' ? 1 : 0),
                };
                return house;
            } else {
                return null;
            }
        }
    };

    $scope.sandbox.generator();

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
        error_not_permitted: 'Not permitted',
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
        load: function() {
            let form = localStorage.getItem('settings');
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

    // Start world
    $scope.StartWorld = function(world_guid) {
        // Check session
        let session = $scope.App.getSession();
        if(!session) {
            return;
        }
        document.getElementById('main-pictures').remove();
        document.getElementById('main-menu').remove();
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
                    vt.success($scope.lang.error_not_logged);
                    return;
                }
                let world_guid = hash.substr(7);
                if(that.worldExists(world_guid)) {
                    return false;
                }
                $scope.App.JoinWorld({world_guid: world_guid}, (resp) => {
                    $timeout(() => {
                        that.list.push(resp);
                        vt.success('You invited to world ' + hash);
                        location.href = location.protocol + '//' + location.host;
                        that.loading = false;
                    });
                });
                return true;
            }
        }
    };

    // New worldsandbox_canvas
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
                {id: 'flat', title: 'Плоский мир'},
                {id: 'test_trees', title: 'Тестовые деревья'},
                {id: 'mine', title: 'Заброшенная шахта'}
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