import glMatrix from '@vendors/gl-matrix-3.3.min.js';
import {Enchantments} from "../enchantments.js";

const {mat3, vec3} = glMatrix;

const length5 = (a) => {
    let x = .5 - fract(a[0]);
    let y = .5 - fract(a[1]);
    let z = .5 - fract(a[2]);
    // return Math.sqrt(x * x + y * y + z * z)
    return (x * x + y * y + z * z)
}
const fract = (a) => (a - Math.floor(a))
const min = Math.min
const pow = Math.pow

export class EnchantShaderNoise {
    [key: string]: any;

    constructor() {
        this.m = mat3.clone([-2, -1, 2, 3, -2, 1, 1, 2, 2]);
        //mat3.transpose(this.m, this.m);
        this.a = vec3.create();
        this.b = vec3.create();
        this.c1 = vec3.create();
    }

    apply(out, offset1, input, offset2, px, py, u_time) {

        px += u_time / 1000
        py += u_time / 1000

        px *= 200 / 32
        py *= 200 / 32

        const {a, b, c1, m} = this;

        a[0] = px / 4e2;
        a[1] = py / 4e2;
        a[2] = (u_time / 1000) / 4 // % 1.0;

        vec3.transformMat3(a, a, m);
        vec3.transformMat3(b, a, m);
        vec3.transformMat3(c1, b, m);
        b[0] *= .4;
        b[1] *= .4;
        b[2] *= .4;
        c1[0] *= .3;
        c1[1] *= .3;
        c1[2] *= .3;

        let k = pow(Math.sqrt(min(length5(a), length5(b), length5(c1))), 7.) * 25.
        out[offset1 + 0] = input[offset2 + 0] + Math.round(k * 1.5 * 255.0)
        out[offset1 + 2] = input[offset2 + 2] + Math.round(k * 6. * 255.0)

    }

    processEnchantedIcon(slot, item, image, icon) {

        // если зачарования не имеют визуальный эффект
        if(!Enchantments.getVisualEffect(item)) {
            return image
        }

        if(slot.item_prev != item) {

            // TODO: clear prev data from this.item_canvas
            slot.item_prev = item

            const scnv = document.createElement('canvas')
            scnv.width = icon.width
            scnv.height = icon.height
            const sctx = scnv.getContext('2d')

            const scnv2 = document.createElement('canvas')
            scnv2.width = icon.width
            scnv2.height = icon.height
            const sctx2 = scnv2.getContext('2d')
            sctx2.drawImage(image, icon.x, icon.y, icon.width, icon.height, 0, 0, icon.width, icon.height)

            const imageData = sctx2.getImageData(0, 0, icon.width, icon.height)
            const orig_pixels_data = Array.from(imageData.data)

            slot.item_canvas = {
                scnv,
                sctx,
                scnv2,
                sctx2,
                imageData,
                orig_pixels_data
            }

        }

        const imageData = slot.item_canvas.imageData
        const orig_pixels_data = slot.item_canvas.orig_pixels_data

        // Copy result to source
        const pixs = imageData.data
        let idx = 0
        const pn = performance.now()
        for(let px = 0; px < icon.width; px++) {
            for(let py = 0; py < icon.height; py++) {
                if(orig_pixels_data[idx + 3] > 0) {
                    this.apply(pixs, idx, orig_pixels_data, idx, px + slot.x, py + slot.y, pn)
                }
                idx += 4
            }
        }

        slot.item_canvas.sctx.putImageData(imageData, 0, 0)
        icon.x = 0
        icon.y = 0

        return slot.item_canvas.scnv

    }

}