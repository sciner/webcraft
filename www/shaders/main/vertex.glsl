attribute vec3 a_position;
attribute vec2 a_texcoord;
attribute vec4 a_color;
attribute vec3 a_normal;

uniform mat4 uProjMatrix;
uniform mat4 u_worldView;
uniform mat4 uModelMatrix;
uniform bool u_fogOn;
uniform float u_brightness;

varying vec3 v_position;
varying vec2 v_texcoord;
varying vec4 v_color;
varying vec3 v_normal;
varying float light;

void main() {

    v_color = a_color;
    v_texcoord = a_texcoord;
    v_normal = a_normal;

    vec3 sun_dir = vec3(0.7, 1.0, 0.85);
    vec3 n = normalize(v_normal);
    light = max(.5, dot(n, sun_dir) - v_color.a);

    if(u_fogOn) {
        gl_Position = uProjMatrix * u_worldView * ( uModelMatrix * vec4(a_position, 1.0 ) );
        // 1. Pass the view position to the fragment shader
        v_position = (u_worldView * vec4(a_position, 1.0)).xyz;
    } else {
        gl_Position = uProjMatrix * u_worldView * ( uModelMatrix * vec4(a_position, 1.0));
    }
}