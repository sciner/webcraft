#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

#include<terrain_attrs_vert>

void main() {
    #include<terrain_read_flags_vert>

    v_color = vec4(a_color, 1.0);
    v_uvCenter = a_uvCenter;

    // Animated textures
    if(v_color.b > 1.) {
        // v_color.b contain number of animation frames
        float disc = v_color.b - 1.;
        float i = floor((u_time * v_color.b / 3.) / 1000.);
        v_uvCenter.y += (abs(mod(i, disc * 2.) - disc)) / 32.;
    }

    if (flagNormalUp == 1) {
        v_normal = -a_axisY;
    } else {
        v_normal = normalize(cross(a_axisX, a_axisY));
    }

    v_normal = normalize((uModelMatrix * vec4(v_normal, 0.0)).xyz);

    vec3 pos = a_position + (a_axisX * a_quad.x) + (a_axisY * a_quad.y);

    v_texcoord = v_uvCenter + (a_uvSize * a_quad);

    v_texClamp = vec4(v_uvCenter - abs(a_uvSize * 0.5) + u_pixelSize * 0.5, v_uvCenter + abs(a_uvSize * 0.5) - u_pixelSize * 0.5);

    if(u_fogOn) {
        if (flagBiome == 0) {
            v_color.r = -1.0;
        }
    }

    v_chunk_pos = (uModelMatrix *  vec4(pos, 1.0)).xyz;
    v_world_pos = v_chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);
}