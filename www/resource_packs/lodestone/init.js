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

}