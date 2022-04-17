import {BLOCK} from '../../js/blocks.js';
// await BLOCK.init({texture_pack: 'base'});

BLOCK.COBBLESTONE = {id: 1};
BLOCK.COBBLESTONE_WALL = {id: 2};
BLOCK.OAK_FENCE = {id: 3};

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

    draw() {
        // Распечатка канваса
        // const cnv = document.getElementById('sandbox_canvas');
        // const ctx = cnv.getContext('2d');
        const scale = 4;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, this.settings.size * scale, this.settings.size * scale);
        for(var x = 0; x < this.settings.size; x++) {
            for(var z = 0; z < this.settings.size; z++) {
                const point = this.cluster.mask[z * this.settings.size + x];
                if(point) {
                    const cell = point.block_id;
                    if(cell === 8) {
                        ctx.fillStyle = "#000000";
                    } else if(cell === 2) {
                        ctx.fillStyle = "#FF000088";
                    }
                } else {
                    if((x + z) % 2 == 0) {
                        continue;
                    }
                    ctx.fillStyle = "#00000022";
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
            ctx.fillStyle = "#fff";
            ctx.fillText(`${b.x}x${b.z}`, (b.x + 1) * scale, (b.z + 1) * scale);
        }
    }

}

const sandbox = new Sandbox();
sandbox.generate();