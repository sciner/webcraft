//TODO: move resource pack texture asset here!
export interface TextureJsonInfo {
    image: string;
    image_n?: string;
    tx_cnt?: number;
    _canvas?: {width: number, height: number};
    mip?: boolean;
}

export interface TerrainTextureGraphicsSettings {
    mipmap?: number;
    useNormals?: boolean;
    dir?: string;
}

export interface BundleOptions {
    dir?: string;
}

export class TerrainTextureAsset {
    info: TextureJsonInfo;

    constructor(info: TextureJsonInfo) {
        this.info = info;
    }

    async process(settings: TerrainTextureGraphicsSettings, bundleOptions: BundleOptions) {

    }
}
