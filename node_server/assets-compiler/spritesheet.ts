import skiaCanvas from 'skia-canvas';
import fs from 'fs';
import { generateNormalMap } from './normalmap.js';
import { Spritesheet_Base } from '../../www/src/core/spritesheet_base.js';

//
export const DEFAULT_TEXTURE_SUFFIXES = [
    {
        key: 'n',
        generator(texture) {
            // Try to generate normalmap texture
            const canvas = new skiaCanvas.Canvas(texture.width, texture.height);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(texture, 0, 0);
            return generateNormalMap(canvas, texture.width, texture.height)
        }
    },
    {
        key: 's',
        empty: await skiaCanvas.loadImage('./textures/empty_s.png'),
        generator(texture) {
            // Try to generate normalmap texture
            const canvas = new skiaCanvas.Canvas(texture.width, texture.height);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.empty, 0, 0, this.empty.width, this.empty.height, 0, 0, texture.width, texture.height)
            return canvas
        }
    }
]

// Spritesheet
export class Spritesheet extends Spritesheet_Base {

    createCanvas(width : int, height : int) : any {
        return new skiaCanvas.Canvas(width, height)
    }

    async loadImage(source) : Promise<any> {
        return skiaCanvas.loadImage(source)
    }

    // Export to PNG
    export() {
        const resp = [];
        if(this.index == 0) {
            return resp;
        }
        for(const [subtexture_id, item] of this.canvases) {
            const dir = `${this.options.output_dir}/textures`;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            const filename = `/textures/${this.id}${subtexture_id}.png`;
            resp.push(filename);
            item.cnv.saveAsSync(`${this.options.output_dir}${filename}`);
        }
        return resp;
    }

}