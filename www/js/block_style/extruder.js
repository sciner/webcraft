import {IndexedColor, DIRECTION, Color, Vector, QUAD_FLAGS} from '../helpers.js';
import {BLOCK} from "../blocks.js";

const {mat3, mat4} = glMatrix;

const defaultPivot = [0.5, 0.5, 0.5];
const defaultMatrix = mat3.create();
const tempMatrix = mat3.create();

export function pushTransformed(
    vertices, mat, pivot,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    pp, flags
) {
    pivot = pivot || defaultPivot;
    cx += pivot[0];
    cy += pivot[1];
    cz += pivot[2];
    x0 -= pivot[0];
    y0 -= pivot[1];
    z0 -= pivot[2];

    mat = mat || defaultMatrix;

    let tx = 0;
    let ty = 0;
    let tz = 0;

    // unroll mat4 matrix to mat3 + tx, ty, tz
    if (mat.length === 16) {
        mat3.fromMat4(tempMatrix, mat);

        tx = mat[12];
        ty = mat[14]; // flip
        tz = mat[13]; // flip

        mat = tempMatrix;
    }

    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2] + tx,
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8] + ty,
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5] + tz,

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, pp, flags
    );
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
                            this.blocks[x + 1][y + 1] = 1;
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
                return 0;
            }
        };
    }

}

// Экструдированные блоки
export default class style {

    static lm = new IndexedColor();

    static getRegInfo() {
        return {
            styles: ['extruder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, _x, _y, _z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        _x *= 2;
        _y *= 2;
        _z *= 2;

        let material = block.material;
        let resource_pack = material.resource_pack;

        let texture_id = 'default';
        if(typeof material.texture == 'object' && 'id' in material.texture) {
            texture_id = material.texture.id;
        }

        if(force_tex && force_tex?.id) {
            texture_id = force_tex.id;
        }

        let tex = resource_pack.textures.get(texture_id);
        // Texture
        const c = BLOCK.calcMaterialTexture(material, DIRECTION.FORWARD, null, null, null, force_tex);
        if(!tex) {
            console.error(block.id);
        }

        let world = new FakeCloudWorld();
        let tex_w = Math.round(c[2] * tex.width);
        let tex_h = Math.round(c[3] * tex.height);
        let tex_x = Math.round(c[0] * tex.width) - tex_w/2;
        let tex_y = Math.round(c[1] * tex.height) - tex_h/2;
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
        matrix                  = mat3.create();
        let scale               = new Vector(1, 1, tex_w / 32).divScalar(SCALE_FACTOR);
        mat4.scale(matrix, matrix, scale.toArray());

        // Size of one texture pixel
        const ts = tex.width / tex.tx_cnt;

        force_tex = [
            c[0],
            c[1],
            0,
            0,
        ];

        let lm = IndexedColor.WHITE;
        let z = -0.5 - 0.5 / SCALE_FACTOR;
        let flags = QUAD_FLAGS.NO_AO;

        if(block.hasTag('mask_biome')) {
            lm = dirt_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else if(block.hasTag('mask_color') && material.mask_color) {
            lm = material.mask_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        }
        let pp = IndexedColor.packLm(lm);

        let height = 1.0;
        let width = 1.0;
        // back & front, no matrices
        vertices.push(
            _x, -scale.z * 0.5 + _z, _y,
            MUL, 0, 0,
            0, 0, MUL * height,
            c[0], c[1], c[2], -c[3],
            pp, flags);

        vertices.push(
            _x, scale.z * (MUL*0.75) + _z, _y,
            MUL, 0, 0,
            0, 0, -MUL * height,
            c[0], c[1], c[2], c[3],
            pp, flags);

        let uc = 1 / tex.width;
        let vc = 1 / tex.height;

        for(let x = 0; x < clouds.size.x; x++) {
            for(let y = 0; y < clouds.size.y; y++) {
                let block  = world.chunkManager.getBlock(x, y, 0);
                if(!block) {
                    continue;
                }
                neighbours.DOWN = world.chunkManager.getBlock(x, y + 1, 0);
                neighbours.UP = world.chunkManager.getBlock(x, y - 1, 0);
                neighbours.WEST = world.chunkManager.getBlock(x - 1, y, 0);
                neighbours.EAST = world.chunkManager.getBlock(x + 1, y, 0);
                // Position of each texture pixel
                let u = (tex_x + (x-1) + 0.5) / tex.width;
                let v = (tex_y + (y-1) + 0.5) / tex.height;

                // inline cube drawing
                let x1 = _x + 0.5 + (x - TEX_WIDTH_HALF - 0.5) / SCALE_FACTOR
                let y1 = _y - (y - TEX_WIDTH_HALF - 0.5) / SCALE_FACTOR - 1.5
                let z1 = _z + z + scale.z / (ts / 16);

                if(!neighbours.UP) {
                    pushTransformed(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        .5, 0.5 * MUL, height,
                        1, 0, 0,
                        0, MUL, 0,
                        u, v, uc, vc,
                        pp, flags
                    );
                }

                // Bottom
                if(!neighbours.DOWN) {
                    pushTransformed(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        0.5, 0.5 * MUL, 0,
                        1, 0, 0,
                        0, -1 * MUL, 0,
                        u, v, uc, vc,
                        pp, flags);
                }

                // West
                if(!neighbours.WEST) {
                    pushTransformed(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        .5 - width / 2, .5 * MUL, height / 2,
                        0, 1 * MUL, 0,
                        0, 0, -height,
                        u, v, uc, vc,
                        pp, flags);
                }

                // East
                if(!neighbours.EAST) {
                    pushTransformed(
                        vertices, matrix, undefined,
                        x1, z1, y1,
                        .5 + width / 2, .5 * MUL, height / 2,
                        0, 1 * MUL, 0,
                        0, 0, height,
                        u, v, uc, vc,
                        pp, flags);
                }
            }
        }

    }

}
