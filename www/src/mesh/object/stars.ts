import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../../helpers.js';
import { BLOCK } from '../../blocks.js';
import { TerrainGeometry15 } from '../../geom/terrain_geometry_15.js';
import { GAME_DAY_SECONDS } from '../../constant.js';
import {impl as alea} from "@vendors/alea.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import type { IMeshDrawer } from "../mesh_batcher.js";

const {mat4} = glMatrix;

const SBEGIN        = 17500; // time to start stars increase brightness
const SEND          = 7000; // the time when the brightness of the stars should become 0
const SLEN          = 1500; // transition period

// Generate stars on the sphere
const STARS_RADIUS  = 256;
const STARS_COUNT   = 1024;
const stars = [];
const a = new alea('random_stars_position');
for(let i = 0; i < STARS_COUNT; i++) {
    stars.push({u: a.double(), v: a.double(), rot: a.double(), size: Math.max(a.double(), .25)});
}

// Stars
export class Mesh_Object_Stars {
    [key: string]: any;

    // Constructor
    constructor() {

        const material      = BLOCK.fromName('CLOUD');

        this.c              = BLOCK.calcTexture(material.texture, DIRECTION.EAST);
        this.gl_material    = material.resource_pack.getMaterial('base/doubleface/terrain/default');
        this.bo             = 0; // old stars brightness
        this.life           = 1.0;
        this.matrix         = mat4.create();

    }

    // calc stars brightness based on time and nightshift
    getCurrentStarBrightness() {
        let time = Qubatch.world.getTime().time_visible;
        const nightshift_255 = Qubatch.render.env.nightshift * 255;
        return Math.round(((time > SBEGIN || time < SEND) ?
            (
                (time > SBEGIN && time < SBEGIN+SLEN) ?
                (((time-SBEGIN)%SLEN)/SLEN) :
                ((time > (SEND-SLEN) && time < SEND) ? (SLEN-(time-(SEND-SLEN)))/SLEN : 1)
            ) : 0) * nightshift_255);
    }

    //
    generateStarsMesh() {

        if(!Qubatch.world || Qubatch.world.getTime() === null) {
            return;
        }

        if(Math.random() > 1/60) {
            return;
        }

        // calc stars brightness based on time
        this.b = this.getCurrentStarBrightness();
        if(this.b == this.bo) return;
        this.bo = this.b;

        if(this.buffer) {
            this.buffer.destroy();
        }

        // set opacity
        const lm = IndexedColor.WHITE;
        lm.b = this.b;

        // Push vertices

        this.vertices = [];
        for(let star of stars) {
            /**
             * Z is UP here
             */

            const {x, y, z, dx1, dy1, dz1, dx2, dy2, dz2} = this.randomSpherePoint(star.u, star.v, star.rot, 0, 0, 0, STARS_RADIUS);
            const size = 1 * star.size;
            this.vertices.push(
                x, y, z,
                size * dx1, size * dy1, size * dz1,
                size * dx2, size * dy2, size * dz2,
                ...this.c,
                lm.pack(),
                QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_NO_FOG | QUAD_FLAGS.FLAG_QUAD_OPACITY
            );
        }

        this.buffer = new TerrainGeometry15(this.vertices);

    }

    randomSpherePoint(u, v, rot, x0, y0, z0, radius) {
        let theta = 2 * Math.PI * u;
        let phi = Math.acos(2 * v - 1);

        let x = x0 + (radius * Math.sin(phi) * Math.cos(theta));
        let y = y0 + (radius * Math.sin(phi) * Math.sin(theta));
        let z = z0 + (radius * Math.cos(phi));

        const dx1 = -Math.sin(theta);
        const dy1 = Math.cos(theta);
        const dz1 = 0;

        const dx2 = -Math.cos(theta) * Math.cos(phi);
        const dy2 = -Math.sin(theta) * Math.cos(phi);
        const dz2 = Math.sin(phi);

        let a = Math.cos(2 * Math.PI * rot);
        let b = Math.sin(2 * Math.PI * rot);
        let c = -b;
        let d = a;

        return {x, y, z,
            dx1: dx1 * a + dx2 * b,
            dy1: dy1 * a + dy2 * b,
            dz1: dz1 * a + dz2 * b,
            dx2: dx1 * c + dx2 * d,
            dy2: dy1 * c + dy2 * d,
            dz2: dz1 * c + dz2 * d};
    }

    // Draw
    draw(meshBatcher: IMeshDrawer, delta : float) {

        this.generateStarsMesh();

        if(!this.buffer || this.b == 0) {
            return false;
        }

        this.apos = Qubatch.player.lerpPos;

        const time = Qubatch.world.getTime().time;
        const rot = time / GAME_DAY_SECONDS * (Math.PI * 2);
        this.matrix = mat4.create();
        mat4.rotate(this.matrix, this.matrix, -rot, [0, 1, 0]);

        meshBatcher.drawMesh(this.buffer, this.gl_material, this.apos, this.matrix);

    }

    destroy() {
        this.buffer.destroy();
        this.buffer = null;
    }

    get isAlive() : boolean {
        return this.life > 0;
    }

}