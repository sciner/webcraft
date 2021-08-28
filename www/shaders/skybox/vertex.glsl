precision highp float;

attribute vec3 a_vertex;

uniform mat4 u_lookAtMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_brightness_value;
uniform vec2 u_resolution;

varying vec3 v_texCoord;

varying vec4 crosshair;

void main() {

	gl_Position = u_projectionMatrix * u_lookAtMatrix * vec4(a_vertex, 1.0);
	v_texCoord = a_vertex;

	// Crosshair
    if(u_resolution.x > u_resolution.y) {
        crosshair = vec4(0., 0., u_resolution.x * 0.001, u_resolution.x * 0.001 * 7.);
    } else {
        crosshair = vec4(0., 0., u_resolution.y * 0.001, u_resolution.y * 0.001 * 7.);
    }

}
