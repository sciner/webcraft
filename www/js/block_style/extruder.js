import {MULTIPLY, DIRECTION, QUAD_FLAGS, Color, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {default as push_cube_style, pushTransformed} from '../block_style/cube.js';
import {impl as alea} from "../../vendors/alea";

// const {mat4} = glMatrix;
const {mat3, mat4} = glMatrix;

const push_cube = push_cube_style.getRegInfo().func;

class FakeTBlock {

    constructor(id) {this.id = id;}

    get material() {
        return BLOCK.BLOCK_BY_ID.get(this.id);
    }

    get properties() {
        return this.material;
    }

    get extra_data() {
        return this.material.extra_data;
    }

    hasTag(tag) {
        let mat = this.material;
        return mat.tags && mat.tags.indexOf(tag) >= 0;
    }

    getCardinalDirection() {
        return 0;
    }

}

// World
class FakeCloudWorld {

    constructor() {
        let that = this;
        this.blocks_pushed = 0;
        // clouds
        this.clouds = {
            size: new Vector(128, 128, 1),
            blocks: Array(256).fill(null).map(el => Array(256).fill(null)),
            init: function(block_id, tex, tex_x, tex_y, tex_w, tex_h) {
                this.size.set(tex_w + 2, tex_h + 2, 1)
                for(let x = 0; x < tex_w; x++) {
                    for(let y = 0; y < tex_h; y++) {
                        let index = ((y + tex_y) * tex.width + (x + tex_x)) * 4;
                        let is_opaque = tex.imageData.data[index + 3] > 10;
                        if(is_opaque) {
                            this.blocks[x + 1][y + 1] = new FakeTBlock(block_id);
                        }
                    }
                }
            }
        };
        // chunkManager
        this.chunkManager = {
            getBlock: function(x, y, z) {
                if(z == 0) {
                    if(x >= 0 && x < that.clouds.size.x) {
                        if(y >= 0 && y < that.clouds.size.y) {
                            let resp = that.clouds.blocks[x][y]
                            if(resp) {
                                return resp;
                            }
                        }
                    }
                }
                return new FakeTBlock(BLOCK.AIR.id);
            }
        };
    }

}

// Экструдированные блоки
export default class style {

    static lm = new Color();

    static getRegInfo() {
        return {
            styles: ['extruder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, _x, _y, _z, neighbours, biome) {

        let material = block.material;
        let resource_pack = material.resource_pack;

        let texture_id = 'default';
        if(typeof material.texture == 'object' && 'id' in material.texture) {
            texture_id = material.texture.id;
        }

        let tex = resource_pack.textures.get(texture_id);
        const TX_CNT = tex.tx_cnt;

        // let imageData = tex.imageData;
        let c = BLOCK.calcTexture(material.texture, DIRECTION.UP, TX_CNT);
        let world = new FakeCloudWorld();
        let tex_x = Math.round((c[0] - .5 / tex.tx_cnt) * tex.width);
        let tex_y = Math.round((c[1] - .5 / tex.tx_cnt) * tex.height);
        let tex_w = Math.round(c[2] * tex.width);
        let tex_h = Math.round(c[3] * tex.height);
        world.clouds.init(block.id, tex, tex_x, tex_y, tex_w, tex_h);

        //
        neighbours  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        };
        //
        let clouds = world.clouds;

        const MUL               = 2; // Масштабирование получившейся фигуры
        const SCALE_FACTOR      = tex_w / MUL; // Сколько кубов умещается в 1-м
        const TEX_WIDTH_HALF    = tex_w / 2 * MUL;
        let matrix              = mat3.create();
        let scale               = new Vector(1, 1, tex_w / 32).divScalar(SCALE_FACTOR);
        mat4.scale(matrix, matrix, scale.toArray());

        // Size of one texture pixel
        const ts = tex.width / tex.tx_cnt;

        let force_tex = [
            c[0],
            c[1],
            c[2] / ts,
            c[3] / ts
        ];

        let lm = MULTIPLY.COLOR.WHITE;
        let z = -0.5 - 0.5 / SCALE_FACTOR;
        let flags = 0;

        for(let x = 0; x < clouds.size.x; x++) {
            for(let y = 0; y < clouds.size.y; y++) {
                let block  = world.chunkManager.getBlock(x, y, 0);
                if(block.id > 0) {
                    neighbours.DOWN = world.chunkManager.getBlock(x, y + 1, 0);
                    neighbours.UP = world.chunkManager.getBlock(x, y - 1, 0);
                    neighbours.WEST = world.chunkManager.getBlock(x - 1, y, 0);
                    neighbours.EAST = world.chunkManager.getBlock(x + 1, y, 0);
                    // Position of each texture pixel
                    force_tex[0] = (c[0] - 0.5 / tex.tx_cnt + force_tex[2] / 2) + (x - 1) / tex.tx_cnt / ts;
                    force_tex[1] = (c[1] - 0.5 / tex.tx_cnt + force_tex[3] / 2) + (y - 1) / tex.tx_cnt / ts;
                    let c = force_tex;

                    // inline cube drawing

                    let x1 = 0.5 + (x - TEX_WIDTH_HALF) / SCALE_FACTOR
                    let y1 = (y - TEX_WIDTH_HALF) / SCALE_FACTOR - 1.5
                    let z1 = z;
                    let height = 1.0;
                    let width = 1.0;

                    if(!neighbours.UP.id) {
                        pushTransformed(
                            vertices, matrix, undefined,
                            x1, z1, y1,
                            .5, 0.5, height,
                            1, 0, 0,
                            0, 1, 0,
                            c[0], c[1], -c[2], c[3],
                            lm.r, lm.g, lm.b, flags
                        );
                    }

                    // Bottom
                    if(canDrawFace(neighbours.DOWN)) {
                        pushTransformed(
                            vertices, matrix, undefined,
                            x1, z1, y1,
                            0.5, 0.5, 0,
                            1, 0, 0,
                            0, -1, 0,
                            c[0], c[1], -c[2], c[3],
                            lm.r, lm.g, lm.b, flags);
                    }

                    // West
                    if(!neighbours.WEST.id) {
                        pushTransformed(
                            vertices, matrix, undefined,
                            x1, z1, y1,
                            .5 - width / 2, .5, height / 2,
                            0, 1, 0,
                            0, 0, -height,
                            c[0], c[1], -c[2], c[3],
                            lm.r, lm.g, lm.b, flags);
                    }

                    // East
                    if(!neighbours.EAST.id) {
                        pushTransformed(
                            vertices, matrix, undefined,
                            x1, z1, y1,
                            .5 + width / 2, .5, height / 2,
                            0, 1, 0,
                            0, 0, height,
                            c[0], c[1], c[2], -c[3],
                            lm.r, lm.g, lm.b, flags);
                    }
                }
            }
        }

    }

}