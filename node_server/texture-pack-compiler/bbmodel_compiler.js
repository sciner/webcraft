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

    createSpritesheet(id, tx_cnt, resolution, options) {
        return new Spritesheet(id, tx_cnt, resolution, options);
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
            /*
            const model = (await import(`${this.options.model_dir}/${item.name}.bbmodel`, {
                assert: { type: 'json' }
            })).default;
            */
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
     * 
     * @param {Compiler} compiler 
     */
    async run(compiler) {

        for(const [id, model] of this.models.entries()) {

            console.log(`BBModel ... ${id}`, model.elements.length);

            if('textures' in model) {

                const {spritesheet} = await this.prepareModel(model, id, this.options)

                //
                const filenames = spritesheet.export();
                if(filenames.length > 0) {
                    model.texture_id = filenames[0];
                    this.conf.textures[id] = {
                        image: model.texture_id,
                        tx_cnt: 1
                    };
                }

            }
            delete(model.textures);
            fs.writeFileSync(`${this.options.output_dir}/${id}.json`, JSON.stringify(model));
        }
        const blocks = await compiler.compileBlocks(this.conf.blocks)
        fs.writeFileSync(`${this.options.output_dir}/blocks.json`, JSON.stringify(blocks, null, 4));
        delete(this.conf.blocks);
        fs.writeFileSync(`${this.options.output_dir}/conf.json`, JSON.stringify(this.conf, null, 4));
    }

}