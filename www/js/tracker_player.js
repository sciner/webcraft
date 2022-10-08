import { Vector, VectorCollector } from "./helpers.js";
import { XMPlayer } from "./xmplayer/xmWorklet.js";

const MAX_AUDIBILITY_DIST = 64;
const MAX_VOLUME = 128;
const VOLUME_DISCRETE = MAX_AUDIBILITY_DIST;
const FADEIN_MS = 3000;

export class Tracker_Player {
    static MASTER_VOLUME = 0.1;

    constructor() {
        this.vc = new VectorCollector();

        this.audioContext = null;
    }

    loadAndPlay(url, pos, dt) {

        let prev_jukebox = this.vc.get(pos);
        if(prev_jukebox && prev_jukebox.url == url) {
            return;
        }

        const jukebox = new XMPlayer();
        jukebox.url = url;

        this.stop(pos);
        this.vc.set(pos, jukebox);

        // cache 
        jukebox.init(this.audioContext);

        jukebox.volume = Tracker_Player.MASTER_VOLUME;

        // cache context if not present
        this.audioContext = jukebox.audioctx;

        jukebox.panner = new PannerNode(jukebox.audioctx, {
            maxDistance: 0,
            maxDistance: MAX_AUDIBILITY_DIST,
            rolloffFactor: 0.25,
            positionX: pos.x,
            positionY: pos.z,
            positionZ: pos.y,
        });

        fetch(url)
            .then(res => res.arrayBuffer()) // Gets the response and returns it as a blob
            .then(buffer => {
                jukebox.stop();
                // jukebox.volume = MAX_VOLUME;
                return jukebox.load(buffer);
            })
            .then(() => {    
                jukebox.play()

                // reconnect nodes, we shpuld swap gain and panner tree
                jukebox.gainNode.disconnect(jukebox.audioctx.destination);
                jukebox.gainNode
                    .connect(jukebox.panner)
                    .connect(jukebox.audioctx.destination);        
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

    onPlayerUpdate(player) {
        if (!this.audioContext) {
            return;
        }

        const { lerpPos, forward } = player;

        const { listener } = this.audioContext;

        listener.positionX.value = lerpPos.x;
        listener.positionY.value = lerpPos.z; // HAHAH
        listener.positionZ.value = lerpPos.y;

        listener.upX.value = 0;
        listener.upZ.value = 1; // because we flip axies
        listener.upY.value = 0;

        listener.forwardX.value = forward.x;
        listener.forwardY.value = forward.z;
        listener.forwardZ.value = forward.y;
    }

    changePos(pos) {
        return; 
 
        if(this.vc.size == 0 || this.pos_changing) {
            return;
        }
        this.pos_changing = true;
        if(!this.n_started) {
            this.n_started = performance.now();
        }
        for(let [jukebox_pos, jukebox] of this.vc.entries()) {
            if(jukebox.playing) {
                const dist = jukebox_pos.distance(pos);
                let volume = Math.round((dist < MAX_AUDIBILITY_DIST ? (1 - dist / MAX_AUDIBILITY_DIST) : 0) * VOLUME_DISCRETE) / VOLUME_DISCRETE;
                // volume *= MAX_VOLUME;
                const pn = performance.now() - this.n_started;
                if(pn < FADEIN_MS) {
                    volume *= (pn / FADEIN_MS);
                }

                jukebox.volume = volume * Tracker_Player.MASTER_VOLUME;
            }
        }
        this.pos_changing = false;
    }

}