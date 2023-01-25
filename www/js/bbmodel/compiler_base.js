import { Spritesheet_Base } from "../core/spritesheet_base.js";
import { isScalar } from "../helpers.js";

export class BBModel_Compiler_Base {

    //
    constructor(options) {
        this.options = options
        this.spritesheets = []
    }

    //
    calcTextureID(i, texture) {
        let id = i;
        if(!isScalar(texture) && 'id' in texture) {
            id = texture.id;
        }
        return id;
    }

    async loadImage(url) {
        return new Promise(async resolve => {
            const blob = await fetch(url).then(res => res.blob())
            resolve(createImageBitmap(blob))
        })
    }

    createTextureID() {
        return 'bbmodel_texture_' + new String(this.spritesheets.length + 1)
    }

    createSpritesheet(tx_cnt, resolution, options) {
        const id = this.createTextureID()
        const spritesheet = new Spritesheet_Base(id, tx_cnt, resolution, options)
        this.spritesheets.push(spritesheet)
        return spritesheet
    }

    /**
     * @param {int} tx_cnt 
     * @param {int} resolution 
     * @param {object} options 
     * @returns {Spritesheet_Base}
     */
    getSpritesheet(tx_cnt, resolution, options) {
        if(this.spritesheets.length == 0) {
            this.createSpritesheet(tx_cnt, resolution, options)
        }
        const spritesheet = this.spritesheets[this.spritesheets.length - 1]
        return spritesheet
    }

    getSpritesheetByID(id) {
        for(let spritesheet of this.spritesheets) {
            if(spritesheet.id == id) {
                return spritesheet
            }
        }
        const spritesheet = this.createSpritesheet(this.options.tx_cnt, this.options.resolution, this.options, id)
        this.spritesheets.unshift(this.spritesheets.pop())
        return spritesheet
    }

    /**
     * @param {*} texture 
     * @returns 
     */
    async loadModelTexture(index, texture, tx_sz, tx_cnt) {
        if(isScalar(texture)) {
            /*
                if(!texture.endsWith('.png')) texture += '.png';
                tex = await spritesheet.loadTex(texture, []);
            */
            throw 'error_texture_from_external_file_denied'
        } else if('source' in texture) {
            const image = await this.loadImage(texture.source)
            return {
                texture:    image,
                x_size:     Math.min(Math.ceil(image.width / tx_sz), tx_cnt),
                y_size:     Math.min(Math.ceil(image.height / tx_sz), tx_cnt),
                id:         this.calcTextureID(index, texture),
                name:       texture?.name ?? null
            }
        }
        throw 'error_unrecognize_texture_format';
    }

    /**
     * Метод ищет атлас, куда поместятся все текстуры одной модели.
     * Если метод не нашел места ни в одном атласе, то создает ещё 1 атлас и рекурсивно вызывает сам себя (только 1 раз)
     * @param {*} textures 
     * @param {boolean} create_if_not_place 
     * @returns 
     */
    async findPlaces(textures, create_if_not_place, tx_sz, tx_cnt, options) {
        for(let spritesheet of this.spritesheets) {
            const places = []
            try {
                for(let i in textures) {
                    const tex = await this.loadModelTexture(i, textures[i], tx_sz, tx_cnt)
                    const pos = spritesheet.findPlace(true, tex.x_size, tex.y_size)
                    places.push({
                        ...pos,
                        width: tex.x_size,
                        height: tex.y_size,
                        image_width: tex.texture.width,
                        image_height: tex.texture.height,
                        tex
                    })
                }
                return {spritesheet, places}
            } catch(e) {
                // очистить занятые места в аиласе, если не хватило места хотябы одной текстуре модели
                spritesheet.clearMapPlaces(places)
            }
        }
        if(!create_if_not_place) {
            throw 'error_no_place_in_bbmodel_spritesheets'
        }
        // если ни на одной нет места, то добавить еще один спрайтшит
        // this.getSpritesheet(tx_cnt, tx_sz, options)
        this.createSpritesheet(tx_cnt, tx_sz, options)
        // и попробовать заново
        return this.findPlaces(textures, false, tx_sz, tx_cnt, options)
    }

    /**
     * @param {*} model 
     * @param {*} id 
     * @param {*} options 
     * @returns 
     */
    async prepareModel(model, id, options) {

        model.name = id

        const tx_sz = options.resolution
        const tx_cnt = options.tx_cnt

        const {places, spritesheet} = await this.findPlaces(model.textures, true, tx_sz, tx_cnt, options)
        const textures = new Map()

        for(let i in places) {
            const place = places[i]
            const resolution = model.resolution ?? {width: spritesheet.width, height: spritesheet.height}
            const tex = place.tex
            const texture_item = {
                texture_id: tex.id,
                scale_x:    tex.texture.width / resolution.width,
                scale_y:    tex.texture.height / resolution.height,
                ...await spritesheet.drawTexture(tex.texture, place.x, place.y) // {x, y, sx, sy};
            }
            textures.set(i + '', texture_item);
            textures.set(tex.id, texture_item)
        }

        model.polygons = 0

        // each model elements
        for(let el of model.elements) {
            if(el.faces) {
                for(let side in el.faces) {
                    model.polygons += 2
                    const face = el.faces[side];
                    if('texture' in face && 'uv' in face) {
                        let face_texture_id = face.texture + '';
                        if(face_texture_id !== null) {

                            if(face_texture_id.startsWith('#')) {
                                face_texture_id = face_texture_id.substring(1)
                            }
                            const texture_item = textures.get(face_texture_id)

                            if(texture_item) {

                                const uv = face.uv

                                const uvx1 = Math.min(uv[0], uv[2]) * texture_item.scale_x
                                const uvy1 = Math.min(uv[1], uv[3]) * texture_item.scale_y
                                const uvx2 = Math.max(uv[0], uv[2]) * texture_item.scale_x
                                const uvy2 = Math.max(uv[1], uv[3]) * texture_item.scale_y

                                //
                                const uvw = uvx2 - uvx1
                                const uvh = uvy2 - uvy1

                                face.texture = texture_item.texture_id + ''

                                face.uv = [
                                    ((texture_item.x * tx_sz + uvx1 + uvw / 2)),
                                    ((texture_item.y * tx_sz + uvy1 + uvh / 2)),
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

        return {spritesheet, places}

    }

}