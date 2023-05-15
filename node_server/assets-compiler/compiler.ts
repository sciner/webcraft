import skiaCanvas from 'skia-canvas';
import fs from 'fs';
import { DEFAULT_TEXTURE_SUFFIXES, Spritesheet } from "./spritesheet.js";
import { CompileData } from "./compile_data.js";
import { DEFAULT_STYLE_NAME, DEFAULT_TX_CNT } from '@client/constant.js';
import { Mth } from '@client/helpers.js';

const BLOCK_NAMES = {
    DIRT: 'DIRT',
    MOB_SPAWN: 'MOB_SPAWN',
    GRASS_BLOCK: 'GRASS_BLOCK',
    GRASS: ['GRASS', 'TALL_GRASS']
};

// Compiler
export class Compiler {
    spritesheets: Map<any, any>;
    options: any;
    default_n: skiaCanvas.Canvas;
    base_conf: any;
    compile_data: CompileData;
    tempCanvases: any;
    flammable_blocks: Map<string, {catch_chance_modifier: float, destroy_chance_modifier: float}>;

    constructor(options) {
        options.n_color = '#8080ff';
        this.spritesheets = new Map();
        // options.blockstates_dir = options.texture_pack_dir + '/assets/minecraft/blockstates';
        if(!Array.isArray(options.texture_pack_dir)) {
            options.texture_pack_dir = [options.texture_pack_dir];
        }
        for(let i = 0; i < options.texture_pack_dir.length; i++) {
            options.texture_pack_dir[i] = options.texture_pack_dir[i] + '/assets/minecraft/textures';
        }
        this.options = options;
        // Make default n texture
        this.default_n = new skiaCanvas.Canvas(options.resolution, options.resolution);
        const ctx = this.default_n.getContext('2d');
        ctx.fillStyle = options.n_color;
        ctx.fillRect(0, 0, options.resolution, options.resolution);
        //
        this.initFlamable();
    }

    /**
     * Return spritesheet file
     * @param {string} id 
     * @returns {Spritesheet}
     */
    getSpritesheet(id) {
        let spritesheet = this.spritesheets.get(id);
        if(!spritesheet) {
            const tx_cnt = this.base_conf.textures[id]?.tx_cnt ?? DEFAULT_TX_CNT;
            spritesheet = new Spritesheet(id, tx_cnt, this.options.resolution, this.options);
            this.spritesheets.set(id, spritesheet);
        }
        return spritesheet;
    }

    getSpritesheetByID(id) {
        return this.getSpritesheet(id)
    }

    // Init
    async init() {
        const compile_json = await import(this.options.compile_json, {
            assert: { type: 'json' }
        });
        this.compile_data = new CompileData(compile_json.default);
        await this.compile_data.init();
        //
        this.base_conf = (await import(this.options.base_conf, {
            assert: { type: 'json' }
        })).default;
    }

    async run() {
        // Predefined textures
        for(let texture of this.compile_data.predefined_textures) {
            const spritesheet = this.getSpritesheet(texture.spritesheet_id);
            const tex = await spritesheet.loadTex(texture.image, DEFAULT_TEXTURE_SUFFIXES);
            const {sx, sy} = await spritesheet.drawTexture(tex.texture, texture.x, texture.y, texture.has_mask);
            // отрисовать картинку в маске с переводом всех непрозрачных пикселей в черный цвет
            if(texture.diff_to_mask || texture.diff_to_source) {
                const shift = sx * (texture.diff_to_mask ? 1 : -1);
                spritesheet.drawTexture(tex.texture, texture.x + shift, texture.y, texture.has_mask);
                spritesheet.drawTexture(tex.texture, texture.x + shift, texture.y, texture.has_mask, 'difference');
            }
            // spritesheet.drawTexture(tex.n || this.default_n, texture.x, texture.y, false, null, null, this.options.n_texture_id);
            for(let suffix of DEFAULT_TEXTURE_SUFFIXES) {
                const key = suffix.key
                await spritesheet.drawTexture(tex[key], texture.x, texture.y, false, null, null, `_${key}`);
            }
        }
        this.compile_data.blocks = await this.compileBlocks(this.compile_data.blocks);
        await this.export();
    }

