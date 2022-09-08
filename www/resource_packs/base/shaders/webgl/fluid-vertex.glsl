#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

// 4 liquids max
uniform ivec4 u_fluidUV[4];
uniform uint u_fluidFlags[4];
uniform uint u_fluidFrames[4];

in uint a_chunkId;
in uint a_fluidId;
in vec3 a_position;
in vec2 a_uv;
in uint a_color;
in uint a_flags;

// please, replace all out with v_
out vec3 v_world_pos;
out vec3 v_chunk_pos;
out vec3 v_position;
out vec2 v_texcoord0;
out vec2 v_texcoord1_diff;
out vec3 v_normal;
out vec4 v_color;
out float v_animInterp;
out float v_lightMode;
out float v_useFog;
out float v_lightId;
out vec4 v_lightOffset;
out vec3 v_aoOffset;

// quad flags
out float v_noCanTakeAO;
out float v_noCanTakeLight;
out float v_flagMultiplyColor;

void main() {
    int flags = u_fluidFlags[a_fluidId];
    int flagNoAO = (flags >> NO_AO_FLAG) & 1;
    int flagNoFOG = (flags >> NO_FOG_FLAG) & 1;
    int flagAnimated = (flags >> FLAG_ANIMATED) & 1;
    int flagScroll = (flags >> FLAG_TEXTURE_SCROLL) & 1;
    int flagNoCanTakeAO = (flags >> NO_CAN_TAKE_AO) & 1;
    int flagFlagOpacity = (flags >> QUAD_FLAG_OPACITY) & 1;
    int flagQuadSDF = (flags >> QUAD_FLAG_SDF) & 1;
    int flagNoCanTakeLight = (flags >> NO_CAN_TAKE_LIGHT) & 1;

    v_useFog    = 1.0 - float(flagNoFOG);
    v_lightMode = 1.0 - float(flagNoAO);
    v_noCanTakeAO = float(flagNoCanTakeAO);
    v_noCanTakeLight = float(flagNoCanTakeLight);
    v_flagMultiplyColor = float(flagMultiplyColor);

    v_color = vec4(float(a_color & uint(0x3ff)),
        float((a_color >> 10) & uint(0x3ff)),
        a_color >> 20, 1.0);

    vec2 uv0 = a_uv;
    vec2 uv1 = a_uv;
    v_animInterp = 0.0;

    // Animated textures
    if(flagAnimated > 0) {
        // v_color.b contain number of animation frames
        int frames = int(u_fluidFrames[a_fluidId]);
        float t = ((u_time * float(frames) / 3.) / 1000.);
        int i = int(t);
        uvCenter0.y += float(i % frames) / 32.;
        uvCenter1.y += float((i + 1) % frames) / 32.;
        v_animInterp = fract(t);
    }

    v_normal = vec3(0.0, 1.0, 0.0);
    v_normal = normalize((uModelMatrix * vec4(v_normal, 0.0)).xyz);

    vec3 pos = a_position;

    // Scrolled textures
    if (flagScroll > 0) {
        float shift = (u_time / 1000.0) % 1.0;
        uv0.y += shift;
        uv1.y += shift;
    }

    //
    v_texcoord0 = uvCenter0 + a_uvSize * a_quad;
    v_axisU *= sign(a_uvSize.x);
    v_axisV *= sign(a_uvSize.y);

    v_texcoord1_diff = uv1 - uv0;

    v_chunk_pos = (uModelMatrix *  vec4(pos, 1.0)).xyz;
    v_world_pos = v_chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);

    #include<ao_light_pass_vertex>

}