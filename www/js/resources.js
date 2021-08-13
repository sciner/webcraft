export class Resources {
    constructor() {
        this.glslMain = {};
        this.glslSky = {};
        this.terrain = {};
        this.sky = {};
    }
    /**
     * @param settings
     * @param settings.hd hd textures
     * @param settings.glsl need glsl
     * @returns {Promise<void>}
     */
    async load(settings) {
        function loadTextFile(url) {
            return fetch(url).then(response => response.text());
        }
        function loadImage(url) {
            return new Promise((resolve, reject) => {
                const image        = new Image();
                image.onload = function() {
                    resolve(image);
                };
                image.onError = function () {
                    reject();
                };
                image.src = url;
            })
        }

        let all = [];
        if (settings.glsl) {
            all.push(loadTextFile('./shaders/main/vertex.glsl').then((txt) => { this.glslMain.vertex = txt } ));
            all.push(loadTextFile('./shaders/main/fragment.glsl').then((txt) => { this.glslMain.fragment = txt } ));
            all.push(loadTextFile('./shaders/skybox/vertex.glsl').then((txt) => { this.glslSky.vertex = txt } ));
            all.push(loadTextFile('./shaders/skybox/fragment.glsl').then((txt) => { this.glslSky.fragment = txt } ));
        }

        all.push(loadImage(settings.hd ? 'media/terrain_hd.png' : 'media/terrain.png').then((img) => { this.terrain.image = img}));

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
