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

        // cache 
        jukebox.init(this.audioContext);

        jukebox.volume = Tracker_Player.MASTER_VOLUME;

        // cache context if not present
        this.audioContext = jukebox.audioctx;

        this.stop(pos);
        this.vc.set(pos, jukebox);

        fetch(url)
            .then(res => res.blob()) // Gets the response and returns it as a blob
            .then(async blob => {
                jukebox.stop();
                jukebox.url = url;
                jukebox.volume = 0;
                return blob.arrayBuffer();
            })
            .then((b) => jukebox.load(b))
            .then(() => jukebox.play())
            // for compute valid volume
            .then(()=> this.changePos(pos))
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

    changePos(pos) {
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