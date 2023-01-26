import { Resources } from "./resources.js";
import { DEFAULT_SOUND_MAX_DIST, CLIENT_MUSIC_ROOT, MUSIC_FADE_DURATION }  from "./constant.js";

class Music {

    #tracklistName
    #volume
    #playing

    constructor(config) {
        this.config     = config
        this.#tracklistName = 'default'
        this.#volume    = 1
        // It indicates whether the miusic should be played, not whether it's actually playing.
        // It's possible that (#playing === true), but no track is chosen for the crrent tracklist.
        this.#playing   = false

        this.track      = null
        this.howl       = null

        /**
         * If it's set to not null, the tracklist will be switched to this value when the current track
         * ends. Use it to switch tracklist not abruptly. Setting the tracklist directly clers this value.
         */
        this.nextTracklistName   = null
    }

    get volume() { return this.#volume }

    /**
     * Sets the volume. Setting it to 0 doesn't cause the current track to stop,
     * but when it stops, the next track won't start automatically.
     * @param {Number} volume from 0 to 1.
     */
    set volume(volume) {
        this.#volume = volume
        this.howl?.volume(this._getTrackVolume())
    }

    /**
     * Resumes playing if it isn't already playing.
     * It doesn't start playing if the volume is 0.
     * It chooses and starts a new track if necessary.
     */
    play() {
        this.#playing = true
        if (this.#volume) { // start actually playing only in the volume is not zero
            if (this.howl) {
                if (!this.howl.playing()) {
                    this.howl.play()
                }
            } else {
                this._switchTrack()
            }
        }
    }

    pause() {
        this.#playing = false
        this.howl?.pause()
    }

    get tracklistName() { return this.tracklistName }

    /**
     * Changes the current tracklist to the specified one.
     * If the current track is not in the new tracklist, it switches to a new
     * track from the new list.
     * 
     * If the tracklist name doesn't exist, e.g. 'silent', no music will play.
     * 
     * @param {String} tracklistName
     */
    set tracklistName(tracklistName) {
        tracklistName ??= 'default'
        this.#tracklistName = tracklistName
        this.nextTracklistName = null
        const tracks = this.config[tracklistName]
        // if the track needs to be changed
        const trackFits = tracks?.find(it => it.name === this.track?.name)
        if (!trackFits) {
            if (this.#playing && this.#volume) {
                this._switchTrack()
            } else {
                this._unloadTrack()
            }
        }
    }

    _unloadTrack() {
        if (this.howl) {
            if (this.howl.playing()) {
                // stop it gently, then unload
                this.howl.fade(this._getTrackVolume(), 0, MUSIC_FADE_DURATION)
            } else {
                this.howl.unload()
            }
        }
        this.track = null
        this.howl = null
    }

    _switchTrack() {
        const currentName = this.track?.name
        this._unloadTrack()
        // switch the tracklist if the change was planned before
        if (this.nextTracklistName) {
            this.#tracklistName = this.nextTracklistName
            this.nextTracklistName = null
        }

        const tracks = this.config[this.#tracklistName]
        if (!tracks?.length) {
            return // there is nothing to play
        }

        // select a random track, but don't play the same track twice in row if possible
        do {
            const index = Math.random() * tracks.length | 0
            this.track = tracks[index]
        } while(tracks.length > 1 && this.track.name === currentName)

        // don't create a howl until we actually need it
        if (!(this.#playing && this.#volume)) {
            return
        }

        // create a howl
        const onend = () => {
            if (this.howl === howl) {
                // It's still the main howl. Start a new track.
                this._switchTrack()
            } else {
                // It's the fading howl that finished before fading out. Unload it.
                howl.unload()
            }
        }
        const howl = new Howl({
            src: [CLIENT_MUSIC_ROOT + encodeURIComponent(this.track.name) + '.ogg'],
            html5: true,    // enable streaming
            ...this.track.props,
            onend,
            onloaderror: onend,
            onfade: () => {
                // Fade is called to gently switch tracks.
                // The caller already strated a new track, if they wanted to.
                // Just unload this howl.
                howl.unload()
            }
        })
        howl.volume(this._getTrackVolume())
        howl.play()
        this.howl = howl
    }

    _getTrackVolume() {
        return (this.track.props.volume ?? 1) * this.#volume * Sounds.VOLUME_MAP.music
    }
}

export class Sounds {
    static VOLUME_MAP = {
        // It's multiplied by the user-contolled music volume setting.
        // It allows us to change the music volume relative to other sounds without changing the user-controlled setting.
        music: 0.8, // this value should be chosen taking into account DEFAULT_MUSIC_VOLUME

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
        this.add(Resources.music ?? { type: 'madcraft:music' });

        this.music = new Music(this.tags['madcraft:music']);

        // to prvent Howler from periodically suspend itself, which also suspends Tracker_Player
        Howler.autoSuspend = false;

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
                // An example: "wood_1|volume=1;pitch=.8"
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

                this.applySoundProps(track_id, track.props.volume, track.props);
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