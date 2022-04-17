import {BLOCK} from '../../js/blocks.js';
// await BLOCK.init({texture_pack: 'base'});

const blocks = [];
blocks.push({id: 2, name: 'COBBLESTONE', color: '#c0c0c0ff'});
blocks.push({id: 8, name: 'COBBLESTONE_WALL', color: '#a0a0a0ff'});
blocks.push({id: 468, name: 'OAK_FENCE', color: '#a39565ff'});

const colors = new Map();
for(let b of blocks) {
    BLOCK[b.name] = b;
    colors.set(b.id, b.color);
}

import {Vector} from '../../js/helpers.js';
import {ClusterVilage} from '../../js/terrain_generator/cluster/vilage.js';

let cnv = document.getElementById('sandbox_canvas');
let ctx = cnv.getContext('2d', { alpha: false });

class Sandbox {

    generate() {
        const addr = new Vector(180, 0, 180);
        this.cluster = new ClusterVilage(addr.clone());
        this.settings = this.cluster.schema.settings;
        this.draw();
    }

    // Распечатка канваса
    draw() {
        const scale = 4;
        ctx.fillStyle = "#22aa00";
        ctx.fillRect(0, 0, this.settings.size * scale, this.settings.size * scale);
        for(var x = 0; x < this.settings.size; x++) {
            for(var z = 0; z < this.settings.size; z++) {
                const point = this.cluster.mask[z * this.settings.size + x];
                if(point) {
                    const block_id = Array.isArray(point.block_id) ? point.block_id[point.block_id.length - 1] : point.block_id;
                    let c = colors.get(block_id);
                    ctx.fillStyle = c;
                    if(!c) {
                        console.log(block_id, colors.get(block_id));
                    }
                } else {
                    if((x + z) % 2 == 0) {
                        continue;
                    }
                    ctx.fillStyle = "#00000011";
                }
                ctx.fillRect(x * scale, z * scale, 1 * scale, 1 * scale);
            }
        }
        //
        ctx.font = '12px Arial';
        ctx.textBaseline = 'top';
        for(let b of this.cluster.schema.house_list.values()) {
            ctx.fillStyle = "#0000ff55";
            ctx.fillRect(b.x * scale, b.z * scale, b.width * scale, b.height * scale);
            // ctx.fillStyle = "#fff";
            // ctx.fillText(`${b.x}x${b.z}`, (b.x + 1) * scale, (b.z + 1) * scale);
        }
    }

}

const sandbox = new Sandbox();
sandbox.generate();