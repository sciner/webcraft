import {Mth, Vector, Color} from './helpers.js';
import { getChunkAddr, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk.js";
import { World } from './world.js';
import { AABB, AABBSideParams, pushAABB } from './core/AABB.js';

import {BLEND_MODES} from "./renders/BaseRenderer.js";
import {Resources} from "./resources.js";
import GeometryTerrain from "./geometry_terrain.js";
const {mat4} = glMatrix;

// AABBDrawable
export class AABBDrawable extends AABB {

    draw(render, pos, delta, do_draw) {
        if(!this.mesh) {
            const TARGET_TEXTURES = [.5, .5, 1, 1];
            this.mesh = this.createTargetBuffer(null, TARGET_TEXTURES);
        }
        if(!this.material) {
            // Material (damage)
            let material_damage = render.renderBackend.createMaterial({
                cullFace: true,
                opaque: false,
                blendMode: BLEND_MODES.MULTIPLY,
                shader: render.defaultShader,
            });
            // Material (target)
            this.material = material_damage.getSubMat(render.renderBackend.createTexture({
                source: Resources.pickat.debug,
                minFilter: 'nearest',
                magFilter: 'nearest'
            }));
        }
        let a_pos = new Vector(this.center);
        this.chunk_coord = getChunkAddr(a_pos.x, a_pos.y, a_pos.z, this.chunk_coord);
        this.chunk_coord.x *= CHUNK_SIZE_X;
        this.chunk_coord.y *= CHUNK_SIZE_Y;
        this.chunk_coord.z *= CHUNK_SIZE_Z;
        this.modelMatrix = mat4.create();
        a_pos.subSelf(this.chunk_coord);
        mat4.translate(this.modelMatrix, this.modelMatrix, [a_pos.x, a_pos.z, a_pos.y - this.height / 2]);
        if(do_draw) {
            render.renderBackend.drawMesh(this.mesh, this.material, this.chunk_coord, this.modelMatrix);
        }
    }

    // createTargetBuffer...
    createTargetBuffer(pos, c) {
        
        const vertices  = [];
        const lm        = new Color(0, 0, 0);
        const flags     = 0, sideFlags = 0, upFlags = 0;
        const pivot     = null;
        const matrix    = null;
        const aabb      = new AABB();

        aabb.copyFrom(this);

        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c, upFlags, 1, lm, null, false),
                down:   new AABBSideParams(c, flags, 1, lm, null, false),
                south:  new AABBSideParams(c, sideFlags, 1, lm, null, false),
                north:  new AABBSideParams(c, sideFlags, 1, lm, null, false),
                west:   new AABBSideParams(c, sideFlags, 1, lm, null, false),
                east:   new AABBSideParams(c, sideFlags, 1, lm, null, false),
            },
            Vector.ZERO
        );

        return new GeometryTerrain(vertices);
    }


}

// NetworkPhysicObject
export class NetworkPhysicObject {

    constructor(pos, rotate) {

        this._pos           = pos;
        this._prevPos       = new Vector(pos);

        this.moving         = false;
        this._chunk_addr    = new Vector(0, 0, 0);
        this.yaw            = 0;
        this.pitch          = 0;
        this.sneak          = 0;

        // Networking
        this.netBuffer = [];
        this.latency = 50;
        this.tPos = new Vector();
        this.tRot = new Vector();
        this.aabb = null;

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

    applyState(nextPos, nextRot, sneak) {
        this.pos = nextPos;
        if(nextRot) {
            this.yaw = nextRot.z;
            this.pitch = nextRot.x;
            this.sneak = sneak;
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
                this.netBuffer[0].rotate,
                this.netBuffer[0].sneak || 0
            );
        }

        const tPos = this.tPos;
        const tRot = this.tRot;

        const {
            pos: prevPos,
            rotate: prevRot,
            time: prevTime,
            sneak: prevSneak = 0,
        } = this.netBuffer[0];

        const {
            pos: nextPos,
            rotate: nextRot,
            time: nextTime,
            sneak: nextSneak = 0,
        } = this.netBuffer[1];

        let iterp = (correctedTime - prevTime) / (nextTime - prevTime);
        
        // prevent extrapolation.
        // it should be processed by another way
        // or will be bug with jump
        iterp = Mth.clamp(iterp, 0, 1);

        tPos.lerpFrom(prevPos, nextPos, iterp);

        const sneak = Mth.lerp(iterp, prevSneak, nextSneak);

        if(nextRot) {
            tRot.lerpFromAngle(prevRot, nextRot, iterp, true);
        }

        return this.applyState(tPos, tRot, sneak);
    }

    update() {
        this.processNetState();
        this.updateAABB();
    }

    updateAABB() {
        const w = this.width;
        const h = this.height;
        this.aabb = this.aabb || new AABBDrawable();
        this.aabb.set(
            this.tPos.x - w/2,
            this.tPos.y,
            this.tPos.z - w/2,
            this.tPos.x + w/2,
            this.tPos.y + h,
            this.tPos.z + w/2
        );
    }

}