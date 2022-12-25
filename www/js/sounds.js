import { Resources } from "./resources.js";
import { DEFAULT_SOUND_MAX_DIST }  from "./constant.js";

export class Sounds {
    static VOLUME_MAP = {
        // step: 0.1,
        entering_water: 0.1,
        exiting_water: 0.1,
        swim: 0.1,

        hit: 0.2,
        step: 0.2,
        water_splash: 0.2,
        burp: 0.4,
    };

    static PANNER_ATTR = {
        coneInnerAngle: 360,
        coneOuterAngle: 360,
        coneOuterGain: 0,
        distanceModel: 'inverse',
        maxDistance: DEFAULT_SOUND_MAX_DIST,
        panningModel: 'HRTF',
        refDistance: 1,
        rolloffFactor: 1,
    };

    /**
     * @type {Sounds}
     */
    static instance;

    /**
     * @type {import('./player').Player}
     */
    #player;

    constructor(player) {
        this.#player = player;

        this.tags = {};

        this.prev_index = new Map();

        this.sound_sprite_main = new Howl(Resources.sound_sprite_main);

        // default panner attr
        this.sound_sprite_main.pannerAttr(Sounds.PANNER_ATTR);

        for(let item of Resources.sounds) {
            this.add(item);
        }

        Sounds.instance = this;
    }

    /**
     * @type {AudioContext}
     */
    get context() {
        if (!Howler.ctx) {
            // MUST SET CONTEXT
            Howler.volume(1);
        }

        return Howler.ctx;
    }

    get masterGain() {
        if (!Howler.ctx) {
            // MUST SET CONTEXT
            Howler.volume(1);
        }

        return Howler.masterGain;
    }

    /**
     * Connect specific node to this master
     * @param { AudioNode } node 
     * @returns { GainNode }
     */
    connect(node) {
        node.connect(this.masterGain);
        return this.masterGain;
    }

    async add(item) {
        for(const action in item) {
            if(['type'].includes(action)) {
                continue;
            }

            const volume = Sounds.VOLUME_MAP[action] ?? 1;

            const props = { volume };

            for (const i in item[action]) {
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
                item[action][i] = { name, props };
            }
        }
        this.tags[item.type] = item;
    }

    // [TODO we need get a proper sound]
    voice_calculation(dist, maxDist) {
        // it's asumed that dist is always > max
        return Math.max(0, 1 - (dist / maxDist));
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
    play(tag, action, pos, ignore_repeating = false, loop = false, maxDist = DEFAULT_SOUND_MAX_DIST) {
        const list = this.getTagActionList(tag, action)

        if(!list) {
            return;
        }

        // Remove repeats item play
        const index_key = tag + '/' + action;
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
            let estimatedVolume = track.props.volume;

            if (pos) {
                const { lerpPos, forward } = this.#player;
                const dist = lerpPos.distance(pos);
                estimatedVolume *= this.voice_calculation(dist, maxDist);
            }
            
            // if volume ok, we can play sound 
            // this reduce sounds count 
            // only sounds that can be listened at current pos will executed
            if (estimatedVolume > 0) {
                track_id = this.sound_sprite_main.play( track.name );
                
                this.sound_sprite_main.loop(ignore_repeating, track_id);
 
                if (pos) {
                    this.sound_sprite_main.pos( pos.x, pos.z, pos.y, track_id);
                }

                this.applySoundProps(track_id, estimatedVolume, track.props);
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

    update() {
        // spatial audio

        const { lerpPos, forward } = this.#player;

        // Howler.pos
        this.setPos(
            lerpPos.x,
            lerpPos.z,
            lerpPos.y,
        );

        // Howler.orientation
        this.setOrientation(
            forward.x,
            forward.z,
            forward.y,
            0,  0,  1
        );

    }

    //
    setPos(x, y, z) {
        const listener = Howler.ctx.listener;
        const ctx = Howler.ctx;
        if (typeof listener.positionX !== 'undefined') {
            listener.positionX.setValueAtTime(x, ctx.currentTime);
            listener.positionY.setValueAtTime(y, ctx.currentTime);
            listener.positionZ.setValueAtTime(z, ctx.currentTime);
        } else {
            listener.setPosition(x, z, y);
        }
    }

    //
    setOrientation(x, y, z, xUp, yUp, zUp) {
        const listener = Howler.ctx.listener;
        const ctx = Howler.ctx;
        if (typeof listener.forwardX !== 'undefined') {
            listener.forwardX.setValueAtTime(x, ctx.currentTime);
            listener.forwardY.setValueAtTime(y, ctx.currentTime);
            listener.forwardZ.setValueAtTime(z, ctx.currentTime);
            listener.upX.setValueAtTime(xUp, ctx.currentTime);
            listener.upY.setValueAtTime(yUp, ctx.currentTime);
            listener.upZ.setValueAtTime(zUp, ctx.currentTime);
        } else {
            listener.setOrientation(x, y, z, xUp, yUp, zUp);
        }
    }

}