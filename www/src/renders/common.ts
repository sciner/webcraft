export class TerrainTextureUniforms {
    [key: string]: any;
    constructor() {
        this.blockSize = 16.0;
        this.pixelSize = 1.0 / 512.0;
        this.mipmap = 0;
    }
}

TerrainTextureUniforms.default = new TerrainTextureUniforms();
