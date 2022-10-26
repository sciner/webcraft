#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

// 4 liquids max
uniform int u_fluidFlags[2];
uniform vec4 u_fluidUV[2];
uniform int u_fluidFrames[2];

in float a_chunkId;
in uint a_fluidId;
in vec3 a_position;
in uint a_color;

// please, replace all out with v_
out vec3 v_world_pos;
out vec3 v_chunk_pos;
out vec3 v_position;
out vec2 v_texcoord0;
out vec4 v_fluidAnim;
out vec3 v_normal;
out vec4 v_color;
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
    uint fluidId = a_fluidId & uint(3);
    int fluidSide = int(a_fluidId >> 2) & 7;
    int blockIndex = int(a_fluidId >> 5);
    // TODO: write chunk size somewhere, not related to light!
    vec3 blockPos = vec3(
        float(blockIndex % 18) - 1.0,
        float((blockIndex / 18) % 18) - 1.0,
        float(blockIndex / (18 * 18)) - 1.0
    );

    int flags = u_fluidFlags[fluidId];
    int flagNoAO = (flags >> NO_AO_FLAG) & 1;
    int flagNoFOG = (flags >> NO_FOG_FLAG) & 1;
    int flagAnimated = (flags >> FLAG_ANIMATED) & 1;
    int flagScroll = (flags >> FLAG_TEXTURE_SCROLL) & 1;
    int flagNoCanTakeAO = (flags >> NO_CAN_TAKE_AO) & 1;
    int flagNoCanTakeLight = (flags >> NO_CAN_TAKE_LIGHT) & 1;
    int flagMultiplyColor = (flags >> FLAG_MULTIPLY_COLOR) & 1;

    v_useFog    = 1.0 - float(flagNoFOG);
    v_lightMode = 1.0 - float(flagNoAO);
    v_noCanTakeAO = float(flagNoCanTakeAO);
    v_noCanTakeLight = float(flagNoCanTakeLight);
    v_flagMultiplyColor = float(flagMultiplyColor);

    v_color = vec4(float(a_color & uint(0x3ff)),
        float((a_color >> 10) & uint(0x3ff)),
        a_color >> 20, 0.0);

    v_fluidAnim.x = float(fluidId);
    if(flagAnimated > 0) {
        int frames = u_fluidFrames[fluidId];
        float t = ((u_time * float(frames) / 3.) / 1000.);
        int i = int(t);
        v_fluidAnim.y = float(i % frames) * u_fluidUV[fluidId].y;
        v_fluidAnim.z = float((i + 1) % frames) * u_fluidUV[fluidId].y;
        v_fluidAnim.w = fract(t);
    }

    if (fluidSide == 2 || fluidSide == 3) {
        v_normal = vec3(0.0, 1.0, 0.0);
        v_texcoord0 = a_position.xz;
    } else if (fluidSide == 4 || fluidSide == 5) {
        v_normal = vec3(1.0, 0.0, 0.0);
        v_texcoord0 = a_position.yz;
    } else if (fluidSide == 1) {
        v_normal = vec3(0.0, 0.0, -1.0);
        v_texcoord0 = a_position.xy;
    } else {
        v_normal = vec3(0.0, 0.0, 1.0);
        v_texcoord0 = a_position.xy;
    }

    // Scrolled textures
    if (flagScroll > 0 || v_color.b > 0.0) {
        v_texcoord0.y += mod(u_time / 1000.0, 1.0);
    }

    v_chunk_pos = a_position + blockPos;
    v_world_pos = v_chunk_pos + u_add_pos;
    v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);

    #include<ao_light_pass_vertex>
}