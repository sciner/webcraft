import {FSMBrain} from "../brain.js";
import {CHUNK_STATE_NEW, CHUNK_STATE_LOADING, CHUNK_STATE_LOADED, CHUNK_STATE_BLOCKS_GENERATED} from "../../server_chunk.js";

import {Vector} from "../../../www/js/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, 1/4, 0.8, 1);
        // Начинаем с просто "Стоять"
        this.stack.pushState((delta) => {this.standStill(delta)});
    }

    standStill(delta) {
        let r = Math.random() * 5000;
        if(r < 200) {
            this.stack.popState(); // removes current state from the stack.
            if(r < 100) {
                // Random rotate
                this.stack.pushState((delta) => {this.doRotate(delta)}); // push new state, making it the active state.
            } else {
                // Go forward
                this.stack.pushState((delta) => {this.goForward(delta)}); // push new state, making it the active state.
            }
        }
    }

    doRotate(delta) {
        if(Math.random() * 5000 < 300) {
            this.stack.popState();
            this.stack.pushState((delta) => {this.standStill(delta)});
            return;
        }
        let mob = this.mob;
        let world = mob.getWorld();
        let chunk_over = world.chunks.get(mob.chunk_addr);
        if(!chunk_over) {
            return;
        }
        mob.rotate.z += delta; // (Math.random() * Math.PI * 2) - Math.PI;
        this.sendState(chunk_over);
    }

    goForward(delta) {

        let mob = this.mob;
        let world = mob.getWorld();

        let chunk_over = world.chunks.get(mob.chunk_addr);
        if(!chunk_over) {
            return;
        }

        if(chunk_over.load_state != CHUNK_STATE_BLOCKS_GENERATED) {
            return;
        }

        let pc                 = this.pc;
        pc.player_state.yaw    = mob.rotate.z;
        pc.controls.forward    = true; // !!(this.keys[KEY.W] && !this.keys[KEY.S]);
        // pc.controls.back       = false; // !!(this.keys[KEY.S] && !this.keys[KEY.W]);
        // pc.controls.right      = false; // !!(this.keys[KEY.D] && !this.keys[KEY.A]);
        // pc.controls.left       = false; // !!(this.keys[KEY.A] && !this.keys[KEY.D]);
        // pc.controls.jump       = false; // !!this.keys[KEY.SPACE];
        // pc.controls.sneak      = false; // !!this.keys[KEY.SHIFT];
        // pc.controls.sprint     = false; // this.running;

        if(Math.random() * 5000 < 200) {
            this.stack.popState(); // removes current state from the stack.
            this.stack.pushState((delta) => {this.standStill(delta)}); // push new state, making it the active state.
            this.sendState(chunk_over);
            return;
        }

        // Physics tick
        let ticks = pc.tick(delta);

        mob.pos.copyFrom(pc.player.entity.position);

        this.sendState(chunk_over);

        /*
            let pos = this.pos.sub(new Vector(0, 1, 0));
            let block = chunk_over.getBlock(pos);
        */
    }

}