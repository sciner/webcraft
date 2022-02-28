import {Helpers, Vector} from "./helpers.js";
// import {Particles_Music_Note} from "./particles/music_note.js";
// import {Particles_Torch_Flame} from "./particles/torch_flame.js";
// import {Particles_Campfire_Flame} from "./particles/campfire_flame.js";

// MeshManager
export class MeshManager {

    constructor() {
        this.list = new Map();
        this.particle_textures = new Map();

        this.particle_textures.set('music_note', [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0]
        ]);

        this.particle_textures.set('torch_flame', [
            [0, 1],
            [1, 1],
            [2, 1],
            [3, 1]
        ]);

        this.particle_textures.set('campfire_flame', [
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [6, 3],
            [7, 3],
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4]
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
        
        let params = null;
        const p = {...pos};

        let textures = this.particle_textures.get(name);
        if(!textures) {
            throw 'error_invalid_particle';
        }
        let texture_index = Math.floor(textures.length * Math.random());

        switch(name) {
            case 'music_note': {
                p.z += (Math.random() - Math.random()) * .3;
                params = {
                    texture:        textures[texture_index],
                    life:           2,
                    invert_percent: true,
                    min_percent:    0,
                    gravity:        0.0075 + (0.0075 * Math.random()),
                    speed:          new Vector(0, 100, 0)
                }
                // this.meshes.add(new Particles_Music_Note(this, p, 'extend/regular/effects'));
                break;
            }
            case 'torch_flame': {
                const move_up = texture_index > 1;
                const p = {...pos};
                p.x += (Math.random() - Math.random()) * 0.01;
                p.y += .2;
                p.z += (Math.random() - Math.random()) * 0.01;
                params ={
                    texture:        textures[texture_index],
                    life:           1,
                    invert_percent: true,
                    gravity:        0.0075,
                    speed:          new Vector(0, move_up ? 100 : 0, 0)
                };
                // this.add(new Particles_Torch_Flame(this, p, 'extend/transparent/effects'));
                break;
            }
            case 'campfire_flame': {
                const p = {...pos};
                p.x += (Math.random() - Math.random()) * .3;
                p.y += .35 + .25 * Math.random();
                p.z += (Math.random() - Math.random()) * .3;
                params = {
                    texture:        textures[texture_index],
                    life:           5,
                    gravity:        0.0075 + (0.0075 * Math.random()),
                    speed:          new Vector(0, 100, 0)
                };
                // this.add(new Particles_Campfire_Flame(this, p, 'extend/transparent/effects'));
                break;
            }
        }

        if(params) {
            Game.render.addEffectParticle(p, params)
        }
        
    }

}