    // Export
    async export() {
        for(const item of this.spritesheets.values()) {
            item.export();
        }
        const data = JSON.stringify(this.compile_data.blocks, null, 4);
        fs.writeFileSync(`${this.options.output_dir}/blocks.json`, data);
        // copy files
        for(let fn of this.options.copy_files) {
            fs.copyFile(`./${fn}`, `${this.options.output_dir}/${fn}`, (err) => {
                if(err) {
                    throw err;
                }
                console.error(`${fn} was copied to destination`);
            });
        }
    }

    // imageOverlay
    imageOverlay(img, overlay_color, w, h) {
        if(!this.tempCanvases) {
            this.tempCanvases = new Map();
        }
        const key = `${w}x${h}`;
        let item = this.tempCanvases.get(key);
        if(!item) {
            item = {
                cnv: new skiaCanvas.Canvas(w, h)
            }
            item.ctx = item.cnv.getContext('2d');
            item.ctx.imageSmoothingEnabled = false;
            this.tempCanvases.set(key, item)
        }
        //
        item.ctx.globalCompositeOperation = 'source-over';
        item.ctx.fillStyle = overlay_color;
        item.ctx.fillRect(0, 0, w, h);
        //
        item.ctx.globalCompositeOperation = 'overlay';
        item.ctx.drawImage(img, 0, 0, w, h);
        //
        item.ctx.globalCompositeOperation = 'destination-in';
        item.ctx.drawImage(img, 0, 0, w, h);
        return item.cnv;
    }

    makeModelName(block) {
        if(!block.style) {
            block.style = DEFAULT_STYLE_NAME
        }
        block.style_name = block.bb?.model ?? block.style
    }

