import {Vector, VectorCollector} from "./helpers.js";
import {XMPlayer} from "./../vendors/xm.js";

const MAX_AUDIBILITY_DIST = 64;
const MAX_VOLUME = 128;
const VOLUME_DISCRETE = MAX_AUDIBILITY_DIST;
const FADEIN_MS = 3000;

export class Tracker_Player {

    constructor() {
        this.vc = new VectorCollector();
    }

    loadAndPlay(url, pos, dt) {

        let prev_jukebox = this.vc.get(pos);
        if(prev_jukebox && prev_jukebox.url == url) {
            return;
        }

        const jukebox = new XMPlayer();
        jukebox.url = url;
        jukebox.init();

        this.stop(pos);
        this.vc.set(pos, jukebox);

        fetch(url)
        .then(res => res.blob()) // Gets the response and returns it as a blob
        .then(async blob => {
            jukebox.stop();
            var buffer = await blob.arrayBuffer();
            jukebox.url = url;
            // calculate how many seconds between disc started
            jukebox.load(buffer);
            jukebox.play();
            /*if(dt) {
                const elapsed_sec = Math.round((new Date() - dt) / 1000);
                console.log(elapsed_sec);
            }*/
        });

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
                volume *= MAX_VOLUME;
                const pn = performance.now() - this.n_started;
                if(pn < FADEIN_MS) {
                    volume *= (pn / FADEIN_MS);
                }
                if(jukebox.xm.global_volume != volume) {
                    jukebox.xm.global_volume = volume;
                }
            }
        }
        this.pos_changing = false;
    }

}