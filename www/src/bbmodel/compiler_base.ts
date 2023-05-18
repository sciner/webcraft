import { Spritesheet_Base } from "../core/spritesheet_base.js";
import { isScalar, Vector } from "../helpers.js";

export class BBModel_Compiler_Base {
    [key: string]: any;

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

    async loadImage(url : string) : Promise<ImageBitmap> {
        return new Promise(async resolve => {
            const blob = await fetch(url).then(res => res.blob())
            resolve(createImageBitmap(blob))
        })
    }

    createTextureID() {
        return 'bbmodel_texture_' + new String(this.spritesheets.length + 1)
    }

    createSpritesheet(tx_cnt : int, resolution : int, options : any, id? : any) {
        id = this.createTextureID()
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
        const spritesheet = this.createSpritesheet(this.options.tx_cnt, this.options.resolution, this.options)
        this.spritesheets.unshift(this.spritesheets.pop())
        return spritesheet
    }

    async loadModelTexture(index, texture, tx_sz : int, tx_cnt : int) {
        if(isScalar(texture)) {
            /*
                if(!texture.endsWith('.png')) texture += '.png';
                tex = await spritesheet.loadTex(texture, []);
            */
            throw 'error_texture_from_external_file_denied'
        } else if('source' in texture) {
            const image = await this.loadImage(texture.source)
            const fixTextureName = (name : string) => {
                name = name.replace('.png', '')
                name = name.replace('.PNG', '')
                return name
            }
            return {
                texture:    image,
                x_size:     Math.min(Math.ceil(image.width / tx_sz), tx_cnt),
                y_size:     Math.min(Math.ceil(image.height / tx_sz), tx_cnt),
                id:         this.calcTextureID(index, texture),
                name:       texture.name ? fixTextureName(texture.name) : null
            }
        }
        throw 'error_unrecognize_texture_format';
    }

    /**
     * Метод ищет атлас, куда поместятся все текстуры одной модели.
     * Если метод не нашел места ни в одном атласе, то создает ещё 1 атлас и рекурсивно вызывает сам себя (только 1 раз)
     */
    async findPlaces(textures, create_if_not_place : boolean = false, tx_sz : int, tx_cnt : int, options : any) {
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
                // Remove invisible polygons
                const sz = new Vector(el.from).subSelf(new Vector(el.to))
                if(sz.x * sz.y * sz.z === 0) {
                    const delete_faces = []
                    if(sz.x == 0) {
                        // west or east
                        delete_faces.push(...['up', 'down', 'south', 'north'])
                        delete_faces.push(el.faces.east?.texture !== null ? 'west' : 'east')
                    } else if(sz.y == 0) {
                        // up or down
                        delete_faces.push(...['south', 'north', 'east', 'west'])
                        delete_faces.push(el.faces.up?.texture !== null ? 'down' : 'up')
                    } else if(sz.z == 0) {
                        // west or east
                        delete_faces.push(...['up', 'down', 'east', 'west'])
                        delete_faces.push(el.faces.south?.texture !== null ? 'north' : 'south')
                    }
                    if(delete_faces.length > 0) {
                        for(const name of delete_faces) {
                            delete(el.faces[name])
                        }
                    }
                }
                //
                for(let side in el.faces) {
                    const face = el.faces[side];
                    if('texture' in face && 'uv' in face) {
                        if(face.texture === null) {
                            delete(el.faces[side])
                            continue
                        }
                        model.polygons += 2
                        let face_texture_id = face.texture + '';
                        if(face_texture_id !== null) {

                            if(face_texture_id.startsWith('#')) {
                                face_texture_id = face_texture_id.substring(1)
                            }
                            const texture_item = textures.get(face_texture_id)

                            if(texture_item) {

                                const uv = face.uv

                                const uvx1 = uv[2] * texture_item.scale_x
                                const uvy1 = uv[3] * texture_item.scale_y
                                const uvx2 = uv[0] * texture_item.scale_x
                                const uvy2 = uv[1] * texture_item.scale_y

                                //
                                const uvw = uvx2 - uvx1
                                const uvh = uvy2 - uvy1

                                face.texture = texture_item.texture_id + ''

                                face.uv = [
                                    ((texture_item.x * tx_sz + uvx1 + uvw / 2)),
                                    ((texture_item.y * tx_sz + uvy1 + uvh / 2)),
                                    -uvw,
                                    -uvh
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
                        case 'up': {
                            face.uv[3] *= -1
                            break;
                        }
                        case 'down': {
                            face.uv[2] *= -1
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