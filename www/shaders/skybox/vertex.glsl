#include<header>

in vec3 a_vertex;

uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform float u_brightness;
uniform vec2 u_resolution;
uniform bool u_textureOn;

out vec3 v_texCoord;

void main() {
	// remove translation factor from matrix
	mat4 lookMatrix = u_viewMatrix;
	lookMatrix[3] = vec4(0., 0., 0., 1.);

	// flip axes
	vec4 corrPos = vec4(a_vertex.xzy, 1.0);

	gl_Position = u_projMatrix * lookMatrix * corrPos;
	v_texCoord = a_vertex;
}
