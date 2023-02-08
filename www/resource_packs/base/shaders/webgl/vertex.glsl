#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

#include<terrain_attrs_vert>

float wing_speed = 2.5;
float wing_amplitude = 0.3;

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
    } else if (flagLookAtCameraHor > 0) {
        mat3 lookAtMat = inverse(mat3(u_worldView));
        axisX = lookAtMat * axisX.xzy;
    }

    // Animated textures
    if(flagAnimated > 0) {
        // v_color.b contain number of animation frames
        int frames = int(v_color.b);
        v_color.b = 1.0; // no mask_shift for you, sorry
        float t = ((u_time * float(frames) / 1.5) / 1000.);
        int i = int(t);
        uvCenter0.y += float(i % frames) / 64.;
        uvCenter1.y += float(i % frames) / 64.;
        // uvCenter1.y += float((i + 1) % frames) / 64.;
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
        v_axisU = normalize(axisX);
        v_axisV = normalize(axisY);
    } else {
        pos = a_position + (axisX * -a_quad.y) + (axisY * -a_quad.x);
        v_axisU = normalize(-axisY);
        v_axisV = normalize(-axisX);
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
    v_axisU *= sign(a_uvSize.x);
    v_axisV *= sign(a_uvSize.y);

    v_texClamp0 = vec4(uvCenter0 - abs(a_uvSize * 0.5) + u_pixelSize * 0.5, uvCenter0 + abs(a_uvSize * 0.5) - u_pixelSize * 0.5);
    v_texcoord1_diff = uvCenter1 - uvCenter0;

    if(u_fogOn) {
        if (flagBiome == 0) {
            v_color.a = 0.0;
        }
    }

    v_chunk_pos = (uModelMatrix *  vec4(pos, 1.0)).xyz;

    if(flagLeaves == 1 && (gl_VertexID == 1 || gl_VertexID == 0 || gl_VertexID == 3)) {
        float amp = wing_amplitude - wing_amplitude * (mod(v_chunk_pos.x + v_chunk_pos.z, 10.) / 10. * .95);
        float wind_shift = (sin((u_time / 1000. + (v_chunk_pos.x + v_chunk_pos.z) / 10.) * wing_speed)) * amp;
        v_chunk_pos.x += wind_shift;
        v_chunk_pos.y += wind_shift;
        // v_chunk_pos.y += sin((u_time / 1000. + v_chunk_pos.y) * wing_speed) * wing_amplitude;
        // v_chunk_pos.z += sin((u_time / 1000. + v_chunk_pos.z) * wing_speed) * wing_amplitude;
    }

    v_world_pos = v_chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);

    #include<ao_light_pass_vertex>

    if(v_Triangle >= .5 && gl_VertexID > 2) {
        gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    }
}