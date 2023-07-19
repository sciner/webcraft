import {impl as alea} from "@vendors/alea.js";
import {StarGeometry, StarShader} from "./star_shader.js";
import {MeshInstanceBuilder} from "../mesh_builder.js";
import type {Renderer} from "../../render.js";
import {GAME_DAY_SECONDS} from "../../constant.js";
import {BLEND_MODES, DRAW_MODES, State} from "vauxcel";

const SBEGIN        = 17500; // time to start stars increase brightness
const SEND          = 7000; // the time when the brightness of the stars should become 0
const SLEN          = 1500; // transition period

interface IStarTimeWorld {
    getTime(): { time_visible: number}
}
// Stars
export class Mesh_Object_Stars {

    shader = new StarShader();
    geom: StarGeometry = null;
    world = null;
    state = State.for2d();

    // Constructor
    constructor(world: IStarTimeWorld) {
        this.world = world
        this.state.blendMode = BLEND_MODES.NORMAL_NPM;
        this.generateStarsMesh();
    }

    // calc stars brightness based on time and nightshift
    getCurrentStarBrightness(render: Renderer = Qubatch.render) {
        const gtime = this.world?.getTime();
        if(!gtime) {
            return 0;
        }

        let time = gtime.time_visible;
        const nightshift_255 = render.env.nightshift * 255;
        return Math.round(((time > SBEGIN || time < SEND) ?
            (
                (time > SBEGIN && time < SBEGIN+SLEN) ?
                (((time-SBEGIN)%SLEN)/SLEN) :
                ((time > (SEND-SLEN) && time < SEND) ? (SLEN-(time-(SEND-SLEN)))/SLEN : 1)
            ) : 0) * nightshift_255);
    }

    get brightness(): number {
        return this.shader.uniforms.u_sky_brightness * 255.0;
    }

    set brightness(value: number) {
        this.shader.uniforms.u_sky_brightness = value / 255.0;
    }

    //
    generateStarsMesh() {

        const builder = new MeshInstanceBuilder<StarGeometry>(StarGeometry);

        const { vertices } = builder;

        // Generate stars on the sphere
        const STARS_COUNT   = 1024;
        const star_mesh = [];
        const a = new alea('random_stars_position');

        const clr = 0xffffffff; // 0AABBGGRR
        let num = -1;
        for(let i = 0; i < STARS_COUNT; i++) {
            const x = a.double() * 2.0 - 1.0;
            const y = a.double() * 2.0 - 1.0;
            const z = a.double() * 2.0 - 1.0;
            const size = Math.max(a.double(), .25) * 0.2;
            const len = Math.sqrt(x * x + y * y + z * z);
            if (len < 0.01) {
                continue;
            }
            vertices.push(x / len, y / len, z / len, size, clr);
        }

        this.geom = builder.buildGeom();
    }

    // Draw
    draw(render: Renderer, delta : float) {
        const { geom } = this;

        this.brightness = this.getCurrentStarBrightness(render);

        if (this.brightness === 0) {
            return;
        }

        //TODO: use camera uniform struct
        this.shader.uniforms.u_projMatrix = render.globalUniforms.uniforms.u_projMatrix;
        this.shader.uniforms.u_viewMatrix = render.globalUniforms.uniforms.u_viewMatrix;
        this.shader.uniforms.u_resolution = render.globalUniforms.uniforms.u_resolution;

        this.shader.uniforms.u_sky_rotate = -this.world?.getTime().time_visible / GAME_DAY_SECONDS * (Math.PI * 2);
        const { pixiRender } = render.renderBackend;

        pixiRender.batch.flush();
        pixiRender.state.set(this.state);
        pixiRender.shader.bind(this.shader);
        pixiRender.geometry.bind(this.geom);
        pixiRender.geometry.draw(DRAW_MODES.TRIANGLES, 0, 0, geom.instanceCount);
    }

    destroy() {
        this.geom.destroy();
        this.geom = null;
    }
}
