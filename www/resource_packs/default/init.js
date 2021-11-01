const getRunningScript = () => {
    return decodeURI(new Error().stack.match(/([^ \n\(@])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/ig)[0])
}

const loadTextFile = (url) => {
    return fetch(url).then(response => response.text());
}

export default class ResourcePack {

    constructor(block_manager) {
        this.id = 'default';
        this.block_manager = block_manager;
        // Shaders
        this.shaders = {
            vertex: null,
            fragment: null,
        };
    }

    async init() {
        let that = this;
        let dir = getRunningScript() + '/..';
        let block_manager = this.block_manager;
        await fetch(dir + '/blocks.json', {mode: 'no-cors'}).then(response => response.json()).then(blocks => {
            for(let block of blocks) {
                block.resource_pack = that;
                block_manager.add(block);
            }
        });
        // shaders
        /*
        let all = [
            loadTextFile(dir + '/shaders/vertex.glsl').then((txt) => { this.shaders.vertex = txt } ),
            loadTextFile(dir + '/shaders/fragment.glsl').then((txt) => { this.shaders.fragment = txt } ),
        ]
        await Promise.all(all).then(() => { return this; });
        */
    }

    // pushVertices
    pushVertices(vertices, block, world, lightmap, x, y, z, neighbours, biome) {
        const style = block.material.style;
        /*if(block.material.resource_pack) {
            block.material.resource_pack.pushVertices();
        }*/
        let module = this.block_manager.styles[style];
        if(!module) {
            throw 'Invalid vertices style `' + style + '`';
        }
        return module.func(block, vertices, world, lightmap, x, y, z, neighbours, biome, true);
    }

}