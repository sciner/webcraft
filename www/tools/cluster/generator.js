import {BLOCK} from '../../js/blocks.js';
// await BLOCK.init({texture_pack: 'base'});

const blocks = [];
blocks.push({id: 2, name: 'GRASS_DIRT', color: '#15810e'});
blocks.push({id: 7, name: 'OAK_PLANK', color: '#725c39'});
blocks.push({id: 8, name: 'COBBLESTONE', color: '#555'});
blocks.push({id: 12, name: 'OAK_GRAVEL', color: '#535b64'});
blocks.push({id: 69, name: 'GOLD', color: '#ffff00'});
blocks.push({id: 85, name: 'OAK_FENCE', color: '#725c39'});
blocks.push({id: 98, name: 'STONE_BRICK', color: '#515151'});
blocks.push({id: 139, name: 'COBBLESTONE_WALL', color: '#555'});
blocks.push({id: 468, name: 'DIRT_PATH', color: '#746645'});
blocks.push({id: 546, name: 'POLISHED_ANDESITE', color: '#aaa'});

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

    generate(vec) {
        while(true) {
            let addr = vec ? vec : new Vector((Math.random() * 999) | 0, (Math.random() * 999) | 0);
            let tm = performance.now();
            this.cluster = new ClusterVilage(addr);
            if(this.cluster.is_empty) {
                vec = null;
            } else {
                document.getElementById('timer').innerHTML = (Math.round((performance.now() - tm) * 1000) / 1000) + ' ms';
                break;
            }
        }
        this.settings = this.cluster.schema.settings;
        this.draw();
    }

    // Распечатка канваса
    draw() {
        const scale = 4;
        ctx.fillStyle = "#ffffff";
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
        ctx.font = '10px monospace';
        ctx.textBaseline = 'top';
        const cx = this.cluster.coord.x;
        const cz = this.cluster.coord.z;
        for(let b of this.cluster.buildings.values()) {
            ctx.fillStyle = "#0000ff55";
            ctx.fillRect((b.coord.x - cx) * scale, (b.coord.z - cz) * scale, b.width * scale, b.height * scale);
            ctx.fillStyle = "#fff";
            // ctx.fillText(`${b.size.x}x${b.size.z}`, (b.coord.x - cx) * scale + 1, (b.coord.z - cz) * scale + 1);
        }
    }

}

const sandbox = globalThis.sandbox = new Sandbox();
sandbox.generate(new Vector(180, 0, 180));