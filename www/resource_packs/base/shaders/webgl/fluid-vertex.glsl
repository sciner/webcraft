#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_vert>

// 4 liquids max
uniform int u_fluidFlags[2];
uniform vec4 u_fluidUV[2];
uniform int u_fluidFrames[2];

in uint a_blockId;
in uint a_fluidId;
in float a_height;
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

const vec3 cubeVert[24] = vec3[24] (
// up
    vec3(0.0, 1.0, 1.0),
    vec3(1.0, 1.0, 1.0),
    vec3(1.0, 0.0, 1.0),
    vec3(0.0, 0.0, 0.0),
// down
    vec3(0.0, 1.0, 0.0),
    vec3(1.0, 1.0, 0.0),
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, 0.0, 0.0),
    // south
    vec3(0.0, 0.0, 1.0),
    vec3(1.0, 0.0, 1.0),
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, 0.0, 0.0),
    // north
    vec3(1.0, 1.0, 1.0),
    vec3(0.0, 1.0, 1.0),
    vec3(0.0, 1.0, 0.0),
    vec3(1.0, 1.0, 0.0),
    // east
    vec3(1.0, 0.0, 1.0),
    vec3(1.0, 1.0, 1.0),
    vec3(1.0, 1.0, 0.0),
    vec3(1.0, 0.0, 0.0),
    // west
    vec3(0.0, 1.0, 1.0),
    vec3(0.0, 0.0, 1.0),
    vec3(0.0, 0.0, 0.0),
    vec3(0.0, 1.0, 0.0)
);

const vec3 cubeNorm[6] = vec3[6] (
    vec3(0.0, 0.0, 1.0),
    vec3(0.0, 0.0, -1.0),
    vec3(0.0, -1.0, 0.0),
    vec3(0.0, 1.0, 0.0),
    vec3(1.0, 0.0, 0.0),
    vec3(-1.0, 0.0, 0.0)
);

#include<waves_vertex_func>

void main() {
// gl_VertexID
// blockId pass start
    ivec4 chunkData0 = ivec4(0, 0, 0, 0);
    ivec4 chunkData1 = ivec4(1 << 16, 1 << 16, 1 << 16, 0);
    int chunkId = int(a_blockId >> 16);
    int size = textureSize(u_chunkDataSampler, 0).x;
    int dataX = chunkId * 2 % size;
    int dataY = (chunkId * 2 - dataX) / size;
    chunkData0 = texelFetch(u_chunkDataSampler, ivec2(dataX, dataY), 0);
    chunkData1 = texelFetch(u_chunkDataSampler, ivec2(dataX + 1, dataY), 0);

    ivec3 lightRegionSize = chunkData1.xyz >> 16;
    ivec3 lightRegionOffset = chunkData1.xyz & 0xffff;
    v_lightOffset.xyz = vec3(lightRegionOffset);
    v_lightOffset.w = float(lightRegionSize.z);
    v_lightId = float(chunkData1.w);

    uint fluidId = a_fluidId & uint(3);
    int cubeSide = int(a_fluidId >> 2) & 7;
    int epsShift = int(a_fluidId >> 5) & 63;
    int blockIndex = int(a_blockId) & 0xffff;
    int iSize = chunkData0.w;
    ivec3 chunkSize = ivec3(iSize & 0xff, (iSize >> 8) & 0xff, (iSize >> 16) & 0xff);
    ivec3 outerSize = chunkSize + 2;
    // TODO: write chunk size somewhere, not related to light!
    vec3 blockPos = vec3(
        float(blockIndex % outerSize.x) - 1.0,
        float((blockIndex / outerSize.x) % outerSize.y) - 1.0,
        float(blockIndex / (outerSize.x * outerSize.y)) - 1.0
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

    vec3 subPos = cubeVert[cubeSide * 4 + gl_VertexID % 4];
    subPos.z = a_height;

    if (epsShift > 0) {
        for (int i = 0; i < 6; i++) {
            // EPS correction
            if ((epsShift & (1 << i)) > 0 && dot(subPos - vec3(0.1), cubeNorm[i]) > 0.0) {
                subPos += cubeNorm[i] * 0.01;
            }
        }
    }

    v_normal = cubeNorm[cubeSide];
    if (cubeSide == 2 || cubeSide == 3) {
        v_texcoord0 = subPos.xz;
    } else if (cubeSide == 4 || cubeSide == 5) {
        v_texcoord0 = subPos.yz;
    } else {
        v_texcoord0 = subPos.xy;
    }
    // Scrolled textures
    if (flagScroll > 0 || v_color.b > 0.0) {
        v_texcoord0.y += mod(u_time / 1000.0, 1.0);
    }

    v_chunk_pos = blockPos + subPos;

    v_world_pos = (vec3(chunkData0.xzy - u_camera_posi) - u_camera_pos) + v_chunk_pos;

    // Waves
    v_world_pos.z += getWaveValue();

    v_position = (u_worldView * vec4(v_world_pos, 1.0)).xyz;
    gl_Position = uProjMatrix * vec4(v_position, 1.0);
}