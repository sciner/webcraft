export class Spritesheet_Base {
    [key: string]: any;

    constructor(id, tx_cnt, tx_sz, options) {
        this.id                 = id;
        this.tx_cnt             = tx_cnt;
        this.tx_sz              = tx_sz;
        this.width              = tx_cnt * tx_sz;
        this.height             = tx_cnt * tx_sz;
        this.options            = options;
        this.index              = 0;
        this.map                = new Array(this.tx_cnt * this.tx_cnt);
        this.textures           = new Map();
        this.canvases           = new Map();
    }

    get ctx() {
        return this.getCtx('');
    }

    createCanvas(width, height) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        return canvas
    }

    async loadImage(source) {
        throw 'error_not_implemented';
    }

    //
    getCtx(id) {
        id = id ? id : '';
        let item = this.canvases.get(id);
        if(!item) {
            const sz = this.tx_sz * this.tx_cnt;
            item = {
                cnv: this.createCanvas(sz, sz)
            };
            item.ctx = item.cnv.getContext('2d');
            item.ctx.imageSmoothingEnabled = false;
            //
            if(id == this.options.n_texture_id) {
                item.ctx.fillStyle = this.options.n_color;
                item.ctx.fillRect(0, 0, sz, sz);
            }
            this.canvases.set(id, item);
        }
        return item.ctx;
    }

    // indexToXY
    indexToXY(x, y) {
        return  {
            x: this.index % this.tx_cnt,
            y: Math.floor(this.index / this.tx_cnt)
        };
    }

    // XYToIndex
    XYToIndex(x, y) {
        return y * this.tx_cnt + x;
    }

    /**
     * Load textures
     * @param {string} value 
     * @param {object[]} suffixes 
     * @returns 
     */
    async loadTex(value, suffixes = []) {
        const resp = {
            texture: await this._loadImageCanvas(value)
        }
        if(suffixes) {
            for(let suffix of suffixes) {
                const key = suffix.key
                resp[key] = null
                try {
                    resp[key] = await this._loadImageCanvas(value.replace('.png', `_${key}.png`));
                } catch(e) {
                    resp[key] = suffix.generator(resp.texture)
                }
            }
        }
        return resp;
    }

    //
    async _loadImageCanvas(value) {
        let temp = [];
        let resp;
        let err = null;
        //
        for(let i = 0; i < this.options.texture_pack_dir.length; i++) {
            const dir = this.options.texture_pack_dir[i];
            let fn = (value.indexOf('.') == 0 ? '' : dir + '/') + value;
            temp = fn.split(';');
            fn = temp.shift();
            try {
                resp = await this.loadImage(fn);
                break;
            } catch(e) {
                err = e;
            }
        }
        //
        if(!resp) {
            throw err || 'error_texture_not_found';
        }
        //
        for(let inst of temp) {
            switch(inst) {
                case 'rc1': {
                    // turn counterclockwise 1 time
                    const cnv = this.createCanvas(resp.width, resp.height);
                    const ctx = cnv.getContext('2d');
                    ctx.save();
                    ctx.translate(resp.width / 2, resp.height / 2); // change origin
                    ctx.rotate(-Math.PI / 2);
                    ctx.translate(-resp.width / 2, -resp.height / 2);
                    ctx.drawImage(resp, 0, 0);
                    ctx.restore();
                    resp = cnv;
                    break;
                }
            }
        }
        return resp;
    }

    // drawTexture
    async drawTexture(img, x, y, has_mask, globalCompositeOperation = null, overlay_mask = null, subtexture_id, compile_rules) {
        const ctx = this.getCtx(subtexture_id);
        if(globalCompositeOperation) {
            ctx.globalCompositeOperation = globalCompositeOperation;
        }
        const sw = Math.max(img.width, this.tx_sz);
        const sh = Math.max(img.height, this.tx_sz);
        const mask_width = sw / this.tx_sz;
        const use_filter = !!compile_rules?.filter;
        // if using filter
        if(use_filter) {
            const fcanvas = this.createCanvas(img.width, img.height);
            const fctx = fcanvas.getContext('2d');
            fctx.imageSmoothingEnabled = false;
            fctx.filter = compile_rules.filter;
            fctx.drawImage(img, 0, 0, img.width, img.height);
            img = fcanvas;
        }
        ctx.drawImage(img, x * this.tx_sz, y * this.tx_sz, sw, sh);
        if(has_mask) {
            if(overlay_mask) {
                ctx.globalCompositeOperation = 'difference';
                ctx.drawImage(img, x * this.tx_sz, y * this.tx_sz, sw, sh);
                ctx.globalCompositeOperation = 'source-over';
                overlay_mask = (await this.loadTex(overlay_mask, [])).texture;
                ctx.drawImage(overlay_mask, (x + 1) * this.tx_sz, y * this.tx_sz, sw, sh);
            } else {
                ctx.globalCompositeOperation = 'difference';
                ctx.drawImage(img, x * this.tx_sz, y * this.tx_sz, sw, sh);
                ctx.filter = 'grayscale(100%)';
                ctx.drawImage(img, (x + mask_width) * this.tx_sz, y * this.tx_sz, sw, sh);
                ctx.filter = 'none';
                ctx.globalCompositeOperation = 'source-over';
                // copy colores pixels
                /*
                const pixs = ctx.getImageData((x + 1) * this.tx_sz, y * this.tx_sz, this.tx_sz, this.tx_sz).data;
                let pix_index = 0;
                for(let j = 0; j < this.tx_sz; j++) {
                    for(let i = 0; i < this.tx_sz; i++) {
                        const ax = x * this.tx_sz + i;
                        const ay = y * this.tx_sz + j;
                        let hsl = this.RGBToHSL(pixs[pix_index + 0], pixs[pix_index + 1], pixs[pix_index + 2]);
                        if(hsl[1] > 40) {
                            // copy color
                            ctx.fillStyle = this.rgbaToHex(pixs[pix_index + 0], pixs[pix_index + 1], pixs[pix_index + 2], pixs[pix_index + 3]);
                            ctx.fillRect(ax, ay, 1, 1);
                            ctx.fillStyle = '#000000';
                            ctx.fillRect(ax + this.tx_sz, ay, 1, 1);
                        }
                        pix_index += 4;
                    }
                }*/
            }
        }
        const sx = Math.ceil(img.width / this.tx_sz);
        const sy = Math.ceil(img.height / this.tx_sz);
        //
        for(let i = 0; i < sx; i++) {
            for(let j = 0; j < sy; j++) {
                const index = this.XYToIndex(x + i, y + j);
                this.map[index] = true;
            }                        
        }
        // 
        if(overlay_mask || has_mask) {
            for(let i = 0; i < sx; i++) {
                for(let j = 0; j < sy; j++) {
                    const index = this.XYToIndex(x + i + mask_width, y + j);
                    this.map[index] = true;
                }                        
            }
        }
        return {x, y, sx, sy};
    }

    // findPlace
    findPlace(block, sx, sy) {
        const TEX_SLOTS_COUNT = this.tx_cnt * this.tx_cnt
        let good_place = false;
        this.index = 0;
        while(!good_place) {
            good_place = true;
            const {x, y} = this.indexToXY(this.index);
            for(let i = 0; i < sx; i++) {
                for(let j = 0; j < sy; j++) {
                    if(x + i >= this.tx_cnt || y + j >= this.tx_cnt) {
                        good_place = false;
                        break;
                    }
                    const index = this.XYToIndex(x + i, y + j);
                    if(this.map[index]) {
                        good_place = false;
                        break;
                    }
                }                        
            }
            //
            if(good_place) {
                for(let i = 0; i < sx; i++) {
                    for(let j = 0; j < sy; j++) {
                        const index = this.XYToIndex(x + i, y + j);
                        this.map[index] = block;
                    }                        
                }
                this.index += sx;
                return {x, y};
            } else {
                this.index++;
            }
            //
            if(x == this.tx_cnt - 1 && y == this.tx_cnt - 1 || this.index >= TEX_SLOTS_COUNT) {
                console.log(this.tx_cnt, TEX_SLOTS_COUNT, this.id)
                throw 'error_no_place';
            }
        }
    }

    clearMapPlaces(places) {
        for(let place of places) {
            const {x, y, width, height} = place
            for(let i = 0; i < width; i++) {
                for(let j = 0; j < height; j++) {
                    const index = this.XYToIndex(x + i, y + j);
                    this.map[index] = null
                }
            }
        }
    }

    RGBToHSL(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const l = Math.max(r, g, b);
        const s = l - Math.min(r, g, b);
        const h = s
            ? l === r
                ? (g - b) / s
                : l === g
                    ? 2 + (b - r) / s
                    : 4 + (r - g) / s
            : 0;
        return [
            60 * h < 0 ? 60 * h + 360 : 60 * h,
            100 * (s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0),
            (100 * (2 * l - s)) / 2,
        ];
    }

    rgbaToHex(r, g, b, a) {
        function componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(a);
    }

}