import { IndexedColor, Vector, DIRECTION } from '../helpers.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';

// Панель
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['pane'],
            this.func,
            style.computeAABB,
        );
    }

    /**
     * @param {TBlock} tblock 
     * @param {boolean} for_physic 
     * @param {*} world 
     * @param {*} neighbours 
     * @param {boolean} expanded 
     */
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const bm = style.block_manager
        const shapes = []
        const height = 1
        const w = 2/16
        const w2 = w/2
        //
        const n = bm.autoNeighbs(world.chunkManager, tblock.posworld, 0, neighbours);
        // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        const con_s = bm.canPaneConnect(n.SOUTH);
        const con_n = bm.canPaneConnect(n.NORTH);
        const con_w = bm.canPaneConnect(n.WEST);
        const con_e = bm.canPaneConnect(n.EAST);
        let remove_center = con_s || con_n || con_w || con_e;
        //
        if(con_s && con_n) {
            // remove_center = true;
            shapes.push(new AABB(.5-w2, 0, 0, .5+w2, height, .5+.5));
        } else {
            // South z--
            if(con_s) {
                shapes.push(new AABB(.5-w2, 0, 0, .5+w2, height, .5+w2));
            }
            // North z++
            if(con_n) {
                shapes.push(new AABB(.5-w2,0, .5-w2, .5+w2, height, 1));
            }
        }
        if(con_w && con_e) {
            // remove_center = true;
            shapes.push(new AABB(0, 0, .5-w2, 1, height, .5+w2));
        } else {
            // West x--
            if(con_w) {
                shapes.push(new AABB(0, 0, .5-w2, .5+w2, height, .5+w2));
            }
            // East x++
            if(con_e) {
                shapes.push(new AABB(.5-w2, 0, .5-w2, 1, height, .5+w2));
            }
        }
        // Central
        if(!remove_center) {
            shapes.push(new AABB(.5-w2, 0, .5-w2, .5+w2, height, .5+w2));
        }
        return shapes
    }
    
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager

        if(block.material.name == 'IRON_BARS') {

            const texture = bm.calcTexture(block.material.texture, DIRECTION.DOWN);
            const planes = [];
            planes.push(...[
                {"size": {"x": 2, "y": 16, "z": 2}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 0}},
                {"size": {"x": 2, "y": 16, "z": 2}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 0}}
            ]);
            // Проверка сторон, для рисования кусков
            if (bm.canPaneConnect(neighbours.EAST)) {
                planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [3.5, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": -4.5}}]);
            }
            if (bm.canPaneConnect(neighbours.WEST)) {
                planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [12.5, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 4.5}}]);
            }
            if (bm.canPaneConnect(neighbours.SOUTH)) {
                planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [3.5, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": -4.5}}]);
            }
            if (bm.canPaneConnect(neighbours.NORTH)) {
                planes.push(...[{"size": {"x": 0, "y": 16, "z": 7}, "uv": [12.5, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 4.5}}]);
            }
            
            const flag = 0;
            const pos = new Vector(x, y, z);
            const lm = IndexedColor.WHITE;
            for(const plane of planes) {
                default_style.pushPlane(vertices, {
                    ...plane,
                    lm:         lm,
                    pos:        pos,
                    matrix:     matrix,
                    flag:       flag,
                    texture:    [...texture]
                });
            }

        } else {

            const texture = bm.calcTexture(block.material.texture, DIRECTION.DOWN);
            const texture_up = bm.calcTexture(block.material.texture, DIRECTION.UP);
            const texture_up_rot = bm.calcTexture(block.material.texture, 'up_rot');
            const flag = 0;
            const lm = IndexedColor.WHITE;
            const pos = new Vector(x, y, z);
            const rot = new Vector(0, 0, 0);
            const h = 15.99;
            const yt = 0.005;

            const main_part = {
                "size": {"x": 2, "y": h, "z": 2},
                "translate": {"x": 0, "y": yt, "z": 0},
                "faces": {
                    "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up},
                    "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up},
                    "north": {"uv": [8, 8], "flag": flag, "texture": texture},
                    "south": {"uv": [8, 8], "flag": flag, "texture": texture},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": texture},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": texture}
                }
            };

            // Geometries
            const parts : any[] = [main_part];

            const cn = bm.canPaneConnect(neighbours.NORTH);
            const cs = bm.canPaneConnect(neighbours.SOUTH);
            const ce = bm.canPaneConnect(neighbours.EAST);
            const cw = bm.canPaneConnect(neighbours.WEST);

            // Проверка сторон, для рисования кусков
            if(cn && cs && !ce && !cw) {
                main_part.size.z = 16;
                delete(main_part.faces.north);
                delete(main_part.faces.south);
            } else {
                if(cn) {
                    delete(main_part.faces.north);
                    const part = {
                        "size": {"x": 2, "y": h, "z": 7},
                        "translate": {"x": 0, "y": yt, "z": 4.5},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            // "north": {"uv": [8, 8], "flag": flag, "texture": texture},
                            "west":  {"uv": [12.5, 8], "flag": flag, "texture": texture},
                            "east":  {"uv": [12.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
                if(cs) {
                    delete(main_part.faces.south);
                    const part = {
                        "size": {"x": 2, "y": h, "z": 7},
                        "translate": {"x": 0, "y": yt, "z": -4.5},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up},
                            // "north": {"uv": [8, 8], "flag": flag, "texture": texture},
                            "west":  {"uv": [3.5, 8], "flag": flag, "texture": texture},
                            "east":  {"uv": [3.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
            }

            if(!cn && !cs && ce && cw) {
                main_part.size.x = 16;
                main_part.faces.up.texture = texture_up_rot;
                delete(main_part.faces.east);
                delete(main_part.faces.west);
            } else {
                if(ce) {
                    delete(main_part.faces.east);
                    const part = {
                        "size": {"x": 7, "y": h, "z": 2},
                        "translate": {"x": 4.5, "y": yt, "z": 0},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "north": {"uv": [12.5, 8], "flag": flag, "texture": texture},
                            "south": {"uv": [12.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
                if(cw) {
                    delete(main_part.faces.west);
                    const part = {
                        "size": {"x": 7, "y": 16, "z": 2},
                        "translate": {"x": -4.5, "y": yt, "z": 0},
                        "faces": {
                            "up":    {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "down":  {"uv": [8, 8], "flag": flag, "texture": texture_up_rot},
                            "north": {"uv": [3.5, 8], "flag": flag, "texture": texture},
                            "south": {"uv": [3.5, 8], "flag": flag, "texture": texture}
                        }
                    };
                    parts.push(part);
                }
            }

            for(let part of parts) {
                default_style.pushPART(vertices, {
                    ...part,
                    lm:         lm,
                    pos:        pos,
                    rot:        rot,
                    matrix:     matrix
                });
            }

        }

    }

}