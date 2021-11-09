import {BLOCK} from "./blocks.js";
import {Helpers} from './helpers.js';

export class BaseResourcePack {

    constructor() {
        this.id = null;
        this.dir = null;
    }

    async init() {
        let dir = this.dir;
        let that = this;
        let blocks = null;
        //
        await Helpers.fetchJSON(dir + '/conf.json').then((json) => {
            that.conf = json;
        });
        //
        await Helpers.fetchJSON(dir + '/blocks.json').then((json) => {
            blocks = json;
            for(let block of blocks) {
                block.resource_pack = that;
                BLOCK.add(block);
            }
        });
    }

    async initShader(renderBackend) {
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
        });
    }

    // pushVertices
    pushVertices(vertices, block, world, lightmap, x, y, z, neighbours, biome) {
        const style = block.material.style;
        let module = BLOCK.styles[style];
        if(!module) {
            throw 'Invalid vertices style `' + style + '`';
        }
        return module.func(block, vertices, world, lightmap, x, y, z, neighbours, biome, true);
    }

}