    //
    async compileBlocks(blocks : IBlockMaterial[], spritesheet_storage? : any) {

        if(!spritesheet_storage) {
            spritesheet_storage = this
        }

        // Each all blocks from JSON file
        let dirt_image = null;
        let num_blocks = 0;
        let tmpCnv;
        let tmpContext;

        const resp = []

        for(let block of blocks) {

            if(!('id' in block)) continue

            this.makeModelName(block)

            //
            block.tags = block.tags ?? [];

            block.flammable = this.flammable_blocks.get(block.name) ?? null

            // Auto add tags
            const tags = block.tags = block.tags || [];
            if(['stairs'].indexOf(block.style_name) >= 0 || block.layering?.slab) {
                block.tags.push('no_drop_ao');
            }
            if(tags.includes('log') && !block.coocked_item) {
                block.coocked_item = {name: 'CHARCOAL', count: 1};
            }

            //
            if('texture' in block) {

                console.log(++num_blocks, block.name);
                
                if(Array.isArray(block.texture)) {
                    throw 'error_invalid_texture_declaration1';
                }

                const spritesheet_id = block.texture?.id ?? 'default';

                const spritesheet = spritesheet_storage.getSpritesheet(spritesheet_id);

                const opTextures = async (obj, texture_key, property_name? : string) => {
                    
                    if(typeof obj[texture_key] === 'string' || obj[texture_key] instanceof String) {
                        obj[texture_key] = {side: obj[texture_key]};
                    }

                    //
                    for(let tid in obj[texture_key]) {
                        const value = obj[texture_key][tid];
                        if(Array.isArray(value)) {
                            throw 'error_invalid_texture_declaration2';
                        }
                        if(tid == 'id') {
                            continue
                        }
                        if(!tmpContext) {
                            tmpCnv = new skiaCanvas.Canvas(spritesheet.tx_sz, spritesheet.tx_sz);
                            tmpContext = tmpCnv.getContext('2d');
                            tmpContext.imageSmoothingEnabled = false;
                        }
    
                        let tex = spritesheet.textures.get(value);
                        if(value.indexOf('|') >= 0) {
                            const pos_arr = value.split('|');
                            tex = {pos: {x: parseFloat(pos_arr[0]), y: parseFloat(pos_arr[1])}};
                        }
                        let x_size = 1;
                        let y_size = 1;
                        const has_mask = tags.includes('mask_biome') || tags.includes('mask_color') || value.includes(';mask_biome');
                        const compile = block.compile;
                        if(!tex) {
                            const img = await spritesheet.loadTex(value, DEFAULT_TEXTURE_SUFFIXES);
                            //
                            if(img.texture.width == 16) {
                                const scale = 2;
                                const temp = new skiaCanvas.Canvas(img.texture.width * scale, img.texture.height * scale);
                                const ctx = temp.getContext('2d');
                                ctx.imageSmoothingEnabled = false;
                                ctx.drawImage(
                                    img.texture,
                                    0, 0, img.texture.width, img.texture.height,
                                    0, 0, img.texture.width * scale, img.texture.height * scale
                                );
                                img.texture = temp;
                            }
                            //
                            if(block.name == BLOCK_NAMES.DIRT && property_name == 'texture') {
                                dirt_image = img.texture;
                            }
                            //
                            x_size = Math.min(Math.ceil(img.texture.width / spritesheet.tx_sz), spritesheet.tx_cnt);
                            y_size = Math.min(Math.ceil(img.texture.height / spritesheet.tx_sz), spritesheet.tx_cnt);
                            //
                            if(has_mask) {
                                x_size *= 2;
                            }
                            if(block.name == BLOCK_NAMES.MOB_SPAWN) {
                                y_size *= 2;
                            }
                            //
                            const pos = spritesheet.findPlace(block, x_size, y_size);
                            tex = {
                                img: img.texture,
                                pos,
                                has_mask,
                                x_size,
                                y_size
                            };
                            for(let suffix of DEFAULT_TEXTURE_SUFFIXES) {
                                tex[suffix.key] = img[suffix.key]
                            }
                            spritesheet.textures.set(value, tex);
                            if(block.name == BLOCK_NAMES.GRASS_BLOCK && tid == 'side' && (property_name != 'texture_overlays') && (property_name != 'connected_sides')) {
                                spritesheet.drawTexture(dirt_image, tex.pos.x, tex.pos.y);
                                spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y);
                                spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y, false, 'difference');
                                spritesheet.drawTexture(dirt_image, tex.pos.x + 1, tex.pos.y, false, 'source-over');
                                spritesheet.drawTexture(dirt_image, tex.pos.x + 1, tex.pos.y, false, 'difference');
                                spritesheet.drawTexture(tex.img, tex.pos.x + 1, tex.pos.y, false, 'source-over');
                                // grass head shadow
                                const canvas = new skiaCanvas.Canvas(tex.img.width, tex.img.height);
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(tex.img, 0, 0, tex.img.width, tex.img.height);
                                spritesheet.ctx.globalCompositeOperation = 'source-over';
                                spritesheet.ctx.fillStyle = '#00000065';
                                for(let i = 0; i < tex.img.width; i++) {
                                    for(let j = 0; j < tex.img.height; j++) {
                                        const pix = ctx.getImageData(i, j, 1, 1).data;
                                        if(pix[3] == 0) {
                                            const x = tex.pos.x * spritesheet.tx_sz + i;
                                            const y = tex.pos.y * spritesheet.tx_sz + j;
                                            spritesheet.ctx.fillRect(x, y, 1, 1);
                                            spritesheet.ctx.fillRect(x, y + 1, 1, 1);
                                            break;
                                        }
                                    }
                                }
                            } else if(block.name == BLOCK_NAMES.MOB_SPAWN) {
                                const img_glow = (await spritesheet.loadTex('block/spawner_glow.png', DEFAULT_TEXTURE_SUFFIXES)).texture;
                                spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y, has_mask);
                                spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y + 1, has_mask);
                                spritesheet.drawTexture(img_glow, tex.pos.x, tex.pos.y + 1, has_mask);
                            } /*else if(BLOCK_NAMES.GRASS_BLOCK.includes(block.name)) {
                                spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y, has_mask);
                                spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y, has_mask);
                            }*/ else {
                                await spritesheet.drawTexture(tex.img, tex.pos.x, tex.pos.y, has_mask, null, has_mask ? compile?.overlay_mask : null, null, compile);
                                // await spritesheet.drawTexture(tex.n, tex.pos.x, tex.pos.y, false, null, null, this.options.n_texture_id);
                                for(let suffix of DEFAULT_TEXTURE_SUFFIXES) {
                                    const key = suffix.key
                                    await spritesheet.drawTexture(tex[key], tex.pos.x, tex.pos.y, false, null, null, `_${key}`);
                                }
                            }
                        }
    
                        // calculate animation frames
                        if(block.texture_animations && tex.img) {
                            if(tid in block.texture_animations) {
                                if(block.texture_animations[tid] === null) {
                                    block.texture_animations[tid] = Math.min(tex.img.height / spritesheet.tx_sz, spritesheet.tx_cnt);
                                }
                            }
                        }
    
                        // check compile rules
                        if(compile) {
                            const ctx = spritesheet.ctx;
                            const x = tex.pos.x * spritesheet.tx_sz;
                            const y = tex.pos.y * spritesheet.tx_sz;
                            const w = spritesheet.tx_sz;
                            const h = spritesheet.tx_sz;
                            // overlay color
                            if(compile.overlay_color) {
                                ctx.drawImage(this.imageOverlay(tex.img, compile.overlay_color, w, h), x, y, w, h);
                            }
                            // grass light
                            if(compile?.grass_light) {
                                const grassCanvas = new skiaCanvas.Canvas(tex.img.width, tex.img.height)
                                const grassCtx = grassCanvas.getContext('2d')
                                grassCtx.drawImage(tex.img, 0, 0, tex.img.width, tex.img.height);
                                const pix = grassCtx.getImageData(0, 0, tex.img.width, tex.img.height)
                                const pix_data = pix.data
                                for(let i = 0; i < tex.img.width; i++) {
                                    for(let j = 0; j < tex.img.height; j++) {
                                        const index = (j * tex.img.width + i) * 4
                                        if(pix_data[index + 3] == 0) {
                                            continue;
                                        }
                                        const y = (1 - (j / tex.img.height)) / 2.;
                                        for(let c = 0; c < 3; c++) {
                                            pix_data[index + c] = Mth.clamp(pix_data[index + c] + y * pix_data[index + c], 0, 255)
                                        }
                                    }
                                }
                                grassCtx.putImageData(pix, 0, 0)
                                ctx.drawImage(grassCanvas, x + tex.img.width, y)
                            }
                            //
                            if(compile.layers) {
                                for(let layer of compile.layers) {
                                    const layer_img = await spritesheet.loadTex(layer.image, DEFAULT_TEXTURE_SUFFIXES);
                                    ctx.drawImage(this.imageOverlay(layer_img.texture, layer.overlay_color, w, h), x, y, w, h);
                                }
                            }
                        }
                        //
                        obj[texture_key][tid] = [tex.pos.x, tex.pos.y];
                        // check big size textures
                        const tex_slot_count = has_mask ? tex.x_size/2 : tex.x_size;
                        if(tex_slot_count > 1) {
                            if(obj[texture_key][tid].length == 2) obj[texture_key][tid].push(0);
                            obj[texture_key][tid].push(tex_slot_count);
                        }
    
                        // check compile rules
                        if(block.compile) {
                            const compile = block.compile;
                            if(compile.add_3pos) {
                                // add third part for texture position
                                let param = compile.add_3pos[tid];
                                if(typeof param != 'undefined') {
                                    obj[texture_key][tid].push(param);
                                }
                            }
                        }
                    }
                };

                await opTextures(block, 'texture', 'texture');

                for(let tv of ['texture_variants', 'texture_overlays', 'connected_sides']) {
                    if(tv in block) {
                        try {
                            for(let k in block[tv]) {
                                await opTextures(block[tv], k, tv);
                            }
                        } catch(e) {
                            // TODO: это временно, пока мы полностью не создадим свой текстур пак
                            delete(block[tv])
                        }
                    }
                }

                // inventory icon
                if(block?.inventory?.texture) {
                    let spritesheet_id = 'default';
                    let value = block.inventory.texture;
                    let tex = null;
                    if(typeof value == 'object' && 'image' in value && 'id' in value) {
                        spritesheet_id = value.id;
                        value = value.image;
                    }
                    //
                    if(typeof value == 'object' && 'side' in value && 'id' in value) {
                        spritesheet_id = value.id;
                        value = value.side;
                    }
                    //
                    const spritesheet = spritesheet_storage.getSpritesheetByID(spritesheet_id);
                    if((value as string).indexOf('|') >= 0) {
                        const pos_arr = (value as string).split('|');
                        tex = {pos: {x: parseFloat(pos_arr[0]), y: parseFloat(pos_arr[1])}};
                    } else {
                        const img = await spritesheet.loadTex(value, DEFAULT_TEXTURE_SUFFIXES);
                        tex = spritesheet.textures.get(value);
                        if(!tex) {
                            tex = {pos: spritesheet.findPlace(block, 1, 1)};
                            spritesheet.drawTexture(img.texture, tex.pos.x, tex.pos.y);
                            // spritesheet.drawTexture(img.n || this.default_n, tex.pos.x, tex.pos.y, false, null, null, this.options.n_texture_id);
                            for(let suffix of DEFAULT_TEXTURE_SUFFIXES) {
                                const key = suffix.key
                                await spritesheet.drawTexture(img[key], tex.pos.x, tex.pos.y, false, null, null, `_${key}`);
                            }
                        }
                    }
                    block.inventory.texture = {
                        id: spritesheet_id,
                        tx_cnt: spritesheet.tx_cnt,
                        side: [tex.pos.x, tex.pos.y]
                    }
                }

                const processTextureList = async (spritesheet : any, texture_list: string[]) : Promise<any[]> => {
                    const resp = []
                    for(let i in texture_list) {
                        const value = texture_list[i]
                        const img = await spritesheet.loadTex(value, DEFAULT_TEXTURE_SUFFIXES);
                        let tex = spritesheet.textures.get(value)
                        if(!tex) {
                            tex = {pos: spritesheet.findPlace(block, 1, 1)}
                            spritesheet.drawTexture(img.texture, tex.pos.x, tex.pos.y)
                            // spritesheet.drawTexture(img.n || this.default_n, tex.pos.x, tex.pos.y, false, null, null, this.options.n_texture_id);
                            for(let suffix of DEFAULT_TEXTURE_SUFFIXES) {
                                const key = suffix.key
                                await spritesheet.drawTexture(img[key], tex.pos.x, tex.pos.y, false, null, null, `_${key}`)
                            }
                            spritesheet.textures.set(value, tex)
                        }
                        resp[i] = [tex.pos.x, tex.pos.y]
                    }
                    return resp
                }

                // stage textures (eg. seeds)
                for(let texture_property_name of ['stage_textures']) {
                    if(texture_property_name in block) {
                        const spritesheet = spritesheet_storage.getSpritesheet('default')
                        const texture_list = block[texture_property_name]
                        block[texture_property_name] = await processTextureList(spritesheet, texture_list)
                    }
                }

                // hanging textures (eg. liana)
                for(let texture_property_name of ['hanging_textures']) {
                    if(texture_property_name in block) {
                        const spritesheet = spritesheet_storage.getSpritesheet('default')
                        const parts = block[texture_property_name]
                        for(let part_index in parts) {
                            const part = parts[part_index]
                            for(const key in part) {
                                const list = part[key]
                                part[key] = await processTextureList(spritesheet, list)
                            }
                        }
                    }
                }

                // redstone textures
                if(block.redstone?.textures) {
                    const spritesheet = spritesheet_storage.getSpritesheet('default');
                    for(let k of ['dot', 'line']) {
                        for(let i in block.redstone.textures[k]) {
                            const value = block.redstone.textures[k][i];
                            const img = await spritesheet.loadTex(value, DEFAULT_TEXTURE_SUFFIXES);
                            let tex = spritesheet.textures.get(value);
                            if(!tex) {
                                tex = {pos: spritesheet.findPlace(block, 2, 1)};
                                spritesheet.drawTexture(img.texture, tex.pos.x, tex.pos.y, true);
                                // spritesheet.drawTexture(img.n || this.default_n, tex.pos.x, tex.pos.y, false, null, null, this.options.n_texture_id);
                                for(let suffix of DEFAULT_TEXTURE_SUFFIXES) {
                                    const key = suffix.key
                                    await spritesheet.drawTexture(img[key], tex.pos.x, tex.pos.y, false, null, null, `_${key}`);
                                }
                                spritesheet.textures.set(value, tex);
                            }
                            block.redstone.textures[k][i] = [tex.pos.x, tex.pos.y];
                        }
                    }
                }

                delete(block.compile);

            }

            resp.push(block)
        }

        return resp
    }

    setFlammable(block_name : string, catch_chance_modifier, destroy_chance_modifier) {
        this.flammable_blocks.set(block_name, {catch_chance_modifier, destroy_chance_modifier});
    }

    initFlamable() {
        this.flammable_blocks = new Map();
        this.setFlammable('OAK_PLANKS', 5, 20);
        this.setFlammable('SPRUCE_PLANKS', 5, 20);
        this.setFlammable('BIRCH_PLANKS', 5, 20);
        this.setFlammable('JUNGLE_PLANKS', 5, 20);
        this.setFlammable('ACACIA_PLANKS', 5, 20);
        this.setFlammable('DARK_OAK_PLANKS', 5, 20);
        this.setFlammable('OAK_SLAB', 5, 20);
        this.setFlammable('SPRUCE_SLAB', 5, 20);
        this.setFlammable('BIRCH_SLAB', 5, 20);
        this.setFlammable('JUNGLE_SLAB', 5, 20);
        this.setFlammable('ACACIA_SLAB', 5, 20);
        this.setFlammable('DARK_OAK_SLAB', 5, 20);
        this.setFlammable('OAK_FENCE_GATE', 5, 20);
        this.setFlammable('SPRUCE_FENCE_GATE', 5, 20);
        this.setFlammable('BIRCH_FENCE_GATE', 5, 20);
        this.setFlammable('JUNGLE_FENCE_GATE', 5, 20);
        this.setFlammable('DARK_OAK_FENCE_GATE', 5, 20);
        this.setFlammable('ACACIA_FENCE_GATE', 5, 20);
        this.setFlammable('OAK_FENCE', 5, 20);
        this.setFlammable('SPRUCE_FENCE', 5, 20);
        this.setFlammable('BIRCH_FENCE', 5, 20);
        this.setFlammable('JUNGLE_FENCE', 5, 20);
        this.setFlammable('DARK_OAK_FENCE', 5, 20);
        this.setFlammable('ACACIA_FENCE', 5, 20);
        this.setFlammable('OAK_STAIRS', 5, 20);
        this.setFlammable('BIRCH_STAIRS', 5, 20);
        this.setFlammable('SPRUCE_STAIRS', 5, 20);
        this.setFlammable('JUNGLE_STAIRS', 5, 20);
        this.setFlammable('ACACIA_STAIRS', 5, 20);
        this.setFlammable('DARK_OAK_STAIRS', 5, 20);
        this.setFlammable('OAK_LOG', 5, 5);
        this.setFlammable('SPRUCE_LOG', 5, 5);
        this.setFlammable('BIRCH_LOG', 5, 5);
        this.setFlammable('JUNGLE_LOG', 5, 5);
        this.setFlammable('ACACIA_LOG', 5, 5);
        this.setFlammable('DARK_OAK_LOG', 5, 5);
        this.setFlammable('STRIPPED_OAK_LOG', 5, 5);
        this.setFlammable('STRIPPED_SPRUCE_LOG', 5, 5);
        this.setFlammable('STRIPPED_BIRCH_LOG', 5, 5);
        this.setFlammable('STRIPPED_JUNGLE_LOG', 5, 5);
        this.setFlammable('STRIPPED_ACACIA_LOG', 5, 5);
        this.setFlammable('STRIPPED_DARK_OAK_LOG', 5, 5);
        this.setFlammable('STRIPPED_OAK_WOOD', 5, 5);
        this.setFlammable('STRIPPED_SPRUCE_WOOD', 5, 5);
        this.setFlammable('STRIPPED_BIRCH_WOOD', 5, 5);
        this.setFlammable('STRIPPED_JUNGLE_WOOD', 5, 5);
        this.setFlammable('STRIPPED_ACACIA_WOOD', 5, 5);
        this.setFlammable('STRIPPED_DARK_OAK_WOOD', 5, 5);
        this.setFlammable('OAK_WOOD', 5, 5);
        this.setFlammable('SPRUCE_WOOD', 5, 5);
        this.setFlammable('BIRCH_WOOD', 5, 5);
        this.setFlammable('JUNGLE_WOOD', 5, 5);
        this.setFlammable('ACACIA_WOOD', 5, 5);
        this.setFlammable('DARK_OAK_WOOD', 5, 5);
        this.setFlammable('OAK_LEAVES', 30, 60);
        this.setFlammable('SPRUCE_LEAVES', 30, 60);
        this.setFlammable('BIRCH_LEAVES', 30, 60);
        this.setFlammable('JUNGLE_LEAVES', 30, 60);
        this.setFlammable('ACACIA_LEAVES', 30, 60);
        this.setFlammable('DARK_OAK_LEAVES', 30, 60);
        this.setFlammable('BOOKSHELF', 30, 20);
        this.setFlammable('TNT', 15, 100);
        this.setFlammable('GRASS', 60, 100);
        this.setFlammable('FERN', 60, 100);
        this.setFlammable('DEAD_BUSH', 60, 100);
        this.setFlammable('SUNFLOWER', 60, 100);
        this.setFlammable('LILAC', 60, 100);
        this.setFlammable('ROSE_BUSH', 60, 100);
        this.setFlammable('PEONY', 60, 100);
        this.setFlammable('TALL_GRASS', 60, 100);
        this.setFlammable('LARGE_FERN', 60, 100);
        this.setFlammable('DANDELION', 60, 100);
        this.setFlammable('POPPY', 60, 100);
        this.setFlammable('BLUE_ORCHID', 60, 100);
        this.setFlammable('ALLIUM', 60, 100);
        this.setFlammable('AZURE_BLUET', 60, 100);
        this.setFlammable('RED_TULIP', 60, 100);
        this.setFlammable('ORANGE_TULIP', 60, 100);
        this.setFlammable('WHITE_TULIP', 60, 100);
        this.setFlammable('PINK_TULIP', 60, 100);
        this.setFlammable('OXEYE_DAISY', 60, 100);
        this.setFlammable('CORNFLOWER', 60, 100);
        this.setFlammable('LILY_OF_THE_VALLEY', 60, 100);
        this.setFlammable('WITHER_ROSE', 60, 100);
        this.setFlammable('WHITE_WOOL', 30, 60);
        this.setFlammable('ORANGE_WOOL', 30, 60);
        this.setFlammable('MAGENTA_WOOL', 30, 60);
        this.setFlammable('LIGHT_BLUE_WOOL', 30, 60);
        this.setFlammable('YELLOW_WOOL', 30, 60);
        this.setFlammable('LIME_WOOL', 30, 60);
        this.setFlammable('PINK_WOOL', 30, 60);
        this.setFlammable('GRAY_WOOL', 30, 60);
        this.setFlammable('LIGHT_GRAY_WOOL', 30, 60);
        this.setFlammable('CYAN_WOOL', 30, 60);
        this.setFlammable('PURPLE_WOOL', 30, 60);
        this.setFlammable('BLUE_WOOL', 30, 60);
        this.setFlammable('BROWN_WOOL', 30, 60);
        this.setFlammable('GREEN_WOOL', 30, 60);
        this.setFlammable('RED_WOOL', 30, 60);
        this.setFlammable('BLACK_WOOL', 30, 60);
        this.setFlammable('VINE', 15, 100);
        this.setFlammable('COAL_BLOCK', 5, 5);
        this.setFlammable('HAY_BLOCK', 60, 20);
        this.setFlammable('TARGET', 15, 20);
        this.setFlammable('WHITE_CARPET', 60, 20);
        this.setFlammable('ORANGE_CARPET', 60, 20);
        this.setFlammable('MAGENTA_CARPET', 60, 20);
        this.setFlammable('LIGHT_BLUE_CARPET', 60, 20);
        this.setFlammable('YELLOW_CARPET', 60, 20);
        this.setFlammable('LIME_CARPET', 60, 20);
        this.setFlammable('PINK_CARPET', 60, 20);
        this.setFlammable('GRAY_CARPET', 60, 20);
        this.setFlammable('LIGHT_GRAY_CARPET', 60, 20);
        this.setFlammable('CYAN_CARPET', 60, 20);
        this.setFlammable('PURPLE_CARPET', 60, 20);
        this.setFlammable('BLUE_CARPET', 60, 20);
        this.setFlammable('BROWN_CARPET', 60, 20);
        this.setFlammable('GREEN_CARPET', 60, 20);
        this.setFlammable('RED_CARPET', 60, 20);
        this.setFlammable('BLACK_CARPET', 60, 20);
        this.setFlammable('DRIED_KELP_BLOCK', 30, 60);
        this.setFlammable('BAMBOO', 60, 60);
        this.setFlammable('SCAFFOLDING', 60, 60);
        this.setFlammable('LECTERN', 30, 20);
        this.setFlammable('COMPOSTER', 5, 20);
        this.setFlammable('SWEET_BERRY_BUSH', 60, 100);
        this.setFlammable('BEEHIVE', 5, 20);
        this.setFlammable('BEE_NEST', 30, 20);
        this.setFlammable('AZALEA_LEAVES', 30, 60);
        this.setFlammable('FLOWERING_AZALEA_LEAVES', 30, 60);
        this.setFlammable('CAVE_VINES', 15, 60);
        this.setFlammable('CAVE_VINES_PLANT', 15, 60);
        this.setFlammable('SPORE_BLOSSOM', 60, 100);
        this.setFlammable('AZALEA', 30, 60);
        this.setFlammable('FLOWERING_AZALEA', 30, 60);
        this.setFlammable('BIG_DRIPLEAF', 60, 100);
        this.setFlammable('BIG_DRIPLEAF_STEM', 60, 100);
        this.setFlammable('SMALL_DRIPLEAF', 60, 100);
        this.setFlammable('HANGING_ROOTS', 30, 60);
        this.setFlammable('GLOW_LICHEN', 15, 100);
    }

}
