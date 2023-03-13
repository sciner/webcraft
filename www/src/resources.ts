import { BBModel_Model } from "./bbmodel/model.js";
import { Helpers } from "./helpers.js";
import { CLIENT_SKIN_ROOT, CLIENT_MUSIC_ROOT } from "./constant.js";
import { SpriteAtlas } from "./core/sprite_atlas.js";
import {ShaderPreprocessor} from "./renders/ShaderPreprocessor.js";

export const COLOR_PALETTE = {
    white: [0, 0],      // Белая - white_terracotta
    orange: [2, 1],     // Оранжевая - orange_terracotta
    magenta: [2, 3],    // Сиреневая - magenta_terracotta
    light_blue: [3, 2], // Светло-синяя - light_blue_terracotta
    yellow: [3, 1],     // Жёлтая - yellow_terracotta
    lime: [0, 2],       // Лаймовая - lime_terracotta
    pink: [3, 3],       // Розовая - pink_terracotta
    gray: [2, 0],       // Серая - gray_terracotta
    light_gray: [1, 0], // Светло-серая - light_gray_terracotta
    cyan: [2, 2],       // Бирюзовая - cyan_terracotta
    purple: [1, 3],     // Фиолетовая - purple_terracotta
    blue: [0, 3],       // Синяя - blue_terracotta
    brown: [0, 1],      // Коричневая - brown_terracotta
    green: [1, 2],      // Зелёная - green_terracotta
    red: [1, 1],        // Красная - red_terracotta
    black: [3, 0],      // Чёрная - black_terracotta
};

export class Resources {
    [key: string]: any;

    static _bbmodels          : any;
    static _bbmodel_promise   : any;
    static _music_discs       : any;
    static _painting          : any;
    static codeMain           : any = {};
    static codeSky            : any = {};
    static pickat             : any = {};
    static shadow             : any = {};
    static clouds             : any = {};
    static inventory          : any = {};
    static physics            : any = {};
    static models             : any = {};
    static sounds             : any = {};
    static music              : any = null;
    static sound_sprite_main  : any = {};
    static weather            : any = {};
    static blockDayLight      : any = null;
    static maskColor          : any = null;
    static layout             : any = {}
    static atlas              : Map<string, SpriteAtlas> = new Map()
    static shaderPreprocessor = new ShaderPreprocessor();

    static progress = {
        loaded:     0,
        total:      0,
        percent:    0
    };

    static async getModelAsset(key) {
        if (!this.models[key]) {
            return;
        }

        const entry = this.models[key];

        if (entry.asset) {
            return entry.asset;
        }

        let asset;

        if (entry.type == 'json') {
            asset = Resources.loadJsonModel(entry, key, entry.baseUrl);
        }

        return entry.asset = asset;
    }

    static onLoading = (state) => {};

    static async preload(settings) {

        // Functions
        const loadTextFile = Resources.loadTextFile
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap)

        let all = [];

        // Shader blocks
        if (settings.wgsl) {
            // not supported
        } else {
            all.push(
                loadTextFile('./shaders/shader.blocks.glsl')
                    .then(text => Resources.shaderPreprocessor.parseBlocks(text))
                    .then(blocks => {
                        console.debug('Load shader blocks:', blocks)
                    })
            );
        }

