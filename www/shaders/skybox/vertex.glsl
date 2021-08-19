precision highp float;

attribute vec3 a_vertex;

uniform mat4 u_lookAtMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_brightness_value;

varying vec3 v_texCoord;

void main() {
	gl_Position = u_projectionMatrix * u_lookAtMatrix * vec4(a_vertex, 1.0);
	v_texCoord = a_vertex;
}
