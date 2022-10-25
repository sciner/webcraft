import { Sounds } from "./sounds.js";
import { VectorCollector } from "./helpers.js";
import { XMPlayer } from "./xmplayer/xmWorklet.js";

const MAX_AUDIBILITY_DIST = 64;
const MAX_VOLUME = 128;
const VOLUME_DISCRETE = MAX_AUDIBILITY_DIST;
const FADEIN_MS = 3000;

export class Tracker_Player {
    static MASTER_VOLUME = 0.1;

    constructor() {
        this.vc = new VectorCollector();
    }

    loadAndPlay(url, pos, dt) {
        const sounds = Sounds.instance;

        console.log('disc', 1, url, pos);
        let prev_jukebox = this.vc.get(pos);

        console.log('disc', 2);
        if(prev_jukebox && prev_jukebox.url == url) {
            return;
        }

        console.log('disc', 3);
        const jukebox = new XMPlayer();
        jukebox.url = url;

        console.log('disc', 4);
        this.stop(pos);
        this.vc.set(pos, jukebox);

        console.log('disc', 5);
        jukebox.panner = new PannerNode(sounds.context, {
            ...Sounds.PANNER_ATTR,

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

        console.log('disc', 6);
        fetch(url)
            .then(res => res.arrayBuffer()) // Gets the response and returns it as a blob
            .then(buffer => {
                try {
                    console.log('disc', 7, buffer);
                    jukebox.stop();
                    console.log('disc', 7, 'stopped');
                    // jukebox.volume = MAX_VOLUME;
                    const resp = jukebox.load(buffer);
                    console.log('disc', 7, resp);
                    return resp;
                } catch(e) {
                    debugger;
                }
            })
            .then(() => {   
                console.log('disc', 8);
                jukebox.play()
            })
            .catch((e) => {   
                console.log('disc', 9, e);
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