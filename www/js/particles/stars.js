import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../helpers.js';
import { BLOCK } from '../blocks.js';
import GeometryTerrain from '../geometry_terrain.js';
import { GAME_DAY_SECONDS } from '../constant.js';
import {impl as alea} from "../../vendors/alea.js";

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
    stars.push({u: a.double(), v: a.double(), size: Math.max(a.double(), .25)});
}

// Stars
export class Particles_Stars {

    // Constructor
    constructor() {

        const material      = BLOCK.fromName('CLOUD');

        this.c              = BLOCK.calcTexture(material.texture, DIRECTION.EAST);
        this.gl_material    = material.resource_pack.getMaterial('base/doubleface/default');
        this.bo             = 0; // old stars brightness
        this.life           = 1.0;
        this.matrix         = mat4.create();

    }

    // calc stars brightness based on time
    getCurrentStarBrightness() {
        const time = Qubatch.world.getTime().time;
        return Math.round(((time > SBEGIN || time < SEND) ?
            (
                (time > SBEGIN && time < SBEGIN+SLEN) ?
                (((time-SBEGIN)%SLEN)/SLEN) :
                ((time > (SEND-SLEN) && time < SEND) ? (SLEN-(time-(SEND-SLEN)))/SLEN : 1)
            ) : 0) * 255);
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

        console.log('redraw stars');

        if(this.buffer) {
            this.buffer.destroy();
        }

        // set opacity
        const lm = IndexedColor.WHITE;
        lm.b = this.b;

        // Push vertices
        this.vertices = [];
        for(let star of stars) {
            const {x, y, z} = this.randomSpherePoint(star.u, star.v, 0, 0, 0, STARS_RADIUS);
            const size = 1 * star.size;
            this.vertices.push(
                x, y, z,
                -size, 0, 0,
                0, 0, -size,
                ...this.c,
                lm.pack(),
                QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.NO_FOG | QUAD_FLAGS.LOOK_AT_CAMERA | QUAD_FLAGS.QUAD_FLAG_OPACITY
            );
        }

        this.buffer = new GeometryTerrain(this.vertices);

    }

    randomSpherePoint(u, v, x0, y0, z0, radius) {
        var theta = 2 * Math.PI * u;
        var phi = Math.acos(2 * v - 1);
        var x = x0 + (radius * Math.sin(phi) * Math.cos(theta));
        var y = y0 + (radius * Math.sin(phi) * Math.sin(theta));
        var z = z0 + (radius * Math.cos(phi));
        return {x, y, z};
    }

    // Draw
    draw(render, delta) {

        this.generateStarsMesh();

        if(!this.buffer || this.b == 0) {
            return false;
        }

        this.apos = Qubatch.player.lerpPos;

        const time = Qubatch.world.getTime().time;
        const rot = time / GAME_DAY_SECONDS * (Math.PI * 2);
        this.matrix = mat4.create();
        mat4.rotate(this.matrix, this.matrix, -rot, [0, 1, 0]);

        render.renderBackend.drawMesh(this.buffer, this.gl_material, this.apos, this.matrix);

    }

    destroy() {
        this.buffer.destroy();
        this.buffer = null;
    }

    isAlive() {
        return this.life > 0;
    }

}