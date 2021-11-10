import {BLOCK} from "./blocks.js";

export class Resources {

    static onLoading = (state) => {};

    /**
     * @param settings
     * @param settings.hd hd textures
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

    static loadTextFile(url) {
        return fetch(url).then(response => response.text());
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

}