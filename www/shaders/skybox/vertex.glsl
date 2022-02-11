#include<header>

in vec3 a_vertex;

#include<global_uniforms_ubo>

out vec3 v_texCoord;

void main() {
	// remove translation factor from matrix
	mat4 lookMatrix = u_worldView;
	lookMatrix[3] = vec4(0., 0., 0., 1.);

	// flip axes
	vec4 corrPos = vec4(a_vertex.xzy, 1.0);

	gl_Position = uProjMatrix * lookMatrix * corrPos;
	v_texCoord = a_vertex;
}
