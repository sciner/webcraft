const getRunningScript = () => {
    return decodeURI(new Error().stack.match(/([^ \n\(@])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/ig)[0])
}

export default class ResourcePack {

    constructor(block_manager) {
        this.block_manager = block_manager;
    }

    init() {
        let that = this;
        let block_manager = this.block_manager;
        fetch(getRunningScript() + '/../blocks.json', {mode: 'no-cors'}).then(response => response.json()).then(blocks => {
            for(let block of blocks) {
                block.resource_pack = that;
                block_manager.add(block);
            }
        });
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