import {Helpers, getChunkAddr, Vector} from "./helpers.js";
import {Particles_Effects} from "./particles/effects.js";

export class Particle {

    constructor(texture, life, invert_percent, min_percent, gravity, speed) {
        this.texture            = texture;
        this.life               = life;
        this.invert_percent     = invert_percent;
        this.min_percent        = min_percent;
        this.gravity            = gravity;
        this.speed              = speed;
    }

}

// MeshManager
export class MeshManager {

    constructor() {

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

    }

    get(id) {
        return this.list.get(id);
    }

    add(mesh, key) {
        if(!key) {
            key = Helpers.generateID();
        }
        this.list.set(key, mesh);
        return mesh;
    }

    remove(key, render) {
        this.list.get(key)?.destroy(render);
        this.list.delete(key);
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
    addEffectParticle(name, pos) {

        let particle = null;
        const p = {...pos};

        let textures = this.particle_textures.get(name);
        if(!textures) {
            throw 'error_invalid_particle';
        }
        let texture_index = Math.floor(textures.length * Math.random());

        switch(name) {
            case 'music_note': {
                p.z += (Math.random() - Math.random()) * .3;
                particle = new Particle(textures[texture_index], 2, true, 0, 0.0075 + (0.0075 * Math.random()), new Vector(0, 100, 0));
                break;
            }
            case 'torch_flame': {
                const move_up = texture_index > 1;
                p.x += (Math.random() - Math.random()) * 0.01;
                p.y += .2;
                p.z += (Math.random() - Math.random()) * 0.01;
                particle = new Particle(textures[texture_index], 1, true, 0, 0.0075, new Vector(0, move_up ? 100 : 0, 0));
                break;
            }
            case 'campfire_flame': {
                p.x += (Math.random() - Math.random()) * .3;
                p.y += .35 + .25 * Math.random();
                p.z += (Math.random() - Math.random()) * .3;
                particle = new Particle(textures[texture_index], 5, false, 0, 0.0075 + (0.0075 * Math.random()), new Vector(0, 100, 0));
                break;
            }
            case 'explosion': {
                const speed = new Vector(
                    (Math.random() - .5) * 2,
                    (Math.random() - .5) * 2,
                    (Math.random() - .5) * 2
                ).normalize()
                .multiplyScalar(700);
                particle = new Particle(textures[texture_index], .5, false, 0, 0.0075 + (0.0075 * Math.random()), speed);
                break;
            }
        }

        if(particle) {
            this._chunk_addr = getChunkAddr(p.x, p.y, p.z, this._chunk_addr);
            const PARTICLE_EFFECTS_ID = 'particles_effects_' + this._chunk_addr.toHash();
            let effects = this.get(PARTICLE_EFFECTS_ID);
            if(!effects) {
                effects = new Particles_Effects(this, this._chunk_addr, 'extend/transparent/effects');
                // effects = new Particles_Effects(this, this._chunk_addr, 'base/regular/default');
                this.add(effects, PARTICLE_EFFECTS_ID);
            }
            effects.add(p, particle);
        }

    }

}