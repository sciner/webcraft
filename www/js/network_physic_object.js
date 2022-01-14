import {Mth, Vector} from './helpers.js';
import { getChunkAddr } from "./chunk.js";
import { World } from './world.js';

export class NetworkPhysicObject {

    constructor(pos, rotate) {

        this._pos           = pos;
        this._prevPos       = new Vector(pos);

        this.moving         = false;
        this._chunk_addr    = new Vector(0, 0, 0);
        this.yaw            = 0;
        this.pitch          = 0;

        // Networking
        this.netBuffer = [];
        this.latency = 50;
        this.tPos = new Vector();
        this.tRot = new Vector();

        /**
         * @type {World}
         */
        this.world = null;

        this.tracked = false;
    }

    get pos() {
        return this._pos;
    }

    get chunk_addr() {
        return getChunkAddr(this.pos, this._chunk_addr);
    }

    set pos(v) {
        const {
            x, y, z
        } = this._pos;
        
        const dx = v.x - x;
        const dy = v.y - y;
        const dz = v.z - z;

        this._prevPos.copyFrom(this._pos);
        this._pos.copyFrom(v);
        // chicken fix
        this._pos.y += 0.001;

        this.moving = Math.abs(dx) + Math.abs(dz) > 0.01;
    }

    get clientTime() {
        return this.world ? this.world.serverTimeWithLatency : Date.now();
    }

    applyNetState(data = {pos: null, time: 0, rotate: null}) {
        if (data.tracked) {
            this.tracked = true;
        }
        this.netBuffer.push(data);
    }

    applyState(nextPos, nextRot) {
        this.pos = nextPos;
        if(nextRot) {
            this.yaw = nextRot.z;
            this.pitch = nextRot.x;
        }
    }

    processNetState() {
        if (this.netBuffer.length === 0) {
            return;
        }

        const correctedTime = this.clientTime;

        while (this.netBuffer.length > 1 && correctedTime > this.netBuffer[1].time) {
            this.netBuffer.shift();
        }

        if (this.netBuffer.length === 1) {
            return this.applyState(
                this.netBuffer[0].pos,
                this.netBuffer[0].rotate
            );
        }

        const tPos = this.tPos;
        const tRot = this.tRot;

        const {
            pos: prevPos,
            rotate: prevRot,
            time: prevTime,
        } = this.netBuffer[0];

        const {
            pos: nextPos,
            rotate: nextRot,
            time: nextTime,
        } = this.netBuffer[1];

        let iterp = (correctedTime - prevTime) / (nextTime - prevTime);
        
        // prevent extrapolation.
        // it should be processed by another way
        // or will be bug with jump
        iterp = Mth.clamp(iterp, 0, 1);

        tPos.lerpFrom(prevPos, nextPos, iterp);

        if(nextRot) {
            tRot.lerpFromAngle(prevRot, nextRot, iterp, true);
        }

        return this.applyState(tPos, tRot);
    }

    update() {
        this.processNetState();
    }

}