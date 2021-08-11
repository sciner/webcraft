attribute vec3 a_position;
attribute vec3 a_axisX;
attribute vec3 a_axisY;
attribute vec2 a_uvCenter;
attribute vec2 a_uvSize;
attribute vec3 a_color;
attribute vec4 a_occlusion;
attribute float a_flags;
attribute vec2 a_quad;
attribute vec4 a_quadOcc;

uniform mat4 uProjMatrix;
uniform mat4 u_worldView;
uniform mat4 uModelMatrix;
uniform bool u_fogOn;
uniform float u_brightness;
uniform vec3 u_add_pos;

varying vec3 v_position;
varying vec2 v_texcoord;
varying vec4 v_texClamp;
varying vec4 v_color;
varying vec3 v_normal;
varying float light;

void main() {
    v_color         = vec4(a_color, dot(a_occlusion, a_quadOcc));

    float flagNormalUp = step(0.5, a_flags);
    if (flagNormalUp > 0.0) {
        v_normal = -a_axisY;
    } else {
        v_normal = normalize(cross(a_axisX, a_axisY));
    }

    v_normal.yz = v_normal.zy;

    vec3 pos = a_position + (a_axisX * a_quad.x) + (a_axisY * a_quad.y);
    v_texcoord = a_uvCenter + (a_uvSize * a_quad);
    v_texClamp = vec4(a_uvCenter - abs(a_uvSize * 0.5) + 1.0 / 2048.0, a_uvCenter + abs(a_uvSize * 0.5) - 1.0 / 2048.0);

    vec3 sun_dir = vec3(0.7, 1.0, 0.85);
    vec3 n = normalize(v_normal);
    light = max(.5, dot(n, sun_dir) - v_color.a);

    if(u_fogOn) {
        gl_Position = uProjMatrix * u_worldView * (uModelMatrix * vec4(pos, 1.0));
        // 1. Pass the view position to the fragment shader
        v_position = (u_worldView * vec4(pos + u_add_pos, 1.0)).xyz;
    } else {
        gl_Position = uProjMatrix * u_worldView * ( uModelMatrix * vec4(pos, 1.0));
    }
}
