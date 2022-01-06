import "./../vendors/gl-matrix-3.3.min.js";
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
        this.shaderBlocks       = {};
        this.codeMain           = {};
        this.codeSky            = {};
        this.pickat             = {};
        this.sky                = {};
        this.clouds             = {};
        this.inventory          = {};
        this.physics            = {};
        this.models             = {};
        this.sounds             = {};
        this.sound_sprite_main  = {};

        // Functions
        const loadTextFile = Resources.loadTextFile;
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap);
        
        let all = [];

        // Others
        all.push(loadImage('media/pickat_target.png').then((img) => { this.pickat.target = img}));
        all.push(fetch('/data/sounds.json').then(response => response.json()).then(json => { this.sounds = json;}));
        all.push(fetch('/sounds/main/sprite.json').then(response => response.json()).then(json => { this.sound_sprite_main = json;}));

        // Skybox textures
        let skiybox_dir = './media/skybox/park';
        all.push(loadImage(skiybox_dir + '/posx.webp').then((img) => {this.sky.posx = img}));
        all.push(loadImage(skiybox_dir + '/negx.webp').then((img) => {this.sky.negx = img}));
        all.push(loadImage(skiybox_dir + '/posy.webp').then((img) => {this.sky.posy = img}));
        all.push(loadImage(skiybox_dir + '/negy.webp').then((img) => {this.sky.negy = img}));
        all.push(loadImage(skiybox_dir + '/posz.webp').then((img) => {this.sky.posz = img}));
        all.push(loadImage(skiybox_dir + '/negz.webp').then((img) => {this.sky.negz = img}));

        // Skybox shaders
        if (settings.wgsl) {
            all.push(loadTextFile('./shaders/skybox_gpu/shader.wgsl').then((txt) => { this.codeSky = { vertex: txt, fragment: txt} } ));
        } else {
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { this.codeSky.vertex = txt } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { this.codeSky.fragment = txt } ));
        }

        // Shader blocks

        if (settings.wgsl) {
            // not supported 
        } else {
            all.push(
                loadTextFile('./shaders/shader.blocks.glsl')
                    .then(text => Resources.parseShaderBlocks(text, this.shaderBlocks))
                    .then(blocks => {
                        console.log('Load shader blocks:', blocks);
                    })
            );
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

    /**
     * Parse shader.blocks file defenition
     * @param {string} text 
     * @param {{[key: string]: string}} blocks
     */
    static async parseShaderBlocks(text, blocks = {}) {
        const blocksStart = '#ifdef';
        const blocksEnd = '#endif';

        let start = text.indexOf(blocksStart);
        let end = start;

        while(start > -1) {
            end = text.indexOf(blocksEnd, start);

            if (end === -1) {
                throw new TypeError('Shader block has unclosed ifdef statement at:' + start + '\n\n' + text);
            }

            const block = text.substring(start  + blocksStart.length, end);
            const lines = block.split('\n');
            const name = lines.shift().trim();

            const source = lines.map((e) => {
                return e.startsWith('    ') // remove first tab (4 space)
                    ? e.substring(4).trimEnd() 
                    : e.trimEnd();
            }).join('\n');

            blocks[name] = source.trim();

            start = text.indexOf(blocksStart, start + blocksStart.length);
        }

        return blocks;
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
        const json = await Resources.loadTextFile(baseUrl + entry.geom, true);
        const keys = Object.keys(entry.skins);
        const skins = [];
        json.type = entry.type;
        json.source = entry;
        json.key = key;
        json.skins = {};
        for(let key of keys) {
            skins.push(
                Resources
                .loadImage(baseUrl + entry.skins[key], !!self.createImageBitmap)
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

    // loadResourcePacks...
    static async loadResourcePacks() {
        let resp = null;
        await Helpers.fetchJSON('../data/resource_packs.json').then(json => {
            resp = json;
        });
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

    // Load models
    static async loadModels() {
        return  Helpers.fetchJSON('../media/models/database.json');
    }

}