precision highp float;

attribute vec3 a_vertex;

uniform mat4 u_lookAtMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_brightness;
uniform vec2 u_resolution;
uniform bool u_textureOn;

varying vec3 v_texCoord;
varying vec4 crosshair;

void main() {

	gl_Position = u_projectionMatrix * u_lookAtMatrix * vec4(a_vertex, 1.0);
	v_texCoord = a_vertex;

	// Crosshair
    float cm = 0.00065;
    if(u_resolution.x > u_resolution.y) {
        crosshair = vec4(0., 0., u_resolution.x * cm, u_resolution.x * cm * 7.);
    } else {
        crosshair = vec4(0., 0., u_resolution.y * cm, u_resolution.y * cm * 7.);
    }

}
