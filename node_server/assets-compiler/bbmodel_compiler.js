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

    createSpritesheet(tx_cnt, resolution, options, id) {
        id = id ?? ('bbmodel_texture_' + new String(this.spritesheets.length + 1))
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
        // const list = [];
        for(let bb of this.conf.bbmodels) {
            const path = `${this.options.model_dir}/${bb.name}.bbmodel`;
            if (!fs.existsSync(path)) {
                console.error(`BBModel file not found ${path}`);
                continue;
            }
            const model_json = JSON.parse(fs.readFileSync(path));
            model_json._properties = {
                shift: bb.shift
            }
            bb.json = model_json
            this.models.set(bb.name, model_json)
            // list.push(bb);
        }
        // this.conf.bbmodels = list;
    }

    async loadImage(source) {
        return skiaCanvas.loadImage(source)
    }

    /**
     * @param {Compiler} compiler 
     */
    async run(compiler) {

        // Compile bbmodels
        for(let bbmodel of this.conf.bbmodels) {
            const model_json = bbmodel.json
            const id = bbmodel.name
            if('textures' in model_json) {
                const {spritesheet, places} = await this.prepareModel(model_json, id, this.options)
                model_json._properties.texture_id = spritesheet.id
                model_json._properties.places = places
            }
            console.log(`BBModel ... ${id} ${model_json.elements.length} elements (${model_json.polygons} polygons)`)
            delete(model_json.textures);
            // fs.writeFileSync(`${this.options.output_dir}/${id}.json`, JSON.stringify(model_json))
        }

        // Make blocks list
        const blocks = []
        if(this.conf.blocks) {
            // fill "texture" property
            for(let block of this.conf.blocks) {
                if(!('id' in block)) {
                    continue
                }
                if(!block.bb) {
                    throw `error_block_must_contain_bb|${block.name}`
                }
                //
                block.style = block.style ?? 'bbmodel'
                block.inventory = block.inventory ?? {
                    'style': 'bbmodel'
                }
                if(block.bb.rotate && !Array.isArray(block.bb.rotate)) {
                    block.bb.rotate = [block.bb.rotate]
                }
                //
                const model = this.models.get(block.bb.model)
                if(!model) {
                    throw `error_block_model_not_found|${block.name}`
                }
                const first_place = model._properties.places[0]
                block.texture = {
                    id: model._properties.texture_id,
                    side: `${first_place.x}|${first_place.y}`
                }
                blocks.push(block)
            }
        }

        // Compile blocks
        fs.writeFileSync(`${this.options.output_dir}/blocks.json`, JSON.stringify(await compiler.compileBlocks(blocks, this), null, 4))
        delete(this.conf.blocks)

        // Export spritesheets
        for(const spritesheet of this.spritesheets) {
            const filenames = spritesheet.export()
            if(filenames.length > 0) {
                this.conf.textures[spritesheet.id] = {
                    image: filenames[0],
                    tx_cnt: this.options.tx_cnt
                };
            }
        }

        // Export conf.json
        fs.writeFileSync(`${this.options.output_dir}/conf.json`, JSON.stringify(this.conf));

    }

}