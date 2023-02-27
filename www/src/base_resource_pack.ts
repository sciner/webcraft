import {Color, Helpers, AlphabetTexture, IndexedColor} from './helpers.js';
import {Resources} from'./resources.js';
import {TerrainTextureUniforms} from "./renders/common.js";
import { DEFAULT_TX_SIZE, LIGHT_TYPE_RTX } from './constant.js';
import type { TBlock } from './typed_blocks3.js';
import type { FakeTBlock } from './blocks.js';
import type { ChunkWorkerChunk } from './worker/chunk.js';

let tmpCanvas;

const LAYERING_MOVE_TO_DOWN_STYLES = ['red_mushroom', 'brown_mushroom', 'sweet_berry_bush', 'petals', 'pebbles']

export class BaseResourcePack {
    [key: string]: any;

    constructor(BLOCK, location, id) {
        this.BLOCK = BLOCK;
        this.id = id;
        this.dir = location;
        this.textures = new Map();
        this.materials = new Map();

        this.manager = null;
        this.shader = null;
        this.fluidShader = null;

        this.styles_stat = new Map();
    }

    async init(manager) {
        this.manager = manager;

        const dir = (manager.settings?.resource_packs_basedir || '') + this.dir;
        const draw_improved_blocks = !!manager.settings?.draw_improved_blocks

        return Promise.all([
            Helpers.fetchJSON(dir + '/conf.json', true, 'rp'),
            Helpers.fetchJSON(dir + '/blocks.json', true, 'rp')
        ]).then(async ([conf, blocks]) => {
            this.conf = conf;
            const import_blocks = conf.id != 'bbmodel' || draw_improved_blocks
            if(import_blocks) {
                for(let b of blocks) {
                    await this.BLOCK.add(this, b);
                }
            }
        })
    }

    async initSingleShader(renderBackend, shared = false, shaderName = 'shader') {
        if (this[shaderName]) {
            this[shaderName].shared = shared;
            return
        }

        let shader_options = null;

        const conf = this.conf[shaderName];
        if (!conf || conf.extends) {
            const pack = this.manager.list.get(this.conf.shader?.extends || 'base');

            if (pack) {
                pack.initShaders(renderBackend, true);
                this.shader = pack.shader;
                return;
            }
        }
        if ('gl' in renderBackend) {
            shader_options = conf.webgl;
            shader_options = {
                vertex: this.dir + shader_options.vertex,
                fragment: this.dir + shader_options.fragment,
                shaderName,
            }
        } else {
            shader_options = this.dir + conf.webgpu;
        }
        const shader = this[shaderName] = await renderBackend.createResourcePackShader(shader_options);
        shader.resource_pack_id = this.id;
        shader.shared = shared;
    }

    async initShaders(renderBackend, shared = false) {
        await this.initSingleShader(renderBackend, shared, 'shader');
        if (this.conf.fluidShader) {
            await this.initSingleShader(renderBackend, shared, 'fluidShader');
        }
    }

    async _loadTexture (url, settings, renderBackend, textureInfo) {
        const image = await Resources.loadImage(url, true);

        const texture = renderBackend.createTexture({
            source: await this.genMipMapTexture(image, settings, textureInfo),
            style: this.genTextureStyle(image, settings, image.width / textureInfo.tx_cnt),
            minFilter: textureInfo?.minFilter || 'nearest',
            magFilter: textureInfo?.magFilter ||'nearest',
        });

        return {
            image, texture
        }
    }

