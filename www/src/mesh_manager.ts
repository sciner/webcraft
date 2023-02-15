import { Helpers, getChunkAddr, Vector, DIRECTION, QUAD_FLAGS, makeChunkEffectID, IndexedColor } from "./helpers.js";
// import { Particles_Effects } from "./particles/effects.js";
import type { Renderer } from "./render.js";

export class Particle {
    [key: string]: any;

    constructor(texture, life, invert_percent, min_percent, gravity, speed, flags : int = 0, lm : IndexedColor = null) {
        this.texture            = texture;
        this.life               = life;
        this.invert_percent     = invert_percent;
        this.min_percent        = min_percent;
        this.gravity            = gravity;
        this.speed              = speed;
        this.flags              = flags;
        this.lm                 = lm;
    }

}

// MeshManager
export class MeshManager {
    [key: string]: any;

    constructor() {

        this.chunks = new Map();
        this.list = new Map();
        this.particle_textures = new Map();

        this.particle_textures.set('music_note', [
            [0, 0], [1, 0], [2, 0], [3, 0]
        ]);

        this.particle_textures.set('torch_flame', [
            [0, 1], [1, 1], [2, 1], [3, 1]
        ]);

        this.particle_textures.set('campfire_flame', [
            [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
            [0, 4], [1, 4], [2, 4], [3, 4]
        ]);

        this.particle_textures.set('explosion', [
            [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
            [0, 4], [1, 4], [2, 4], [3, 4]
        ]);

        this.particle_textures.set('destroy_block', []);

        for(const arr of this.particle_textures.values()) {
            for(let i in arr) {
                arr[i][0] += .5;
                arr[i][1] += .5;
            }
        }

    }

    get(id) {
        return this.list.get(id);
    }

    add(mesh, key) {
        if(!key) {
            key = Helpers.generateID();
        }
        this.remove(key, Qubatch.render);
        this.list.set(key, mesh);
        return mesh;
    }

    remove(key: string, render : Renderer) {
        const keys = Array.from(this.list.keys()) as string[];
        for(let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if(k.indexOf(key) == 0) {
                const item = this.list.get(k);
                item.destroy(render);
                this.list.delete(k);
            }
        }
    }

    //
    addForChunk(chunk_addr, mesh, key) {
        const chunk_addr_hash = chunk_addr.toHash();
        let chunk = this.chunks.get(chunk_addr_hash);
        if(!chunk) {
            chunk = new Map();
            this.chunks.set(chunk_addr_hash, chunk);
        }
        //
        const exists = chunk.get(key);
        if(exists) {
            this.remove(key, Qubatch.render);
        }
        //
        chunk.set(key, mesh);
        this.list.set(key, mesh);
        return mesh;
    }

    //
    removeForChunk(chunk_addr) {
        const chunk_addr_hash = chunk_addr.toHash();
        const chunk = this.chunks.get(chunk_addr_hash);
        if(!chunk) {
            return false;
        }
        for(const key of chunk.keys()) {
            this.remove(key, Qubatch.render);
        }
        this.chunks.delete(chunk_addr_hash);
        return true;
    }

    draw(render, delta) {
        for(let [key, mesh] of this.list.entries()) {
            if(mesh.isAlive()) {
                mesh.draw(render, delta);
            } else {
                this.remove(key, render)
            }
        }
    }

    //
    addEffectParticle(name, pos, params) {

        let material_key = 'extend/transparent/terrain/effects';

        //
        const addParticle = (particle_pos, particle) => {
            this._chunk_addr = getChunkAddr(particle_pos.x, particle_pos.y, particle_pos.z, this._chunk_addr);
            const PARTICLE_EFFECTS_ID = makeChunkEffectID(this._chunk_addr, material_key);
            let effects = this.get(PARTICLE_EFFECTS_ID);
            if(!effects) {
                console.error(`error_effect_not_found|${PARTICLE_EFFECTS_ID}`)
                debugger
                // effects = new Particles_Effects(this, this._chunk_addr, material_key);
                // this.add(effects, PARTICLE_EFFECTS_ID);
            }
            effects.add(particle_pos, particle);
        }

        //
        const textures = this.particle_textures.get(name);
        if(!textures) {
            throw 'error_invalid_particle';
        }
        const texture_index = Math.floor(textures.length * Math.random());

        const p = new Vector(pos.x, pos.y, pos.z);

        switch(name) {
            case 'music_note': {
                p.z += (Math.random() - Math.random()) * .3;
                addParticle(p, new Particle(textures[texture_index], 2, true, 0, 0.0075 + (0.0075 * Math.random()), new Vector(0, 100, 0)));
                break;
            }
            case 'torch_flame': {
                const move_up = texture_index > 1;
                p.x += (Math.random() - Math.random()) * 0.01;
                p.y += .2;
                p.z += (Math.random() - Math.random()) * 0.01;
                addParticle(p, new Particle(textures[texture_index], 1, true, 0, 0.0075, new Vector(0, move_up ? 100 : 0, 0)));
                break;
            }
            case 'campfire_flame': {
                p.x += (Math.random() - Math.random()) * .3;
                p.y += .35 + .25 * Math.random();
                p.z += (Math.random() - Math.random()) * .3;
                addParticle(p, new Particle(textures[texture_index], 5, false, 0, 0.0075 + (0.0075 * Math.random()), new Vector(0, 100, 0)));
                break;
            }
            case 'explosion': {
                const speed = new Vector(
                    (Math.random() - .5) * 2,
                    (Math.random() - .5) * 2,
                    (Math.random() - .5) * 2
                ).normalize()
                .multiplyScalarSelf(700);
                addParticle(p, new Particle(textures[texture_index], .5, false, 0, 0.0075 + (0.0075 * Math.random()), speed));
                break;
            }
            case 'destroy_block': {
                const {block, small, block_manager} = params;
                const mat = block_manager.fromId(block.id);
                const tex = block_manager.calcMaterialTexture(mat, DIRECTION.DOWN);
                tex[0] *= mat.tx_cnt;
                tex[1] *= mat.tx_cnt;
                tex[2] *= mat.tx_cnt;
                tex[3] *= mat.tx_cnt;
                material_key = mat.material_key;
                const count = small ? 5 : 30;
                const ppos = new Vector(p);
                //
                let lm = null;
                let flags = 0;
                if(block_manager.MASK_BIOME_BLOCKS.indexOf(mat.id) >= 0) {
                    //const pos_floored = pos.clone().flooredSelf();
                    //const index = ((pos_floored.z - chunk.coord.z) * CHUNK_SIZE_X + (pos_floored.x - chunk.coord.x)) * 2;
                    //lm          = new Color(chunk.dirt_colors[index], chunk.dirt_colors[index + 1], 0, 0);
                    //flags       = flags | QUAD_FLAGS.MASK_BIOME;
                } else if(block_manager.MASK_COLOR_BLOCKS.indexOf(mat.id) >= 0) {
                    lm = mat.mask_color;
                    flags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
                }
                //
                for(let i = 0; i < count; i++) {
                    const tex2 = [...tex];
                    const max_sz = (small ? .25 : 3) / 16;
                    // случайный размер текстуры
                    const size_x = Math.random() * max_sz + 1 / 16;
                    const size_z = Math.random() * max_sz + 1 / 16;
                    tex2[2] = size_x;
                    tex2[3] = size_z;
                    //
                    const speed = new Vector(
                            (Math.random() - .5) * 2,
                            (Math.random() - .5) * 2,
                            (Math.random() - .5) * 2
                        ).normalize()
                        .multiplyScalarSelf(100);
                    addParticle(ppos, new Particle(tex2, .5, true, 1, 0.0075 + (0.0075 * Math.random()), speed, flags, lm))
                }
                break;
            }
        }

    }

}