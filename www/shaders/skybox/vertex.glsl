#include<header>

in vec3 a_vertex;

uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform float u_brightness;
uniform vec2 u_resolution;
uniform bool u_textureOn;

out vec3 v_texCoord;

void main() {

	gl_Position = u_projMatrix * u_viewMatrix * vec4(a_vertex, 1.0);
	v_texCoord = a_vertex;
}
