import { Sounds } from "./sounds.js";
import { VectorCollector } from "./helpers.js";
import { XMPlayer } from "./xmplayer/xmWorklet.js";

const MAX_AUDIBILITY_DIST = 64;
const MAX_VOLUME = 128;
const VOLUME_DISCRETE = MAX_AUDIBILITY_DIST;
const FADEIN_MS = 3000;

export class Tracker_Player {
    [key: string]: any;
    static MASTER_VOLUME = 0.1;

    constructor() {
        this.vc = new VectorCollector();
    }

    loadAndPlay(url, pos, dt) {
        const sounds = Sounds.instance;

        let prev_jukebox = this.vc.get(pos);

        if(prev_jukebox && prev_jukebox.url == url) {
            return;
        }

        const jukebox = new XMPlayer();
        jukebox.url = url;

        this.stop(pos);
        this.vc.set(pos, jukebox);

        jukebox.panner = new PannerNode(sounds.context, {
            //...Sounds.PANNER_ATTR,

            rolloffFactor: 0.25,

            // juckbox listen at 64 blocks
            maxDistance: 64,

            positionX: pos.x,

            positionY: pos.z,

            positionZ: pos.y,
        });

        // jukeboxWorker -> jukeboxGain -> panner -> masterGain
        // attach to sound context in panner
        jukebox.init(sounds.context, jukebox.panner);

        // that connected to master gain
        jukebox.panner.connect(sounds.masterGain);

        jukebox.volume = Tracker_Player.MASTER_VOLUME;

        fetch(url)
            .then(res => res.arrayBuffer()) // Gets the response and returns it as a blob
            .then(buffer => {
                jukebox.stop();
                // jukebox.volume = MAX_VOLUME;
                return jukebox.load(buffer);
            })
            .then(() => {
                jukebox.play()
            })
    }

    stop(pos) {
        let jukebox = this.vc.get(pos);
        if(jukebox) {
            jukebox.stop();
            this.vc.delete(pos);
            Qubatch.render.meshes.effects.deleteBlockEmitter(pos);
        }
    }

    destroyAllInAABB(aabb) {
        for(let [pos, _] of this.vc.entries(aabb)) {
            this.stop(pos);
        }
    }
}