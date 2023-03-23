import {BLOCK} from '../../js/blocks.js';
await BLOCK.init({
    texture_pack: 'base',
    json_url: '../../data/block_style.json',
    resource_packs_url: '../../data/resource_packs.json'
});

const blocks = BLOCK.getAll();

BLOCK.GRASS_BLOCK.color = '#15810e';
BLOCK.OAK_PLANKS.color = '#725c39';
BLOCK.COBBLESTONE.color = '#555';
BLOCK.GRAVEL.color = '#535b64';
BLOCK.TORCH.color = '#552';
BLOCK.CHEST.color = '#552';
BLOCK.CRAFTING_TABLE.color = '#cc8';
BLOCK.GOLD_BLOCK.color = '#ffff00';
BLOCK.OAK_FENCE.color = '#725c39';
BLOCK.STONE_BRICKS.color = '#515151';
BLOCK.SPRUCE_STAIRS.color = '#846645';
BLOCK.COBBLESTONE_WALL.color = '#555';
BLOCK.SPRUCE_FENCE.color = '#846645';
BLOCK.SPRUCE_PLANKS.color = '#846645';
BLOCK.SPRUCE_SLAB.color = '#846645';
BLOCK.SPRUCE_TRAPDOOR.color = '#846645';
BLOCK.DIRT_PATH.color = '#746645';
BLOCK.POLISHED_ANDESITE.color = '#aaa';
BLOCK.LANTERN.color = '#aaa';
BLOCK.HAY_BLOCK.color = '#fc0';
BLOCK.STONE.color = '#ccc';
BLOCK.ANDESITE.color = '#bbb';

const colors = new Map();
for(let b of blocks) {
    BLOCK[b.name] = b;
    colors.set(b.id, b.color);
}

import {Vector} from '../../js/helpers.js';
import {ClusterVilage} from '../../js/terrain_generator/cluster/vilage.js';
import {BuildingTemplate} from '../../js/terrain_generator/cluster/building_template.js';
import {API_Client} from '../../js/ui/api.js';
import { ClusterManager, CLUSTER_SIZE_V2 } from '../../js/terrain_generator/cluster/manager.js';

const api = new API_Client()

async function loadSchemas(callback) {
    const form = {}
    await api.call(this, '/api/Game/loadSchemas', form, (result) => {
        if(callback) {
            callback(result);
        }
    }, (e) => {
        debugger
    });
}

await loadSchemas((r) => {
    for(let schema of r) {
        BuildingTemplate.addSchema(schema)
    }
})

//
const WORLD_SEED = 1740540541
// const START_CLUSTER_ADDR = new Vector(3709, 0, 1617)
const START_CLUSTER_ADDR = new Vector(3707, 0, 1619)
const DRAW_SCALE = 6

//
const cnv = document.getElementById('sandbox_canvas');
const ctx = cnv.getContext('2d', { alpha: false });

const cm = new ClusterManager(null, WORLD_SEED, 2)

class Sandbox {

    generate(vec) {
        let attempts = 0
        while(true) {
            attempts++
            const tm = performance.now()
            const coord = vec ? vec : new Vector(Math.random() * 999999, 0, Math.random() * 999999).floored()
            this.cluster = cm.getForCoord(coord, {})
            cnv.width = this.cluster.size.x * DRAW_SCALE
            cnv.height = this.cluster.size.z * DRAW_SCALE
            // this.cluster = new ClusterVilage({seed: WORLD_SEED, version: 2, size: new Vector(256, 256, 256)}, addr);
            if(this.cluster.is_empty || !(this.cluster instanceof ClusterVilage)) {
                vec = null
            } else {
                let text = (Math.round((performance.now() - tm) * 1000) / 1000) + ` ms`
                text += `<br>attempts: ${attempts}`
                text += `<br>addr: ${this.cluster.addr.toHash()}`
                text += `<br>coord: ${this.cluster.coord.clone().addScalarSelf(this.cluster.size.x/2, 0, this.cluster.size.z/2).toHash()}`
                document.getElementById('timer').innerHTML = text
                break
            }
        }
        this.settings = this.cluster.schema.settings
        this.draw()
    }

    // Распечатка канваса
    draw() {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, this.settings.size * DRAW_SCALE, this.settings.size * DRAW_SCALE);
        // near mask
        let max_dist = this.cluster.max_dist;
        for(var x = 0; x < this.settings.size; x++) {
            for(var z = 0; z < this.settings.size; z++) {
                const dist = this.cluster.near_mask[z * this.settings.size + x];
                ctx.fillStyle = "rgba(255,15,0," + (1-Math.round(dist/max_dist*100)/100) + ")";
                ctx.fillRect(z * DRAW_SCALE, x * DRAW_SCALE, 1 * DRAW_SCALE, 1 * DRAW_SCALE);
            }
        }
        //
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
                ctx.fillRect(z * DRAW_SCALE, x * DRAW_SCALE, 1 * DRAW_SCALE, 1 * DRAW_SCALE);
            }
        }
        //
        ctx.font = '10px monospace';
        ctx.textBaseline = 'top';
        const cx = this.cluster.coord.x;
        const cz = this.cluster.coord.z;
        for(let b of this.cluster.buildings.values()) {
            ctx.fillStyle = "#0000ff55";
            ctx.fillRect((b.coord.z - cz) * DRAW_SCALE, (b.coord.x - cx) * DRAW_SCALE, b.size.z * DRAW_SCALE, b.size.x * DRAW_SCALE);
            ctx.fillStyle = "#0000ffff";
            ctx.fillRect((b.entrance.z - cz) * DRAW_SCALE, (b.entrance.x - cx) * DRAW_SCALE, 1 * DRAW_SCALE, 1 * DRAW_SCALE);
            //
            if(b.building_template?.right) {
                ctx.fillStyle = "#00000055";
                ctx.fillRect((b.coord.z - cz + 1) * DRAW_SCALE, (b.coord.x - cx + 1) * DRAW_SCALE, (b.size.z - 2) * DRAW_SCALE, (b.size.x - 2) * DRAW_SCALE);
            }
            //
            ctx.fillStyle = "#fff";
            const right = b.building_template?.right ? ' R' : '';
            const label = `${b.size.x}x${b.size.z}${right}`;
            ctx.fillText(label, (b.coord.z - cz) * DRAW_SCALE + 1, (b.coord.x - cx) * DRAW_SCALE + 1);
        }
    }

}

const sandbox = globalThis.sandbox = new Sandbox();
sandbox.generate(START_CLUSTER_ADDR.mul(CLUSTER_SIZE_V2));