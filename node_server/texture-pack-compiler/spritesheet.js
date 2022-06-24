import skiaCanvas from 'skia-canvas';

// Spritesheet
export class Spritesheet {

    constructor(id, tx_cnt, tx_sz, textures_dir) {
        this.id                 = id;
        this.tx_cnt             = tx_cnt;
        this.tx_sz              = tx_sz;
        this.textures_dir       = textures_dir;
        this.index              = 0;
        this.map                = new Array(this.tx_cnt * this.tx_cnt);
        this.textures           = new Map();
        this.cnv                = new skiaCanvas.Canvas(this.tx_sz * this.tx_cnt, this.tx_sz * this.tx_cnt);
        this.ctx                = this.cnv.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
    }

    // Export to PNG
    export() {
        if(this.index == 0) {
            return false;
        }
        this.cnv.saveAsSync(`../../www/resource_packs/base/textures/${this.id}.png`);
        return true;
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

    // loadTextureImage
    async loadTextureImage(value) {
        let fn = (value.indexOf('.') == 0 ? '' : this.textures_dir + '/') + value;
        let temp = fn.split(';');
        fn = temp.shift();
        let resp = await skiaCanvas.loadImage(fn);
        for(let inst of temp) {
            switch(inst) {
                case 'rc1': {
                    // turn counterclockwise 1 time
                    let cnv = new skiaCanvas.Canvas(resp.width, resp.height);
                    let ctx = cnv.getContext('2d');
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

    // drawImage
    drawImage(img, x, y, has_mask, globalCompositeOperation = null) {
        if(globalCompositeOperation) {
            this.ctx.globalCompositeOperation = globalCompositeOperation;
        }
        const sw = Math.max(img.width, this.tx_sz);
        const sh = Math.max(img.height, this.tx_sz);
        this.ctx.drawImage(img, x * this.tx_sz, y * this.tx_sz, sw, sh);
        if(has_mask) {
            this.ctx.globalCompositeOperation = 'difference';
            this.ctx.drawImage(img, x * this.tx_sz, y * this.tx_sz, sw, sh);
            this.ctx.drawImage(img, (x + 1) * this.tx_sz, y * this.tx_sz, sw, sh);
            this.ctx.globalCompositeOperation = 'source-over';
        }
        const sx = Math.ceil(img.width / this.tx_sz);
        const sy = Math.ceil(img.height / this.tx_sz);
        for(let i = 0; i < sx; i++) {
            for(let j = 0; j < sy; j++) {
                const index = this.XYToIndex(x + i, y + j);
                this.map[index] = true;
            }                        
        }
    }

    // findPlace
    findPlace(block, sx, sy) {
        let good_place = false;
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
            if(x == this.tx_cnt - 1 && y == this.tx_cnt - 1) {
                throw 'error_no_place';
            }
        }
    }

}