import {Resources} from "./resources.js";
import { MAX_SOUND_DISTANCE }  from "./constant.js";

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
        return dist < MAX_SOUND_DISTANCE 
            ? 1 - (dist / MAX_SOUND_DISTANCE)
            : 0;
    }

    play(tag, action, volume, dist) {
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
            const track_id = this.sound_sprite_main.play(track.name);
            volume = isNaN(volume) ? track.volume : track.volume * volume;
            if(action == 'step') {
                volume *= .1;
            }
            if (dist){
                volume = volume * this.voice_calculation(dist);
            }                
            if(volume > 0) {
                console.debug(tag, action, volume)
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