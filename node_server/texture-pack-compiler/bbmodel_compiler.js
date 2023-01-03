import { Spritesheet } from "./spritesheet.js";

import skiaCanvas from 'skia-canvas';
import fs from 'fs';
import { Compiler } from "./compiler.js";
import { BBModel_Compiler_Base } from "../../www/js/bbmodel/compiler_base.js";

export class BBModel_Compiler extends BBModel_Compiler_Base {

    constructor(options) {
        super(options)
        this.models = new Map();
    }

    createSpritesheet(tx_cnt, resolution, options) {
        const id = 'bbmodel_texture_' + new String(this.spritesheets.length + 1)
        const spritesheet = new Spritesheet(id, tx_cnt, resolution, options)
        this.spritesheets.push(spritesheet)
        return spritesheet
    }

    //
    async init() {
        this.conf = (await import(this.options.conf, {
            assert: { type: 'json' }
        })).default;
        //
        const list = [];
        for(let bb of this.conf.bbmodels) {
            const path = `${this.options.model_dir}/${bb.name}.bbmodel`;
            if (!fs.existsSync(path)) {
                console.error(`BBModel file not found ${path}`);
                continue;
            }
            const model = JSON.parse(fs.readFileSync(path));
            model._properties = {
                shift: bb.shift
            }
            this.models.set(bb.name, model);
            list.push(bb);
        }
        this.conf.bbmodels = list;
    }

    async loadImage(source) {
        return skiaCanvas.loadImage(source)
    }

    /**
     * @param {Compiler} compiler 
     */
    async run(compiler) {

        for(const [id, model] of this.models.entries()) {

            console.log(`BBModel ... ${id}`, model.elements.length);

            if('textures' in model) {
                const {spritesheet, places} = await this.prepareModel(model, id, this.options)
                model._properties.texture_id = spritesheet.id
                model._properties.places = places
            }

            delete(model.textures);
            fs.writeFileSync(`${this.options.output_dir}/${id}.json`, JSON.stringify(model))

        }

        for(const spritesheet of this.spritesheets) {
            const filenames = spritesheet.export()
            if(filenames.length > 0) {
                this.conf.textures[spritesheet.id] = {
                    image: filenames[0],
                    tx_cnt: this.options.tx_cnt
                };
            }
        }

        if(this.conf.blocks) {

            // fill "texture" property
            for(let block of this.conf.blocks) {
                if(!block.bb) {
                    throw `error_block_must_contain_bb|${block.name}`
                }
                const model = this.models.get(block.bb.model)
                if(!model) {
                    throw `error_block_model_not_found|${block.name}`
                }
                const first_place = model._properties.places[0]
                block.texture = {
                    id: model._properties.texture_id,
                    side: `${first_place.x}|${first_place.y}`
                }
            }

        }

        // compile blocks
        const blocks = this.conf.blocks ? await compiler.compileBlocks(this.conf.blocks) : []

        fs.writeFileSync(`${this.options.output_dir}/blocks.json`, JSON.stringify(blocks, null, 4));
        delete(this.conf.blocks);
        fs.writeFileSync(`${this.options.output_dir}/conf.json`, JSON.stringify(this.conf, null, 4));

    }

}