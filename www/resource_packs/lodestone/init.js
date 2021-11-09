import { BLOCK } from "../../js/blocks.js";
import { Helpers } from '../../js/helpers.js';
import {BaseResourcePack} from '../../js/base_resource_pack.js';

const getRunningScript = () => {
    return decodeURI(new Error().stack.match(/([^ \n\(@])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/ig)[0])
}

export default class ResourcePack extends BaseResourcePack {

    constructor() {
        super();
        this.id = 'lodestone';
        this.dir = getRunningScript() + '/..';
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