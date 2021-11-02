import { BLOCK } from "../../js/blocks.js";

const getRunningScript = () => {
    return decodeURI(new Error().stack.match(/([^ \n\(@])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/ig)[0])
}

export default class ResourcePack {

    constructor() {
        this.id = 'lodestone';
    }

    async init() {
        let that = this;
        return fetch(getRunningScript() + '/../blocks.json', {mode: 'no-cors'}).then(response => response.json()).then(blocks => {
            for(let block of blocks) {
                block.resource_pack = that;
                BLOCK.add(block);
            }
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