        await Promise.all(all)

    }

    /**
     * @param settings
     * @param settings.glsl need glsl
     * @param settings.wgsl need wgls for webgpu
     * @param settings.imageBitmap return imageBitmap for image instead of Image
     * @returns {Promise<void>}
     */
    static load(settings) {

        // Functions
        const loadTextFile = Resources.loadTextFile;
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap);

        let all : any[] = [];

        // Others
        all.push(loadImage('media/block_day_light.png').then((img) => { this.blockDayLight = img}));
        all.push(loadImage('media/mask_color_with_swamp.png').then((img) => { this.maskColor = img}));
        all.push(loadImage('media/weather.png').then((img) => { this.weather.image = img}));
        // all.push(loadImage('media/snow.png').then((img) => { this.weather.snow = img}));
        all.push(loadImage('media/pickat_target.png').then((img) => { this.pickat.target = img}));
        all.push(loadImage('media/shadow.png').then((img) => { this.shadow.main = img}));
        all.push(loadImage('media/debug_frame.png').then((img) => { this.pickat.debug = img}));
        all.push(fetch('/data/sounds.json').then(response => response.json()).then(json => { this.sounds = json;}));
        all.push(fetch(CLIENT_MUSIC_ROOT + 'music.json')
            .then(response => response.ok ? response.json() : null)
            .then(json => { this.music = json;}))
        all.push(fetch('/sounds/main/sprite.json').then(response => response.json()).then(json => { this.sound_sprite_main = json;}));

        /**
         * Atlases
         * @type {Object.<string, SpriteAtlas>}
         */
        this.atlas = new Map()
        for(let name of ['hotbar', 'bn', 'icons']) {
            all.push(new Promise(async (resolve, reject) => {
                const atlas_files = await Promise.all([
                    fetch(`data/atlas/${name}/atlas.json`).then(response => response.json()), // .then(json => { atlas.map = json})
                    loadImage(`data/atlas/${name}/atlas.png`) // .then(img => { atlas.image = img})
                ])
                const map = atlas_files[0];
                const image = atlas_files[1];
                const atlas = await SpriteAtlas.fromJSON(image, map)
                Resources.atlas.set(name, atlas)
                resolve(atlas)
            }))
        }

        // Window layouts
        for(let name of ['quest_view', 'screenshot']) {
            all.push(fetch(`data/layout/${name}.json`).then(response => response.json()).then(json => { this.layout[name] = json}))
        }

        // Skybox textures
        /*
        let skiybox_dir = './media/skybox/park';
        all.push(loadImage(skiybox_dir + '/posx.webp').then((img) => {this.sky.posx = img}));
        all.push(loadImage(skiybox_dir + '/negx.webp').then((img) => {this.sky.negx = img}));
        all.push(loadImage(skiybox_dir + '/posy.webp').then((img) => {this.sky.posy = img}));
        all.push(loadImage(skiybox_dir + '/negy.webp').then((img) => {this.sky.negy = img}));
        all.push(loadImage(skiybox_dir + '/posz.webp').then((img) => {this.sky.posz = img}));
        all.push(loadImage(skiybox_dir + '/negz.webp').then((img) => {this.sky.negz = img}));
        */

        // Skybox shaders
        if (settings.wgsl) {
            all.push(loadTextFile('./shaders/skybox_gpu/shader.wgsl').then((txt) => { this.codeSky = { vertex: txt, fragment: txt} } ));
        } else {
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { this.codeSky.vertex = txt } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { this.codeSky.fragment = txt } ));
        }

        // Painting
        all.push(Resources.loadPainting());

        //
        all.push(Resources.loadBBModels());

        // Physics features
        all.push(fetch('/src/prismarine-physics/lib/features.json').then(response => response.json()).then(json => { this.physics.features = json;}));

        // Clouds texture
        all.push(loadImage('/media/clouds.png').then((image1 : CanvasImageSource) => {
            let canvas          = document.createElement('canvas');
            canvas.width        = 256;
            canvas.height       = 256;
            let ctx             = canvas.getContext('2d');
            ctx.drawImage(image1, 0, 0, 256, 256, 0, 0, 256, 256);
            this.clouds.texture = ctx.getImageData(0, 0, 256, 256);
        }));

        // Mob & player models
        all.push(
            Resources.loadJsonDatabase('/media/models/database.json', '/media/models/')
                .then((t) => Object.assign(this.models, t.assets))
                .then((loaded) => {
                    console.debug("Loaded models:", loaded);
                })
        );

        // Loading progress calculator
        let d = 0;
        this.progress.total = all.length

        for (const p of all) {
            p.then(()=> {
                d ++;
                this.progress.loaded = d;
                this.progress.percent = (d * 100) / all.length;
                this.onLoading({...this.progress});
            });
        }

        // TODO: add retry
        return Promise.all(all);

    }

    //
    static async loadWebGLShaders(vertex, fragment) {
        let all = [];
        let resp = {
            code: {
                vertex: null,
                fragment: null
            }
        };
        all.push(Resources.loadTextFile(vertex).then((txt) => { resp.code.vertex = txt } ));
        all.push(Resources.loadTextFile(fragment).then((txt) => { resp.code.fragment = txt } ));
        await Promise.all(all);
        return resp;
    }

    //
    static async loadWebGPUShader(shader_uri) {
        let all = [];
        let resp = {
            code: {
                vertex: null,
                fragment: null
            }
        };
        all.push(Resources.loadTextFile(shader_uri).then((txt) => { resp.code.vertex = txt; resp.code.fragment = txt;}));
        await Promise.all(all);
        return resp;
    }

    static loadTextFile(url, json = false) {
        return fetch(url).then(response => json ? response.json() : response.text());
    }

    static loadImage(url,  imageBitmap): Promise<HTMLImageElement|ImageBitmap> {
        if (imageBitmap) {
            return fetch(url)
                .then(r => r.blob())
                .then(blob => self.createImageBitmap(blob, {premultiplyAlpha: 'none'}))
                .catch((e) => {
                    console.error(`Error loadImage in resources ${url}`)
                    setTimeout(() => {
                        Qubatch.exit();
                    }, 1000);
                    return null;
                });
        }
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function () {
                resolve(image);
            };
            image.onerror = function () {
                reject();
            };
            image.src = url;
        })
    }

    static unrollGltf(primitive, gltf, target = []) {
        const data = target;
        const {
            NORMAL, POSITION, TEXCOORD_0
        } = primitive.attributes;
        const posData = new Float32Array(POSITION.bufferView.data);
        const normData = new Float32Array(NORMAL.bufferView.data);
        const uvData = new Float32Array(TEXCOORD_0.bufferView.data);
        if (typeof primitive.indices === 'number') {
                const indices = gltf.accessors[primitive.indices];
                const i16 = new Uint16Array(indices.bufferView.data, primitive.indicesOffset, primitive.indicesLength);
                for(let i = 0; i < i16.length; i ++) {
                    let index = i16[i];
                    data.push(
                        posData[index * POSITION.size + 0],
                        posData[index * POSITION.size + 1],
                        posData[index * POSITION.size + 2],
                        uvData[index * TEXCOORD_0.size + 0],
                        uvData[index * TEXCOORD_0.size + 1],
                        0, 0, 0, 0,
                        normData[index * NORMAL.size + 0],
                        normData[index * NORMAL.size + 1],
                        normData[index * NORMAL.size + 2],
                    )
                }
        }
        return data;
    }

    static async loadJsonModel(dataModel, key, baseUrl) {
        const asset = await Resources.loadTextFile(baseUrl + dataModel.geom, true);

        asset.type = dataModel.type;
        asset.source = dataModel;
        asset.key = key;
        asset.skins = Object.fromEntries(Object.entries(dataModel.skins).map((e) => [e[0], null]));

        asset.getSkin = async (id) => {
            if (!dataModel.skins[id]) {
                return null;
            }

            if (asset.skins[id]) {
                return asset.skins[id];
            }

            const image = Resources
                .loadImage(baseUrl + dataModel.skins[id], !!self.createImageBitmap)

            return asset.skins[id] = image;
        }

        asset.getPlayerSkin = async (url) => {
            if (asset.skins[url]) {
                return asset.skins[url];
            }
            const image = Resources.loadImage(url, !!self.createImageBitmap);
            return asset.skins[url] = image;
        }

        return asset;
    }

    static async loadJsonDatabase(url, baseUrl) {
        const base = await Resources.loadTextFile(url, true);
        base.baseUrl = baseUrl;

        for(let key in base.assets) {
            base.assets[key].baseUrl = baseUrl;
        }
        return base;
    }

    // loadResourcePacks...
    static async loadResourcePacks(settings) {
        const resource_packs_url = (settings && settings.resource_packs_url) ? settings.resource_packs_url : '../data/resource_packs.json';
        return Helpers.fetchJSON(resource_packs_url, true, 'rp');
    }

    // Load supported block styles
    static async loadBlockStyles(options) {
        const resp = new Set();
        const all = [];
        const json_url = (options && options.json_url) ? options.json_url : '../data/block_style.json';
        await Helpers.fetchJSON(json_url, true, 'bs').then((json) => {
            for(let code of json) {
                // Load module
                all.push(import(`./block_style/${code}.js`).then(module => {
                    resp.add(module.default);
                }));
            }
        });
        await Promise.all(all).then(() => { return this; });
        return resp;
    }


    // Load skins
    static async loadSkins() {
        const json = await Helpers.fetchJSON('../media/models/database.json');
        const resp = json.player_skins;
        for(var skin of resp) {
            skin.preview = CLIENT_SKIN_ROOT + 'preview/' + skin.file + '.png';
            skin.file = CLIENT_SKIN_ROOT + skin.file + '.png';
        }
        resp.sort((a, b) => a.id - b.id);
        return resp;
    }

    // Load recipes
    static async loadRecipes() {
        return  Helpers.fetchJSON('../data/recipes.json', true);
    }

    // Load models
    static async loadModels() {
        return  Helpers.fetchJSON('../media/models/database.json');
    }

    // Load materials
    static async loadMaterials() {
        return  Helpers.fetchJSON('../data/materials.json', true);
    }

    // Load BBModels
    static async _loadBBModels() {
        if(Resources._bbmodels) {
            return Resources._bbmodels
        }
        const resp = new Map();
        const dir = '../resource_packs/bbmodel';
        await Helpers.fetchJSON(dir + '/conf.json').then(async bbmodel_conf_json => {
            for(let item of bbmodel_conf_json.bbmodels) {
                const model = new BBModel_Model(item.json)
                model.parse()
                model.name = item.name
                resp.set(item.name, model)
            }
            // const all = []
            // for(let file of json.bbmodels) {
            //     all.push(Helpers.fetchJSON(dir + `/${file.name}.json`).then(json => {
            //         const model = new BBModel_Model(json);
            //         model.parse();
            //         model.name = file.name;
            //         resp.set(file.name, model);
            //     }).catch((error) => {
            //         console.error('Error:', error);
            //     }));
            // }
            // await Promise.all(all)
        });
        return Resources._bbmodels = resp;
    }

    static loadBBModels() {
        return this._bbmodel_promise = this._bbmodel_promise || this._loadBBModels()
    }

    // Load painting
    static async loadPainting() {
        if(Resources._painting) {
            return Resources._painting;
        }
        let resp = null;
        await Helpers.fetchJSON('../data/painting.json').then(json => {
            json.sizes = new Map();
            for(const [k, item] of Object.entries<IPaintingFrame>(json.frames)) {
                let sz_w = item.w / json.one_width;
                let sz_h = item.h / json.one_height;
                item.x /= json.sprite_width;
                item.y /= json.sprite_height;
                item.w /= json.sprite_width;
                item.h /= json.sprite_height;
                const key = `${sz_w}x${sz_h}`;
                if(!json.sizes.has(key)) {
                    json.sizes.set(key, new Map());
                }
                json.sizes.get(key).set(k, item);
            }
            resp = json;
        });
        return Resources._painting = resp;
    }

    // Load music discs
    static async loadMusicDiscs() {
        if(Resources._music_discs) {
            return Resources._music_discs;
        }
        let resp = null;
        await Helpers.fetchJSON('../data/music_disc.json').then(json => {
            resp = json;
        });
        return Resources._music_discs = resp;
    }

}

export interface IPaintingFrame {
    x: number
    y: number
    w: number
    h: number
}