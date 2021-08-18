
export class Resources {
    constructor() {
        this.codeMain = {};
        this.codeSky = {};
        this.terrain = {};
        this.sky = {};
    }
    /**
     * @param settings
     * @param settings.hd hd textures
     * @param settings.glsl need glsl
     * @param settings.wgsl need wgls for webgpu
     * @param settings.imageBitmap return imageBitmap for image instead of Image
     * @returns {Promise<void>}
     */
    async load(settings) {
        const loadTextFile = Resources.loadTextFile;
        const loadImage = (url) => Resources.loadImage(url, settings.imageBitmap);

        let all = [];
        if (settings.wgsl) {
            all.push(loadTextFile('./shaders/main_gpu/shader.wgsl').then((txt) => { this.codeMain = { vertex: txt, fragment: txt} } ));
            all.push(loadTextFile('./shaders/skybox_gpu/shader.wgsl').then((txt) => { this.codeSky = { vertex: txt, fragment: txt} } ));
        } else {
            all.push(loadTextFile('./shaders/main/vertex.glsl').then((txt) => { this.codeMain.vertex = txt } ));
            all.push(loadTextFile('./shaders/main/fragment.glsl').then((txt) => { this.codeMain.fragment = txt } ));
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { this.codeSky.vertex = txt } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { this.codeSky.fragment = txt } ));
        }

        all.push(loadImage('media/' + settings.texture_pack + '.png').then((img) => { this.terrain.image = img}));

        let skiybox_dir = './media/skybox/park';
        all.push(loadImage(skiybox_dir + '/posx.jpg').then((img) => {this.sky.posx = img}));
        all.push(loadImage(skiybox_dir + '/negx.jpg').then((img) => {this.sky.negx = img}));
        all.push(loadImage(skiybox_dir + '/posy.jpg').then((img) => {this.sky.posy = img}));
        all.push(loadImage(skiybox_dir + '/negy.jpg').then((img) => {this.sky.negy = img}));
        all.push(loadImage(skiybox_dir + '/posz.jpg').then((img) => {this.sky.posz = img}));
        all.push(loadImage(skiybox_dir + '/negz.jpg').then((img) => {this.sky.negz = img}));

        //TODO: add retry
        await Promise.all(all).then(() => { return this; });
    }
}

Resources.loadTextFile = (url) => {
    return fetch(url).then(response => response.text());
}

Resources.loadImage = (url,  imageBitmap) => {
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
