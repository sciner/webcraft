import "./../vendors/gl-matrix-3.3.min.js";
import { glTFLoader } from "./../vendors/minimal-gltf-loader.js";
import { Helpers } from "./helpers.js";

export class Resources {

    static onLoading = (state) => {};

    /**
     * @param settings
     * @param settings.glsl need glsl
     * @param settings.wgsl need wgls for webgpu
     * @param settings.imageBitmap return imageBitmap for image instead of Image
     * @returns {Promise<void>}
     */
    static load(settings) {

        this.codeMain       = {};
        this.codeSky        = {};
        this.terrain        = {};
        this.pickat         = {};
        this.sky            = {};
        this.clouds         = {};
        this.inventory      = {};
        this.physics        = {};
        this.models         = {};
        this.sounds         = {};

        // Functions
        const loadTextFile = Resources.loadTextFile;
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap);
        
        let all = [];

        // Others
        all.push(Resources.loadImage('media/inventory2.png', false).then((img) => {this.inventory.image = img}));
        all.push(loadImage('media/' + settings.texture_pack + '.png').then((img) => { this.terrain.image = img}));
        all.push(loadImage('media/pickat_target.png').then((img) => { this.pickat.target = img}));
        all.push(fetch('/data/sounds.json').then(response => response.json()).then(json => { this.sounds = json;}));

        // Skybox textures
        let skiybox_dir = './media/skybox/park';
        all.push(loadImage(skiybox_dir + '/posx.jpg').then((img) => {this.sky.posx = img}));
        all.push(loadImage(skiybox_dir + '/negx.jpg').then((img) => {this.sky.negx = img}));
        all.push(loadImage(skiybox_dir + '/posy.jpg').then((img) => {this.sky.posy = img}));
        all.push(loadImage(skiybox_dir + '/negy.jpg').then((img) => {this.sky.negy = img}));
        all.push(loadImage(skiybox_dir + '/posz.jpg').then((img) => {this.sky.posz = img}));
        all.push(loadImage(skiybox_dir + '/negz.jpg').then((img) => {this.sky.negz = img}));

        // Skybox shaders
        if (settings.wgsl) {
            all.push(loadTextFile('./shaders/skybox_gpu/shader.wgsl').then((txt) => { this.codeSky = { vertex: txt, fragment: txt} } ));
        } else {
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { this.codeSky.vertex = txt } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { this.codeSky.fragment = txt } ));
        }

        // Physics features
        all.push(fetch('/vendors/prismarine-physics/lib/features.json').then(response => response.json()).then(json => { this.physics.features = json;}));

        // Clouds texture
        all.push(loadImage('/media/clouds.png').then((image1) => {
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
                    console.log("Loaded models:", loaded);
                })
        );

        // Loading progress calculator
        let d = 0;
        this.progress = {
            loaded:     0,
            total:      all.length,
            percent:    0
        };
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
    
    static loadImage(url,  imageBitmap) {
        if (imageBitmap) {
            return fetch(url)
                .then(r => r.blob())
                .then(blob => self.createImageBitmap(blob, {premultiplyAlpha: 'none'}));
        }
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function () {
                resolve(image);
            };
            image.onError = function () {
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

    static async loadJsonModel(entry, key, baseUrl) {
        const json = await Resources.loadTextFile(baseUrl + '/' + entry.geom, true);
        const keys = Object.keys(entry.skins);
        const skins = [];
        json.type = entry.type;
        json.source = entry;
        json.key = key;
        json.skins = {};
        for(let key of keys) {
            skins.push(
                Resources
                .loadImage(baseUrl + '/' + entry.skins[key], !!self.createImageBitmap)
                .then((image) => {
                    json.skins[key] = image;
                })
            )
        }
        await Promise.all(skins);
        return json;
    }

    static async loadJsonDatabase(url, baseUrl) {
        const base = await Resources.loadTextFile(url, true);
        const process = [];
        for(let key in base.assets) {
            const entry = base.assets[key];
            if (entry.type == 'json') {

                process.push(
                    Resources.loadJsonModel(entry, key, baseUrl).then((entry) => {
                        base.assets[entry.key] = entry;
                    })
                )
            }
        }
        await Promise.all(process);
        return base;
    }

    static async loadGltf(url, options)  {
        const loader = new glTFLoader(null);
        return new Promise((res) => {
            loader.loadGLTF(url, {baseUri: ''}, (model) => {
                for(const mesh of model.meshes) {
                    // mesh can be shared
                    // skip same mesh    
                    if (mesh.interlivedData) {
                        continue;
                    }

                    const data = [];
                    for(const p of mesh.primitives) {
                        Resources.unrollGltf(p, model, data);
                    }	

                    mesh.interlivedData = data;
                }

                return res(model);
            });
        });
    }

    // loadResourcePacks...
    static async loadResourcePacks() {
        let resp = new Set();
        let all = [];
        await Helpers.fetchJSON('../data/resource_packs.json').then(json => {
            for(let init_file of json) {
                all.push(import(init_file + '/init.js').then((module) => {resp.add(module.default);}));
            }
        });
        await Promise.all(all).then(() => { return this; });
        return resp;
    }

    // Load supported block styles
    static async loadBlockStyles() {
        let resp = new Set();
        let all = [];
        let json_url = '../data/block_style.json';
        await Helpers.fetchJSON(json_url).then((json) => {
            for(let code of json) {
                // Load module
                all.push(import('./block_style/' + code + '.js').then(module => {
                    resp.add(module.default);
                }));
            }
        });
        await Promise.all(all).then(() => { return this; });
        return resp;
    }

    // Load skins
    static async loadSkins() {
        let resp = null;
        await Helpers.fetchJSON('../data/skins.json').then(json => {
            for(let item of json) {
                item.file = './media/models/player_skins/' + item.id + '.png';
                item.preview = './media/skins/preview/' + item.id + '.png';
            }
            resp = json;
        });
        return resp;
    }

    // Load recipes
    static async loadRecipes() {
        return  Helpers.fetchJSON('../data/recipes.json');
    }

}