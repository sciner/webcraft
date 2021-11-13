import { BLOCK } from "../../js/blocks.js";
import { Helpers } from '../../js/helpers.js';
import {BaseResourcePack} from '../../js/base_resource_pack.js';
import {Resources} from '../../js/resources.js';

const getRunningScript = () => {
    return decodeURI(new Error().stack.match(/([^ \n\(@])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/ig)[0])
}

export default class ResourcePack extends BaseResourcePack {

    constructor() {
        super();
        this.id = 'default';
        this.dir = getRunningScript() + '/..';
    }

    //
    async initTextures(renderBackend, settings) {
        let that = this;
        const loadImage = (url) => Resources.loadImage(url, true);
        let v = {
            tx_cnt: 32,
            image: '/../../media/' + settings.texture_pack + '.png'
        }
        await loadImage(this.dir + v.image).then(async (image) => {
            v.width = image.width;
            v.height = image.height;
            v.texture = renderBackend.createTexture({
                source: await that.genMipMapTexture(image, settings),
                style: await that.genTextureStyle(image, settings),
                minFilter: 'nearest',
                magFilter: 'nearest',
                anisotropy: settings.mipmap ? 4.0 : 0.0,
            });
        });
        this.textures.set('default', v);
    }

}