    async _processTexture (textureInfo, renderBackend, settings) {

        let image, texture;

        if('canvas' in textureInfo) {
            const cnv = textureInfo.canvas;
            cnv.canvas = document.createElement('canvas');
            cnv.canvas.width = cnv.width;
            cnv.canvas.height = cnv.height;
            cnv.ctx = cnv.canvas.getContext('2d');

            // Fill magenta background
            // cnv.ctx.fillStyle = '#ff0088';
            // cnv.ctx.imageSmoothingEnabled = false;
            // cnv.ctx.fillRect(0, 0, 200, 200);

            // demo text
            cnv.ctx.fillStyle = '#ffffffff';
            cnv.ctx.textBaseline = 'top';
            const char_size = {
                width: cnv.width / textureInfo.tx_cnt,
                height: cnv.height / textureInfo.tx_cnt
            }
            AlphabetTexture.init();
            for(let item of AlphabetTexture.chars.values()) {
                const char = item.char;
                let py = 0;
                if(char.length > 1) {
                    cnv.ctx.font = '18px UbuntuMono-Regular';
                    py = 7;
                } else {
                    cnv.ctx.font = '31px UbuntuMono-Regular';
                    py = 1;
                }
                const mt = cnv.ctx.measureText(char);
                cnv.ctx.fillText(char, item.x + 16-mt.width/2, item.y+py);
            }

            // Helpers.downloadImage(cnv.canvas, 'alphabet.png');

            const settings_for_canvas = {...settings};
            settings_for_canvas.mipmap = false;

            const texture = renderBackend.createTexture({
                source: cnv.canvas,
                style: this.genTextureStyle(cnv.canvas, settings_for_canvas, DEFAULT_TX_SIZE),
                minFilter: 'nearest',
                magFilter: 'nearest',
            });

            textureInfo.texture = texture;
            textureInfo.width   = cnv.width;
            textureInfo.height  = cnv.height;
            textureInfo.texture_n = null;
            // textureInfo.imageData = cnv.ctx.getImageData(0, 0, cnv.width, cnv.height);

            return;

        } else {
            let resp = await this._loadTexture(
                this.dir + textureInfo.image,
                settings,
                renderBackend,
                textureInfo
            );
            image = resp.image;
            texture = resp.texture;
        }

        textureInfo.texture = texture;
        textureInfo.width   = image.width;
        textureInfo.height  = image.height;
        textureInfo.texture_n = null;

        // Get image bytes
        const canvas        = tmpCanvas;
        const ctx           = canvas.getContext('2d');

        canvas.width        = image.width;
        canvas.height       = image.height;

        ctx.drawImage(
            image, 0, 0,
            image.width,
            image.height, 0, 0,
            image.width, image.height
        );

        textureInfo.imageData = ctx.getImageData(0, 0, image.width, image.height);
        textureInfo.getColorAt = function(x, y) {
            const ax = (x * this.width / 1024.0) | 0;
            const ay = (y * this.height / 1024.0) | 0;
            const index = ((ay * this.width) + ax) * 4;
            return new Color(
                this.imageData.data[index + 0],
                this.imageData.data[index + 1],
                this.imageData.data[index + 2],
                this.imageData.data[index + 3]
            );
        };

        canvas.width = canvas.height = 0;

        if ('image_n' in textureInfo && settings.use_light == LIGHT_TYPE_RTX) {
            const { texture } = await this._loadTexture(
                this.dir + textureInfo.image_n,
                settings,
                renderBackend,
                textureInfo
            );

            textureInfo.texture_n = texture;
        }

    }

    async initTextures(renderBackend, settings) {
        if (!this.conf.textures) {
            return;
        }

        const tasks = [];

        tmpCanvas = tmpCanvas || document.createElement('canvas');

        for(let [k, v] of Object.entries(this.conf.textures)) {
            tasks.push(this._processTexture(v, renderBackend, settings));

            this.textures.set(k, v);
        }

        return Promise.all(tasks)
    }

    genTextureStyle(image, settings, terrainBlockSize = DEFAULT_TX_SIZE) {
        let terrainTexSize = image.width;
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
        let group = key_arr[1];
        let shaderName = key_arr[2] === 'fluid' ? 'fluidShader' : 'shader';
        let texture_id = key_arr[3];
        let mat = this[shaderName].materials[group];
        texMat = mat.getSubMat(this.getTexture(texture_id).texture);
        this.materials.set(key, texMat);
        return texMat;
    }

    //
    async genMipMapTexture(image, settings, texInfo) {
        if (!settings.mipmap || texInfo.mip === false) {
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

    // Push vertices
    pushVertices(tblock : TBlock | FakeTBlock, vertices : Float32Array | float[], chunk : ChunkWorkerChunk, pos : IVector, neighbours : any, biome? : any, dirt_color? : IndexedColor, unknown? : any, _matrix? : imat4, _pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture, draw_style? : string) {

        const style = draw_style ? draw_style : tblock.material.style;
        const module = this.BLOCK.styles.get(style);
        if(!module) {
            throw 'Invalid vertices style `' + style + '`';
        }

        //
        let y = pos.y
        const style_name = tblock?.material.style_name
        if(LAYERING_MOVE_TO_DOWN_STYLES.includes(style_name)) {
            // layering
            if(neighbours && neighbours.DOWN) {
                const under_height = neighbours.DOWN.material.height;
                if(under_height && under_height < 1) {
                    y -= 1 - under_height;
                }
            }
        }

        /*
        // stat
        let stat = this.styles_stat.get(style);
        if(!stat) {
            stat = {count: 0, time: 0}
            this.styles_stat.set(style, stat);
        }*/

        // let p = performance.now();
        const resp = module.func(tblock, vertices, chunk, pos.x, y, pos.z, neighbours, biome, dirt_color, unknown, _matrix, _pivot, force_tex);
        // stat.count++;
        // stat.time += (performance.now() - p);
        if (vertices.length % 15 > 0) {
            console.log("oops mesh");
        }
        return resp;
    }

}