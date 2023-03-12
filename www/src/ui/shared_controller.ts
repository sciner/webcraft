import { Helpers } from '../helpers.js';
import { UIApp } from './app.js';
import { TexturePackManager } from './texture_pack-manager.js';
import { SkinManager } from './skin-manager.js';
import { GameClass } from '../game.js';
import { Player } from '../player.js';
import { Lang } from "../lang.js";
import { DEFAULT_LIGHT_TYPE_ID, DEFAULT_RENDER_DISTANCE, KEY, LIGHT_TYPE, MOUSE } from "../constant.js";
// import { PlayerWindowManager } from '../player_window_manager.js';

// Mouse event enumeration
globalThis.MOUSE = MOUSE;
globalThis.KEY = KEY;
globalThis.randomUUID = () => {
    return crypto.randomUUID();
};

//
export class NewWorldForm {
    [key: string]: any;

    constructor() {
        this.title = '';
        this.seed = '';
        this.generator = {
            id: null,
            options: null
        }
    }

}

/**
 * This class is used in another related project. DO NOT DELETE !!!
 */
export class Shared_Controller {
    [key: string]: any;

    constructor() {
        this.isSupportedBrowser = this.isSupported();
    }

    isSupported() {
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
        // chrome + safari
        return isSafari || isChrome || isFF;
    }

    changeLang(item) {
        Lang.change(item);
        location.reload();
    }

    async init() {

        // Lang
        await Lang.init();
        this.Lang = Lang;

        // Supported generators
        this.generators = [
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
            {id: 'flat', title: Lang.generator_flat_world}
        ];

        // Game
        this.Qubatch = (globalThis as any).Qubatch = new GameClass();

        // App
        this.App = Qubatch.App = new UIApp();
        this.App.onLogin = (e) => {};
        this.App.onLogout = (result) => {
            location.reload();
        }
        this.App.onError = (message) => {
            // Multilingual messages
            message = Lang[message]
            console.error(message);
        };

        const that = this;

        // Settings
        this.settings = {
            form: {
                texture_pack:       'base',
                render_distance:    DEFAULT_RENDER_DISTANCE,
                use_light:          DEFAULT_LIGHT_TYPE_ID, // {id: 0, name: 'No'}, {id: 1, name: 'Normal'}, {id: 2, name: 'RTX'}
                mipmap:             false
            },
            save: function() {
                localStorage.setItem('settings', JSON.stringify(this.form));
            },
            load: function() {
                const form = localStorage.getItem('settings');
                if(form) {
                    this.form = Object.assign(this.form, JSON.parse(form));
                    // fix texture_pack id
                    if('texture_pack' in this.form) {
                        let found = false;
                        for(let tp of that.texture_pack.list) {
                            if(tp.id == this.form.texture_pack) {
                                found = true;
                            }
                        }
                        if(!found) {
                            this.form.texture_pack = that.texture_pack.list[0].id;
                        }
                    }
                    // add default render_distance
                    if(!('render_distance' in this.form)) {
                        this.form.render_distance = DEFAULT_RENDER_DISTANCE;
                    }
                    // use_light
                    if('use_light' in this.form) {
                        this.form.use_light = Math.trunc(this.form.use_light | 0);
                    }
                }
            }
        };

        // Skins and texture packs
        this.skin = new SkinManager(this);
        this.texture_pack = new TexturePackManager(this);
        this.texture_pack.init().then(() => {
            this.settings.load();
            this.skin.init();
        });

    }

    // Return active user session
    getSession() {
        return this.App.getSession();
    }

    // Check is logged
    isLogged() {
        return !!this.getSession();
    }

    // Return server URL
    getServerURL() {
        return (window.location.protocol == 'https:' ? 'wss:' : 'ws:') +
        '//' + location.hostname +
        (location.port ? ':' + location.port : '') +
        '/ws';
    }

    /**
     * Return seed for new world
     * @returns string
     */
    generateWorldSeed() {
        return this.App.GenerateSeed(Helpers.getRandomInt(1000000, 4000000000));
    }

    // Start world
    async startWorld(world_guid) {
        const options = this.settings.form;
        // Check session
        const session = this.App.getSession();
        if(!session) {
            return;
        }
        // Show Loading...
        Qubatch.hud.draw();
        const server_url = this.getServerURL();
        const world = await this.Qubatch.Start(server_url, world_guid, (resource_loading_state) => {
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
    }

    // Login
    login(username, password, ok, err) {
        this.App.Login({username, password}, ok, err);
    }

    // Registration
    registration(username, password, ok, err) {
        this.App.Registration({username, password}, ok, err);
    }

    // Return my worlds
    myWorlds(ok, err) {
        this.App.MyWorlds({}, ok, err);
    }

    // Join to world
    joinWorld(world_guid, ok, err) {
        this.App.JoinWorld({world_guid}, ok, err);
    }

    /**
     * Create world
     * @param {NewWorldForm} form
     */
    createWorld(form) {
        form.seed = this.App.GenerateSeed(form.seed || this.generateWorldSeed());
        const ok = undefined
        const err = undefined
        this.App.CreateWorld(form, ok, err);
    }

    // Delete world
    deleteWorld(world_guid : string, ok? : Function, err? : Function) {
        this.App.DeleteWorld({world_guid}, ok, err);
    }

}
