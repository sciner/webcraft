import {BLOCK} from "./blocks.js";
import {Helpers} from './helpers.js';
import {Resources} from'./resources.js';
import {TerrainTextureUniforms} from "./renders/common.js";

export class BaseResourcePack {

    constructor() {
        this.id = null;
        this.dir = null;
        this.textures = new Map();
        this.materials = new Map();
    }

    async init() {
        let dir = this.dir;
        let that = this;
        //
        await Helpers.fetchJSON(dir + '/conf.json').then((json) => {
            that.conf = json;
        });
        //
        await Helpers.fetchJSON(dir + '/blocks.json').then((json) => {
            for(let block of json) {
                BLOCK.add(that, block);
            }
        });
    }

    async initShaders(renderBackend) {
        let shader_options = null;
        if('gl' in renderBackend) {
            shader_options = this.conf.shader.webgl;
            shader_options.vertex = this.dir + shader_options.vertex;
            shader_options.fragment = this.dir + shader_options.fragment;
        } else {
            shader_options = this.dir + this.conf.shader.webgpu;
        }
        let that = this;
        return renderBackend.createResourcePackShader(shader_options).then((shader) => {
            that.shader = shader;
            shader.resource_pack_id = that.id;
        });
    }

    async initTextures(renderBackend, settings) {
        let that = this;
        const loadImage = async (url) => Resources.loadImage(url, true);
        if('textures' in this.conf) {
            for(let [k, v] of Object.entries(this.conf.textures)) {
                // Image
                await loadImage(this.dir + v.image).then(async (image) => {
                    v.texture = renderBackend.createTexture({
                        source: await that.genMipMapTexture(image, settings),
                        style: this.genTextureStyle(image, settings),
                        minFilter: 'nearest',
                        magFilter: 'nearest',
                    });
                    v.width = image.width;
                    v.height = image.height;
                    // Get image bytes
                    let canvas          = document.createElement('canvas');
                    canvas.width        = image.width;
                    canvas.height       = image.height;
                    let ctx             = canvas.getContext('2d');
                    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);
                    v.imageData = ctx.getImageData(0, 0, image.width, image.height);
                });
                // Image N
                v.texture_n = null;
                if('image_n' in v) {
                    await loadImage(this.dir + v.image_n).then(async (image_n) => {
                        v.texture_n = renderBackend.createTexture({
                            source: await that.genMipMapTexture(image_n, settings),
                            style: this.genTextureStyle(image_n, settings),
                            minFilter: 'nearest',
                            magFilter: 'nearest',
                        });
                    });
                }
                this.textures.set(k, v);
            }
        }
    }

    genTextureStyle(image, settings) {
        let terrainTexSize          = image.width;
        let terrainBlockSize        = image.width / 512 * 16;
        const style = new TerrainTextureUniforms();
        style.blockSize = terrainBlockSize / terrainTexSize;
        style.pixelSize = 1.0 / terrainTexSize;
        style.mipmap = settings.mipmap ? 4.0 : 0.0;
        return style;
    }

    //
    getMaterial(key) {
        let texMat = this.materials.get(key);
        if(texMat) {
            return texMat;
        }
        let key_arr = key.split('/');
        let texture_id = key_arr[2];
        let matkey = [
            key_arr[0],
            key_arr[1],
            'default'
        ].join('/');
        let mat = this.materials.get(matkey);
        texMat = mat.getSubMat(this.getTexture(texture_id).texture);
        this.materials.set(key, texMat);
        return texMat;
    }

    //
    async genMipMapTexture(image, settings) {
        if (!settings.mipmap) {
            if (image instanceof  self.ImageBitmap) {
                return  image;
            }
            return await self.createImageBitmap(image, {premultiplyAlpha: 'none'});
        }
        const canvas2d = document.createElement('canvas');
        const context = canvas2d.getContext('2d');
        const w = image.width;
        canvas2d.width = w * 2;
        canvas2d.height = w * 2;
        let offset = 0;
        context.drawImage(image, 0, 0);
        for (let dd = 2; dd <= 16; dd *= 2) {
            const nextOffset = offset + w * 2 / dd;
            context.drawImage(canvas2d, offset, 0, w * 2 / dd, w, nextOffset, 0, w / dd, w);
            offset = nextOffset;
        }
        offset = 0;
        for (let dd = 2; dd <= 16; dd *= 2) {
            const nextOffset = offset + w * 2 / dd;
            context.drawImage(canvas2d, 0, offset, w * 2, w * 2 / dd, 0, nextOffset, w * 2, w / dd);
            offset = nextOffset;
        }
        // canvas2d.width = 0;
        // canvas2d.height = 0;
        // return await self.createImageBitmap(canvas2d);
        /*
            var link = document.createElement('a');
            link.download = 'filename.png';
            link.href = canvas2d.toDataURL()
            link.click();
        */
        return canvas2d;
    }

    getTexture(id) {
        return this.textures.get(id);
    }

    // pushVertices
    pushVertices(vertices, block, world, x, y, z, neighbours, biome) {
        const style = block.material.style;
        let module = BLOCK.styles[style];
        if(!module) {
            throw 'Invalid vertices style `' + style + '`';
        }
        return module.func(block, vertices, world, x, y, z, neighbours, biome, true);
    }
}
