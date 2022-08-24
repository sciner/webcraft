import {Resources} from "./resources.js";
import { MAX_SOUND_DISTANCE, SOUND_MAX_DIST }  from "./constant.js";

export class Sounds {

    constructor() {
        this.tags = {};
        this.prev_index = new Map();
        this.sound_sprite_main = new Howl(Resources.sound_sprite_main);
        for(let item of Resources.sounds) {
            this.add(item);
        }
    }

    async add(item) {
        for(let action of ['dig', 'place', 'open', 'close', 'hit', 'eat', 'burp', 'fuse', 'break', 'explode', 'click', 'hurt', 'strong_atack', 'death', 'idle', 'step']) {
            if(item.hasOwnProperty(action)) {
                let volume = 1.;
                if(action == 'hit') {
                    volume = 0.2;
                }
                for(let i in item[action]) {
                    item[action][i] = {name: item[action][i], volume: volume};
                }
            }
        }
        this.tags[item.type] = item;
    }

    // [TODO we need get a proper sound]
    voice_calculation(dist) {
        // it's asumed that dist is always > max
        return Math.max(0, 1 - (dist / SOUND_MAX_DIST));
    }

    play(tag, action, dist) {
        if(!this.tags.hasOwnProperty(tag)) {
            return;
        }
        const list = this.tags[tag][action];
        // Remove repeats item play
        let index_key = tag + '/' + action;
        let prev_index = -1;
        if(this.prev_index.has(index_key)) {
            prev_index = this.prev_index.get(index_key);
        }
        let index = -1;
        do {
            // select random item from list
            index = Math.floor(Math.random() * list.length) | 0;
        } while (prev_index == index && list.length > 1);
        this.prev_index.set(index_key, index);
        // Play
        const track = list[index];
        if(track) {
            let volume = track.volume;
            if(!isNaN(dist)) volume *= this.voice_calculation(dist);
            if(action == 'step') {
                volume *= .1;
            }          
            if(volume > 0) {
                console.debug(tag, action, volume);
                const track_id = this.sound_sprite_main.play(track.name);
                this.sound_sprite_main.volume(volume, track_id);
            }
        }
        return true;
    }

    getList(tag, action) {
        if(!this.tags.hasOwnProperty(tag)) {
            return null;
        }
        return this.tags[tag][action];
    }

}