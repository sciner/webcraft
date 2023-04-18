import {Vector, VectorCollector} from "@client/helpers.js";
import {BLOCK} from "@client/blocks.js";
import { TBlock } from "@client/typed_blocks3.js";
import {impl as alea} from '../../www/vendors/alea.js';
import type { MobSpawnParams } from "../mob.js";
import type { ServerChunk } from "../server_chunk.js";

// Mob generator
export class MobGenerator {
    chunk: ServerChunk;
    random: any;
    can_generate: boolean;
    types: any[] = []

    constructor(chunk: ServerChunk) {
        this.chunk = chunk;
        this.types.push({type: 'mob/chicken', skin: 'base', count: 4});
        this.types.push({type: 'mob/chicken', skin: 'base', count: 4});
        this.types.push({type: 'mob/sheep', skin: 'base', count: 4});
        this.types.push({type: 'mob/cow', skin: 'base', count: 4});
        this.types.push({type: 'mob/horse', skin: 'creamy', count: 2});
        this.types.push({type: 'mob/pig', skin: 'base', count: 4});
        this.types.push({type: 'mob/fox', skin: 'base', count: 1});
    }

    async generate() {
        // Auto generate mobs
        const auto_generate_mobs = this.chunk.world.getGeneratorOptions('auto_generate_mobs', true);
        if(auto_generate_mobs) {
            // probability 1/10
            const chunk_addr_hash = this.chunk.addrHash;
            this.random = new alea('chunk' + chunk_addr_hash);
            this.can_generate = this.random.double() < .05;
            if(!this.can_generate) {
                return false;
            }
            // if generating early
            if(this.chunk.chunkRecord.mobs_is_generated) {
                return false;
            }
            // check chunk is good place for mobs
            if(this.chunk.tblocks) {
                let material = null;
                let pos2d = new Vector(0, 0, 0);
                const blockIter = this.chunk.tblocks.createUnsafeIterator(new TBlock(null, new Vector(0, 0, 0)));
                let vc = new VectorCollector();
                // Обход всех блоков данного чанка
                for(let block of blockIter) {
                    material = block.material;
                    if(material && material.id == BLOCK.GRASS_BLOCK.id) {
                        pos2d.x = block.vec.x;
                        pos2d.z = block.vec.z;
                        vc.set(pos2d, block.vec.y);
                    }
                }
                //
                if(vc.size > this.chunk.size.x * this.chunk.size.z / 2) {
                    let cnt = 0;
                    const poses = [];
                    const pos_up = new Vector(0, 0, 0);
                    for(let [vec, y] of vc.entries()) {
                        if(cnt++ % 2 == 0) {
                            pos_up.copyFrom(vec);
                            pos_up.y = y;
                            //
                            pos_up.y++;
                            let up1 = this.chunk.tblocks.get(pos_up);
                            let up1_id = up1.id;
                            pos_up.y++;
                            let up2 = this.chunk.tblocks.get(pos_up);
                            let up2_id = up2.id;
                            //
                            if((up1_id == 0 || up1_id == 31) && (up2_id == 0 || up2_id == 31)) {
                                const pos = new Vector(.5, y + 1, .5);
                                pos.addSelf(vec).addSelf(this.chunk.coord);
                                poses.push(pos);
                            }
                        }
                    }
                    if(poses.length > 0) {
                        poses.sort(() => .5 - Math.random());
                        const index = Math.floor(this.random.double() * this.types.length);
                        const t = this.types[index];
                        if(poses.length >= t.count) {
                            for(let i = 0; i < t.count; i++) {
                                const params: MobSpawnParams = {
                                    pos: poses[i],
                                    rotate: new Vector(0, 0, this.random.double() * Math.PI * 2),
                                    ...t
                                };
                                // Spawn mob
                                this.chunk.world.mobs.create(params);
                            }
                        }
                    }
                }
            }
            // Mark as generated
            this.chunk.chunkRecord.mobs_is_generated = 1;
            this.chunk.chunkRecord.dirty = true;
        }
    }

}