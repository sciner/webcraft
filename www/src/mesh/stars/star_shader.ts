import {Geometry, Program, Shader, Buffer, TYPES} from "vauxcel";

const vert = `
in vec3 a_coord;
in float a_noot_radius;
in vec4 a_color;
in vec2 a_quad;

out vec2 v_pixel;
out float v_pixel_radius;
out vec4 v_color;

uniform mat4 u_projMatrix;
uniform mat4 u_viewMatrix;
uniform vec2 u_resolution;
uniform float u_sky_rotate;

void main() {
    v_color = a_color;
    
    float cr = cos(u_sky_rotate);
    float sr = sin(u_sky_rotate);
    vec3 center = vec3(a_coord.xy * mat2(cr, sr, -sr, cr), a_coord.z);
    vec4 screen_center = u_projMatrix * u_viewMatrix * vec4(center.xzy, 0.0);
    
    if (screen_center.z < 0.1)
    {
        gl_Position = vec4(-1.0, -1.0, -1.0, 1.0);
        return;
    }
    vec2 pixel_center = (screen_center.xy / screen_center.w + 1.0) * 0.5 * u_resolution;
    
    v_pixel_radius = a_noot_radius * u_resolution.y * 0.01;
    
    v_pixel = a_quad * (v_pixel_radius + 0.5);
    gl_Position = vec4((pixel_center + v_pixel) * 2.0 / u_resolution - 1.0, 0.0, 1.0);
}
`;

const frag = `
in vec2 v_pixel;
in float v_pixel_radius;
in vec4 v_color;
out vec4 outColor;

uniform float u_sky_brightness;

void main() {
    float d = length(v_pixel);
    float rad = v_pixel_radius;
    
    // anti aliasing
    float circle_hor = max(min(rad, d + 0.5) - max(-rad, d - 0.5), 0.0);
    float circle_vert = min(rad * 2.0, 1.0);
    float alpha_circle = circle_hor * circle_vert;
    
    outColor = vec4(v_color.rgb, v_color.a * alpha_circle * u_sky_brightness);
}
`;

export class StarShader extends Shader {
    [key: string]: any; //TODO: remove when typing problem goes away
    constructor() {
        super(Program.from(vert, frag), {
            u_sky_brightness: 1,
            u_sky_rotate: 0,
        });
    }
}

export class StarGeometry extends Geometry {
    [key: string]: any; //TODO: remove when typing problem goes away
    strideFloats = 5;
    stride = this.strideFloats * 4;
    buffer = new Buffer(new Float32Array(), true, false);
    instanceCount = 0;

    constructor() {
        super();
        this.initGeom();
    }

    initGeom() {
        const {stride, buffer} = this;
        this.addAttribute('a_coord', buffer, 3, false,undefined, stride, 0, true);
        this.addAttribute('a_noot_radius', buffer, 1, false, undefined, stride, 3 * 4, true);
        this.addAttribute('a_color', buffer, 4, true, TYPES.UNSIGNED_BYTE, stride, 4 * 4, true);
        this.addAttribute('a_quad', StarGeometry.quadBuf, 2);
    }

    setVertices(vertices: Array<number>) {
        const { strideFloats } = this;
        const data = new Float32Array(vertices);
        const dataUint32 = new Uint32Array(data.buffer);
        this.instanceCount = 0;
        for (let i = 0; i < vertices.length; i += strideFloats) {
            dataUint32[i + 4] = vertices[i + 4];
            this.instanceCount++;
        }
        this.buffer.update(data);
    }

    static quadBuf = new Buffer(new Float32Array([
        -1, -1,
        1, -1,
        1, 1,
        -1, -1,
        1, 1,
        -1, 1]
    ), true);
}
