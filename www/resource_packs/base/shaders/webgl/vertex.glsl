#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

#include<terrain_attrs_vert>

void main() {
    #include<terrain_read_flags_vert>

    v_color = vec4(float(a_color & uint(0x3ff)),
        float((a_color >> 10) & uint(0x3ff)),
        a_color >> 20, 1.0);
    vec2 uvCenter0 = a_uvCenter;
    vec2 uvCenter1 = a_uvCenter;
    v_animInterp = 0.0;

    vec3 axisX = a_axisX;
    vec3 axisY = a_axisY;

    if (flagLookAtCamera > 0) {
        mat3 lookAtMat = inverse(mat3(u_worldView));
        axisX = lookAtMat * axisX.xzy;
        axisY = lookAtMat * axisY.xzy;
    }

    // Animated textures
    if(flagAnimated > 0) {
        // v_color.b contain number of animation frames
        float frames = v_color.b;
        v_color.b = 1.0; // no mask_shift for you, sorry
        float t = ((u_time * frames / 3.) / 1000.);
        float i = floor(t);
        uvCenter0.y += mod(i, frames) / 32.;
        uvCenter1.y += mod(i + 1., frames) / 32.;
        v_animInterp = fract(t);
    }

    //
    if (flagNormalUp == 1) {
        v_normal = -axisY;
    } else {
        v_normal = normalize(cross(axisX, axisY));
    }

    v_normal = normalize((uModelMatrix * vec4(v_normal, 0.0)).xyz);

    vec3 pos;
    if(v_Mir2_Tex < .5) {
        pos = a_position + (axisX * a_quad.x) + (axisY * a_quad.y);
    } else {
        pos = a_position + (axisX * -a_quad.y) + (axisY * -a_quad.x);
    }

    // Scrolled textures
    if (flagScroll > 0) {
        vec2 sz = vec2(128.0, 512.0);
        uvCenter0.x += u_time / 1000.0 * v_color.r / sz.x;
        uvCenter1.x += u_time / 1000.0 * v_color.r / sz.x;
        uvCenter0.y -= u_time / 1000.0 * v_color.g / sz.y;
        uvCenter1.y -= u_time / 1000.0 * v_color.g / sz.y;
    }

    //
    v_texcoord0 = uvCenter0 + a_uvSize * a_quad;
    v_texClamp0 = vec4(uvCenter0 - abs(a_uvSize * 0.5) + u_pixelSize * 0.5, uvCenter0 + abs(a_uvSize * 0.5) - u_pixelSize * 0.5);
    v_texcoord1_diff = uvCenter1 - uvCenter0;

    if(u_fogOn) {
        if (flagBiome == 0) {
            v_color.a = 0.0;
        }
    }

    v_chunk_pos = (uModelMatrix *  vec4(pos, 1.0)).xyz;
    v_world_pos = v_chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);
    if(v_Triangle >= .5 && gl_VertexID > 2) {
        gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    }

    #include<ao_light_pass_vertex>

}