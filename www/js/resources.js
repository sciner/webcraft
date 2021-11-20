import { BLOCK } from "./blocks.js";
import "./../vendors/gl-matrix-3.3.min.js";
import { glTFLoader } from "./../vendors/minimal-gltf-loader.js";

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

        //
        let that = Resources;

        that.codeMain = {};
        that.codeSky = {};
        that.terrain = {};
        that.pickat = {};
        that.sky = {};
        that.clouds = {};
        that.physics = {
            features: null
        };
        that.models = {};
        that.resource_packs = new Set();
        //
        const loadTextFile = Resources.loadTextFile;
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap);
        let all = [];
        if (settings.wgsl) {
            all.push(loadTextFile('./shaders/skybox_gpu/shader.wgsl').then((txt) => { that.codeSky = { vertex: txt, fragment: txt} } ));
        } else {
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { that.codeSky.vertex = txt } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { that.codeSky.fragment = txt } ));
        }

        all.push(loadImage('media/' + settings.texture_pack + '.png').then((img) => { that.terrain.image = img}));
        all.push(loadImage('media/pickat_target.png').then((img) => { that.pickat.target = img}));

        let skiybox_dir = './media/skybox/park';
        // let skiybox_dir = './media/skybox/title_background';
        all.push(loadImage(skiybox_dir + '/posx.jpg').then((img) => {that.sky.posx = img}));
        all.push(loadImage(skiybox_dir + '/negx.jpg').then((img) => {that.sky.negx = img}));
        all.push(loadImage(skiybox_dir + '/posy.jpg').then((img) => {that.sky.posy = img}));
        all.push(loadImage(skiybox_dir + '/negy.jpg').then((img) => {that.sky.negy = img}));
        all.push(loadImage(skiybox_dir + '/posz.jpg').then((img) => {that.sky.posz = img}));
        all.push(loadImage(skiybox_dir + '/negz.jpg').then((img) => {that.sky.negz = img}));

        // Physics features
        all.push(fetch('/vendors/prismarine-physics/lib/features.json').then(response => response.json()).then(json => { that.physics.features = json;}));

        // Clouds texture
        all.push(loadImage('/media/clouds.png').then((image1) => {
            let canvas          = document.createElement('canvas');
            canvas.width        = 256;
            canvas.height       = 256;
            let ctx             = canvas.getContext('2d');
            ctx.drawImage(image1, 0, 0, 256, 256, 0, 0, 256, 256);
            that.clouds.texture = ctx.getImageData(0, 0, 256, 256);
        }));

        all.push(
            Resources.loadJsonDatabase('/media/models/json/database.json', '/media/models/json')
                .then((t) => Object.assign(that.models, t.assets))
                .then((loaded) => {
                    console.log("Loaded models:", loaded);
                })
        );

        // Resource packs
        for(let init_file of BLOCK.resource_packs) {
            all.push(import(init_file).then((module) => {that.resource_packs.add(module.default);}));
        }
        //
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
        return Promise.all(all); // .then(() => { return this; });
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

}