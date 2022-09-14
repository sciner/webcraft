export class Mesh_Effect_Base {

    static textures = [];

    constructor(pos, params) {}

    getTexture(textures) {
        const texture_index = Math.floor(textures.length * Math.random());
        const texture = textures[texture_index];
        return {
            texture,
            texture_index
        };
    }

}