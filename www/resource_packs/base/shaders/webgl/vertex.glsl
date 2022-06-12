#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

#include<terrain_attrs_vert>

void main() {
    #include<terrain_read_flags_vert>

    v_color = vec4(a_color, 1.0);
    vec2 uvCenter0 = a_uvCenter;
    vec2 uvCenter1 = a_uvCenter;
    v_animInterp = 0.0;

    vec3 axisX = a_axisX;
    vec3 axisY = a_axisY;

    if (flagLookAtCamera > 0) {
        mat3 lookAtMat = inverse(mat3(u_worldView));
        axisX = lookAtMat * axisX.xzy * a_color.r;
        axisY = lookAtMat * axisY.xzy * a_color.r;
    }

    // Animated textures
    if(flagAnimated > 0) {
        // v_color.b contain number of animation frames
        float disc = v_color.b - 1.;
        float t = ((u_time * v_color.b / 3.) / 1000.);
        float i = floor(t);

        uvCenter0.y += (abs(mod(i, disc * 2.) - disc)) / 32.;
        uvCenter1.y += (abs(mod(i + 1.0, disc * 2.) - disc)) / 32.;
        v_animInterp = fract(t);
    }

    //
    if (flagNormalUp == 1) {
        v_normal = -axisY;
    } else {
        v_normal = normalize(cross(axisX, axisY));
    }

    v_normal = normalize((uModelMatrix * vec4(v_normal, 0.0)).xyz);

    vec3 pos = a_position + (axisX * a_quad.x) + (axisY * a_quad.y);

    // Scrolled textures
    uvCenter0.y += float(flagScroll) * (u_time * v_color.g);
    uvCenter1.y += float(flagScroll) * (u_time * v_color.g);

    //
    v_texcoord0 = uvCenter0 + a_uvSize * a_quad;
    v_texClamp0 = vec4(uvCenter0 - abs(a_uvSize * 0.5) + u_pixelSize * 0.5, uvCenter0 + abs(a_uvSize * 0.5) - u_pixelSize * 0.5);
    v_texcoord1_diff = uvCenter1 - uvCenter0;

    if(u_fogOn) {
        if (flagBiome == 0) {
            v_color.r = -1.0;
        }
    }

    v_chunk_pos = (uModelMatrix *  vec4(pos, 1.0)).xyz;
    v_world_pos = v_chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);

    #include<ao_light_pass_vertex>
}