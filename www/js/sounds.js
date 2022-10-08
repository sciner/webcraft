import {Resources} from "./resources.js";
import { SOUND_MAX_DIST }  from "./constant.js";

export class Sounds {

    #player;

    constructor(player) {
        this.#player = player;
        this.tags = {};
        this.prev_index = new Map();
        this.sound_sprite_main = new Howl(Resources.sound_sprite_main);
        for(let item of Resources.sounds) {
            this.add(item);
        }
    }

    async add(item) {
        for(let action in item) {
            if(['type'].includes(action)) {
                continue;
            }
            let volume = 1.;
            if(['step', 'entering_water', 'exiting_water', 'swim'].includes(action)) volume = .1;
            if(['hit', 'step', 'water_splash'].includes(action)) volume = .2;
            if(['burp'].includes(action)) volume = .4;
            let props = {volume};
            for(let i in item[action]) {
                // read sound specific props (volume, )
                let temp = item[action][i].split('|');
                const name = temp.shift();
                if(temp.length > 0) {
                    const sound_props = temp[0].split(';');
                    for(let j in sound_props) {
                        const props_kv = sound_props[j].split('=');
                        if(props_kv.length != 2) {
                            throw 'error_sound_props';
                        }
                        let value = props_kv[1];
                        if(!isNaN(value)) {
                            value =  parseFloat(value);
                        }
                        props[props_kv[0]] = value;
                    }
                }
                item[action][i] = {name, props};
            }
        }
        this.tags[item.type] = item;
    }

    // [TODO we need get a proper sound]
    voice_calculation(dist) {
        // it's asumed that dist is always > max
        return Math.max(0, 1 - (dist / SOUND_MAX_DIST));
    }

    //
    getTagActionList(tag, action) {
        if(!this.tags.hasOwnProperty(tag)) {
            return null;
        }
        let list = this.tags[tag][action];
        if(!list && action == 'step') {
            list = this.tags[tag]['hit'];
        }
        return list ?? null;
    }

    /**
     * Play sound effect
     * @param {string} tag 
     * @param {string} action 
     * @param {Vector} pos 
     * @param {boolean} ignore_repeating 
     * @returns 
     */
    play(tag, action, pos, ignore_repeating = false) {
        const list = this.getTagActionList(tag, action)
        if(!list) {
            return;
        }
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
        } while ((!ignore_repeating && prev_index == index) && list.length > 1);
        this.prev_index.set(index_key, index);
        // play
        const track = list[index];
        let track_id;
        if(track) {
            // calculate volume by distance
            let volume = track.props.volume;
            if(pos) {
                const { lerpPos, forward } = this.#player;
                const dist = lerpPos.distance(pos);
                volume *= this.voice_calculation(dist);
            }
            // if volume ok
            if(volume > 0) {
                track_id = this.sound_sprite_main.play(track.name);
                this.applySoundProps(track_id, volume, track.props);
            }
        }
        return track_id;
    }

    //
    applySoundProps(track_id, volume, props) {
        this.sound_sprite_main.volume(volume, track_id);
        for(let k in props) {
            const value = props[k];
            switch(k) {
                case 'volume': {
                    // need to ignore
                    break;
                }
                case 'pitch': {
                    this.sound_sprite_main.rate(value, track_id);
                    break;
                }
            }
        }
    }

    stop(track_id) {
        this.sound_sprite_main.stop(track_id);
    }

    getList(tag, action) {
        if(!this.tags.hasOwnProperty(tag)) {
            return null;
        }
        return this.tags[tag][action];
    }

}