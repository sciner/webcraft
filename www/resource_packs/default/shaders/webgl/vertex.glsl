#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

#include<terrain_attrs_vert>

void main() {

    v_color         = vec4(a_color, 1.0);

    u_uvCenter = a_uvCenter;
    // Animated textures
    if(v_color.b > 1.) {
        // v_color.b contain number of animation frames
        u_uvCenter.y += (floor(mod((u_time * v_color.b / 3.) / 1000., v_color.b))) / 32.;
    }

    // find flags
    float flagBiome = step(1.5, a_flags);
    float flags = a_flags - flagBiome * 2.0;
    float flagNormalUp = step(0.5, flags);

    if (flagNormalUp > 0.0) {
        v_normal = -a_axisY;
    } else {
        v_normal = normalize(cross(a_axisX, a_axisY));
    }

	// Crosshair
    float cm = 0.00065;
    if(u_resolution.x > u_resolution.y) {
        crosshair = vec4(0., 0., u_resolution.x * cm, u_resolution.x * cm * 7.);
    } else {
        crosshair = vec4(0., 0., u_resolution.y * cm, u_resolution.y * cm * 7.);
    }

    v_normal = normalize((uModelMatrix * vec4(v_normal, 0.0)).xyz);

    vec3 pos = a_position + (a_axisX * a_quad.x) + (a_axisY * a_quad.y);

    v_texcoord = u_uvCenter + (a_uvSize * a_quad);

    v_texClamp = vec4(u_uvCenter - abs(a_uvSize * 0.5) + u_pixelSize * 0.5, u_uvCenter + abs(a_uvSize * 0.5) - u_pixelSize * 0.5);

    if(u_fogOn) {
        if (flagBiome < 0.5) {
            v_color.r = -1.0;
        }
    }

    chunk_pos = (uModelMatrix *  vec4(pos, 1.0)).xyz;
    world_pos = chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);
}