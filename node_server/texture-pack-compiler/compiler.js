import skiaCanvas from 'skia-canvas';
import fs from 'fs';
import { Spritesheet } from "./spritesheet.js";
import { CompileData } from "./compile_data.js";

const BLOCK_NAMES = {
    DIRT: 'DIRT',
    MOB_SPAWN: 'MOB_SPAWN',
    GRASS_DIRT: 'GRASS_DIRT'
};

// Compiler
export class Compiler {

    constructor(options) {
        this.spritesheets = new Map();
        this.options = options;
    }

    // Return spritesheet file
    getSpritesheet(id) {
        let spritesheet = this.spritesheets.get(id);
        if(!spritesheet) {
            const tx_cnt = this.base_conf.textures[id].tx_cnt;
            spritesheet = new Spritesheet(id, tx_cnt, this.options.TX_SZ, this.options.textures_dir);
            this.spritesheets.set(id, spritesheet);
        }
        return spritesheet;
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
            const img = await skiaCanvas.loadImage(texture.image);
            spritesheet.drawImage(img, texture.x, texture.y);
        }
        try {
            await this.compileBlocks(this.compile_data.blocks);
            await this.export();
        } catch(e) {
            console.error(e);
        }
    }

    // Export
    async export() {
        for(const item of this.spritesheets.values()) {
            item.export();
        }
        const data = JSON.stringify(this.compile_data.blocks, null, 4);
        fs.writeFileSync(`${this.options.output_dir}/blocks.json`, data);
        // copy files
        for(let fn of ['textures/painting.png']) {
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

    //
    async compileBlocks(blocks) {
        // Each all blocks from JSON file
        let dirt_image = null;
        let num_blocks = 0;
        let tmpCnv;
        let tmpContext;
        for(let block of blocks) {
            if('texture' in block) {
                console.log(++num_blocks, block.name);
                let spritesheet_id = 'default';
                if(Array.isArray(block.texture)) {
                    throw 'error_invalid_texture_declaration1';
                }
                if(typeof block.texture === 'string' || block.texture instanceof String) {
                    block.texture = {side: block.texture};
                }
                const tags = ('tags' in block) ? block.tags : [];
                for(let k in block.texture) {
                    const value = block.texture[k];
                    if(Array.isArray(value)) {
                        throw 'error_invalid_texture_declaration2';
                    }
                    if(k == 'id') {
                        spritesheet_id = value;
                        continue
                    }
                    const spritesheet = this.getSpritesheet(spritesheet_id);

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
                    const has_mask = tags.indexOf('mask_biome') >= 0 || tags.indexOf('mask_color') >= 0;
                    if(!tex) {
                        const img = await spritesheet.loadTextureImage(value);
                        //
                        if(block.name == BLOCK_NAMES.DIRT) {
                            dirt_image = img;
                        }
                        //
                        if(has_mask) {
                            x_size = 2;
                        } else {
                            x_size = Math.ceil(img.width / spritesheet.tx_sz);
                            y_size = Math.min(img.height / spritesheet.tx_sz, 32);
                        }
                        if(block.texture_animations) {
                            if(k in block.texture_animations) {
                                if(block.texture_animations[k] === null) {
                                    block.texture_animations[k] = Math.min(img.height / spritesheet.tx_sz, spritesheet.tx_cnt);
                                }
                            }
                        }
                        if(block.name == BLOCK_NAMES.MOB_SPAWN) {
                            y_size = 2;
                        }
                        //
                        const pos = spritesheet.findPlace(block, x_size, y_size);
                        if(block.name == BLOCK_NAMES.GRASS_DIRT && k == 'side') {
                            spritesheet.drawImage(dirt_image, pos.x, pos.y);
                            spritesheet.drawImage(img, pos.x, pos.y);
                            spritesheet.drawImage(img, pos.x, pos.y, false, 'difference');
                            spritesheet.drawImage(dirt_image, pos.x + 1, pos.y, false, 'source-over');
                            spritesheet.drawImage(dirt_image, pos.x + 1, pos.y, false, 'difference');
                            spritesheet.drawImage(img, pos.x + 1, pos.y, false, 'source-over');
                        } else if(block.name == BLOCK_NAMES.MOB_SPAWN) {
                            const img_glow = await spritesheet.loadTextureImage('block/spawner_glow.png');
                            spritesheet.drawImage(img, pos.x, pos.y, has_mask);
                            spritesheet.drawImage(img, pos.x, pos.y + 1, has_mask);
                            spritesheet.drawImage(img_glow, pos.x, pos.y + 1, has_mask);
                        } else {
                            spritesheet.drawImage(img, pos.x, pos.y, has_mask);
                        }
                        tex = {
                            pos,
                            has_mask,
                            x_size,
                            y_size
                        };
                        spritesheet.textures.set(value, tex);
                        // check compile rules
                        if(block.compile) {
                            const compile = block.compile;
                            const ctx = spritesheet.ctx;
                            const x = pos.x * spritesheet.tx_sz;
                            const y = pos.y * spritesheet.tx_sz;
                            const w = spritesheet.tx_sz;
                            const h = spritesheet.tx_sz;
                            // overlay color
                            if(compile.overlay_color) {
                                ctx.drawImage(this.imageOverlay(img, compile.overlay_color, w, h), x, y, w, h);
                            }
                            //
                            if(compile.layers) {
                                for(let layer of compile.layers) {
                                    const layer_img = await spritesheet.loadTextureImage(layer.image);
                                    ctx.drawImage(this.imageOverlay(layer_img, layer.overlay_color, w, h), x, y, w, h);
                                }
                            }
                        }
                    }
                    block.texture[k] = [tex.pos.x, tex.pos.y];
                    // check compile rules
                    if(block.compile) {
                        const compile = block.compile;
                        if(compile.add_3pos) {
                            // add third part for texture position
                            let param = compile.add_3pos[k];
                            if(typeof param != 'undefined') {
                                block.texture[k].push(param);
                            }
                        }
                    }
                }

                // inventory icon
                if(block?.inventory?.texture) {
                    const spritesheet = this.getSpritesheet('default');
                    const value = block.inventory.texture;
                    let tex = null;
                    if(value.indexOf('|') >= 0) {
                        const pos_arr = value.split('|');
                        tex = {pos: {x: parseFloat(pos_arr[0]), y: parseFloat(pos_arr[1])}};
                    } else {
                        const img = await spritesheet.loadTextureImage(value);
                        tex = spritesheet.textures.get(value);
                        if(!tex) {
                            tex = {pos: spritesheet.findPlace(block, 1, 1)};
                            spritesheet.drawImage(img, tex.pos.x, tex.pos.y);
                        }
                    }
                    block.inventory.texture = [tex.pos.x, tex.pos.y];
                }

                // stage textures (eg. seeds)
                if(block?.stage_textures) {
                    const spritesheet = this.getSpritesheet('default');
                    for(let i in block.stage_textures) {
                        const value = block.stage_textures[i];
                        const img = await spritesheet.loadTextureImage(value);
                        let tex = spritesheet.textures.get(value);
                        if(!tex) {
                            tex = {pos: spritesheet.findPlace(block, 1, 1)};
                            spritesheet.drawImage(img, tex.pos.x, tex.pos.y);
                            spritesheet.textures.set(value, tex);
                        }
                        block.stage_textures[i] = [tex.pos.x, tex.pos.y];
                    }
                }

                // redstone textures
                if(block.redstone?.textures) {
                    const spritesheet = this.getSpritesheet('default');
                    for(let k of ['dot', 'line']) {
                        for(let i in block.redstone.textures[k]) {
                            const value = block.redstone.textures[k][i];
                            const img = await spritesheet.loadTextureImage(value);
                            let tex = spritesheet.textures.get(value);
                            if(!tex) {
                                tex = {pos: spritesheet.findPlace(block, 2, 1)};
                                spritesheet.drawImage(img, tex.pos.x, tex.pos.y, true);
                                spritesheet.textures.set(value, tex);
                            }
                            block.redstone.textures[k][i] = [tex.pos.x, tex.pos.y];
                        }
                    }
                }

                delete(block.compile);

            }
        }
    }

}