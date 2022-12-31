import { Spritesheet_Base } from "../core/spritesheet_base.js";
import { isScalar } from "../helpers.js";

export class BBModel_Compiler_Base {

    //
    constructor(options) {
        this.options = options;
    }

    //
    calcTextureID(i, texture) {
        let id = i;
        if(!isScalar(texture) && 'id' in texture) {
            id = texture.id;
        }
        return id;
    }

    async loadImage(source) {
        throw 'error_not_implemented';
    }

    createSpritesheet(id, tx_cnt, resolution, options) {
        return new Spritesheet_Base(id, tx_cnt, resolution, options);
    }

    async prepareModel(model, id, options) {

        // 1. create spritesheet
        const spritesheet = this.createSpritesheet(id, options.tx_cnt, options.resolution, options)
        const textures = new Map();
        const resolution = model.resolution ?? {width: spritesheet.width, height: spritesheet.height};

        // 2. each model textures
        for(let i in model.textures) {
            let texture = model.textures[i];
            let tex = null;
            if(isScalar(texture)) {
                if(!texture.endsWith('.png')) texture += '.png';
                tex = await spritesheet.loadTex(texture);
            } else if('source' in texture) {
                tex = {
                    texture: await this.loadImage(texture.source)
                }
            } else {
                throw 'error_unrecognize_texture_format';
            }
            const x_size = Math.min(Math.ceil(tex.texture.width / spritesheet.tx_sz), spritesheet.tx_cnt);
            const y_size = Math.min(Math.ceil(tex.texture.height / spritesheet.tx_sz), spritesheet.tx_cnt);
            const pos = spritesheet.findPlace(null, x_size, y_size);
            const texture_id = this.calcTextureID(i, texture);
            const texture_item = {
                texture_id,
                scale_x: tex.texture.width / resolution.width,
                scale_y: tex.texture.height / resolution.height,
                ...await spritesheet.drawTexture(tex.texture, pos.x, pos.y) // {x, y, sx, sy};
            }
            textures.set(i + '', texture_item);
            textures.set(texture_id, texture_item);
        }

        // each model elements
        for(let el of model.elements) {
            if(el.faces) {
                for(let side in el.faces) {
                    const face = el.faces[side];
                    if('texture' in face && 'uv' in face) {
                        let face_texture_id = face.texture + '';
                        if(face_texture_id !== null) {

                            if(face_texture_id.startsWith('#')) {
                                face_texture_id = face_texture_id.substring(1);
                            }
                            const texture_item = textures.get(face_texture_id);

                            if(texture_item) {

                                const uv = face.uv;

                                const uvx1 = Math.min(uv[0], uv[2]) * texture_item.scale_x;
                                const uvy1 = Math.min(uv[1], uv[3]) * texture_item.scale_y;
                                const uvx2 = Math.max(uv[0], uv[2]) * texture_item.scale_x;
                                const uvy2 = Math.max(uv[1], uv[3]) * texture_item.scale_y;

                                //
                                const uvw = uvx2 - uvx1;
                                const uvh = uvy2 - uvy1;

                                face.uv = [
                                    ((texture_item.x * spritesheet.tx_sz + uvx1 + uvw / 2)),
                                    ((texture_item.y * spritesheet.tx_sz + uvy1 + uvh / 2)),
                                    uvw,
                                    uvh
                                ];

                            }
                        }
                    }
                }

                // Change face sides for out format
                const faces = {};
                for(let side in el.faces) {
                    const face = el.faces[side];
                    switch(side) {
                        case 'south': side = 'north'; break;
                        case 'north': side = 'south'; break;
                        case 'west': side = 'east'; break;
                        case 'east': side = 'west'; break;
                        case 'up': {
                            face.uv[3] *= -1
                            break;
                        }
                        case 'down': {
                            face.uv[2] *= -1
                            face.uv[3] *= -1
                            break;
                        }
                    }
                    faces[side] = face;
                }
                el.faces = faces;
            }
        }

        return {spritesheet}

    }


}