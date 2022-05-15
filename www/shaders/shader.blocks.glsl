// we can't coment in block, because version must be a first command
#ifdef header
    #version 300 es
    precision highp float;
    precision highp int;
    precision mediump sampler3D;
    //--
#endif

#ifdef constants
    // basic constans block
    #define LOG2 1.442695
    #define PI 3.14159265359
    #define desaturateFactor 2.0
    #define aoFactor 1.0
    #define CHUNK_SIZE vec3(18.0, 18.0, 84.0)

    // bit shifts
    #define NORMAL_UP_FLAG 0
    #define MASK_BIOME_FLAG 1
    #define NO_AO_FLAG 2
    #define NO_FOG_FLAG 3
    #define LOOK_AT_CAMERA 4
    #define FLAG_ANIMATED 5
#endif

#ifdef global_uniforms
    // global uniform block base
    uniform vec3 u_camera_pos;
    uniform ivec3 u_camera_posi;
    // Fog
    uniform vec4 u_fogColor;
    uniform vec4 u_tintColor;
    uniform vec4 u_fogAddColor;
    uniform bool u_fogOn;
    uniform float u_chunkBlockDist;

    //
    uniform float u_brightness;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec3 u_shift;
    uniform bool u_TestLightOn;
    uniform vec4 u_SunDir;
    uniform float u_localLightRadius;
    uniform float u_aoDisaturateFactor;
    //--
#endif

#ifdef global_uniforms_frag
    // global uniforms fragment part
    uniform sampler2D u_texture;
    uniform sampler2D u_normal;
    uniform lowp sampler3D[10] u_lightTex;
    uniform vec3 u_lightSize;

    uniform mat4 uModelMatrix;

    uniform float u_mipmap;
    uniform float u_blockSize;
    uniform float u_opaqueThreshold;
    //--

#endif

#ifdef global_uniforms_vert
    // global uniforms vertex part
    uniform mat4 uProjMatrix;
    uniform mat4 u_worldView;
    uniform mat4 uModelMatrix;
    uniform vec3 u_add_pos;
    uniform float u_pixelSize;
    uniform highp isampler2D u_chunkDataSampler;
    uniform ivec4 u_lightOffset;
    //--
#endif

#ifdef terrain_attrs_vert
    // terrain shader attributes and varyings
    in float a_chunkId;
    in vec3 a_position;
    in vec3 a_axisX;
    in vec3 a_axisY;
    in vec2 a_uvCenter;
    in vec2 a_uvSize;
    in vec3 a_color;
    in float a_flags;
    in vec2 a_quad;

    // please, replace all out with v_
    out vec3 v_world_pos;
    out vec3 v_chunk_pos;
    out vec3 v_position;
    out vec2 v_texcoord0;
    out vec2 v_texcoord1;
    out vec4 v_texClamp0;
    out vec4 v_texClamp1;
    out vec3 v_normal;
    out vec4 v_color;
    out vec2 v_uvCenter0;
    out vec2 v_uvCenter1;
    out float v_animInterp;
    out float v_lightMode;
    out float v_useFog;
    out float v_lightId;
    out vec4 v_lightOffset;
    out vec3 v_aoOffset;

    flat out mat4 v_normalMatrix;
    flat out vec2 v_uvSize;

    //--
#endif

#ifdef terrain_attrs_frag
    // terrain shader attributes and varings
    in vec3 v_position;
    in vec2 v_texcoord0;
    in vec2 v_texcoord1;
    in vec4 v_texClamp0;
    in vec4 v_texClamp1;
    in vec4 v_color;
    in vec3 v_normal;
    in float v_fogDepth;
    in vec3 v_world_pos;
    in vec3 v_chunk_pos;
    in vec2 v_uvCenter0;
    in vec2 v_uvCenter1;
    in float v_animInterp;
    in float v_lightMode;
    in float v_useFog;
    in float v_lightId;
    in vec4 v_lightOffset;

    flat in mat4 v_normalMatrix;
    flat in vec2 v_uvSize;

    out vec4 outColor;
#endif

#ifdef sample_texture_define_func
    // sample
    float ()
#endif

#ifdef crosshair_define_func
    // crosshair draw block
    void drawCrosshair() {
        float cm = 0.0008;
        vec4 crosshair;

        if(u_resolution.x > u_resolution.y) {
            crosshair = vec4(0., 0., u_resolution.x * cm, u_resolution.x * cm * 7.);
        } else {
            crosshair = vec4(0., 0., u_resolution.y * cm, u_resolution.y * cm * 7.);
        }

        float w = u_resolution.x;
        float h = u_resolution.y;
        float x = gl_FragCoord.x;
        float y = gl_FragCoord.y;
        if((x > w / 2.0 - crosshair.w && x < w / 2.0 + crosshair.w &&
            y > h / 2.0 - crosshair.z && y < h / 2.0 + crosshair.z) ||
            (x > w / 2.0 - crosshair.z && x < w / 2.0 + crosshair.z &&
            y > h / 2.0 - crosshair.w && y < h / 2.0 + crosshair.w)
            ) {
                outColor.r = 1.0 - outColor.r;
                outColor.g = 1.0 - outColor.g;
                outColor.b = 1.0 - outColor.b;
                outColor.a = 1.0;
        }
    }
    //--
#endif

#ifdef crosshair_call_func
    // Draw crosshair
    drawCrosshair();
    //--
#endif

#ifdef vignetting_define_func
    // vignetting
    const float outerRadius = .65, innerRadius = .25, intensity = .5;
    const vec3 vignetteColor = vec3(0.0, 0.0, 0.0); // red

    // vignetting draw block
    void drawVignetting() {
        vec2 relativePosition = gl_FragCoord.xy / u_resolution - .5;
        relativePosition.x *= (u_resolution.x / u_resolution.y) * .5;
        float len = length(relativePosition);
        float vignette = smoothstep(outerRadius, innerRadius, len);
        float vignetteOpacity = smoothstep(innerRadius, outerRadius, len) * intensity; // note inner and outer swapped to switch darkness to opacity
        outColor.rgb = mix(outColor.rgb, vignetteColor, vignetteOpacity);
    }
    //--
#endif

#ifdef vignetting_call_func
    // apply vignette to render result
    drawVignetting();
    //--
#endif

#ifdef manual_mip_define_func
    vec4 manual_mip (vec2 coord, vec2 size) {
        vec2 mipOffset = vec2(0.0);
        vec2 mipScale = vec2(1.0);

        // apply manual mip
        if (u_mipmap > 0.0) {

            // manual implementation of EXT_shader_texture_lod
            vec2 fw = fwidth(coord) * float(size);
            fw /= 1.4;
            vec4 steps = vec4(step(2.0, fw.x), step(4.0, fw.x), step(8.0, fw.x), step(16.0, fw.x));
            mipOffset.x = dot(steps, vec4(0.5, 0.25, 0.125, 0.0625));
            mipScale.x = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
            steps = vec4(step(2.0, fw.y), step(4.0, fw.y), step(8.0, fw.y), step(16.0, fw.y));
            mipOffset.y = dot(steps, vec4(0.5, 0.25, 0.125, 0.0625));
            mipScale.y = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
        }

        return vec4(mipOffset, mipScale);
    }
#endif

#ifdef fog_frag
    // Calc fog amount
    float fogDistance = length(v_world_pos.xy);
    float fogAmount = 0.;
    float fogFactorDiv = max(1.0,  (1. - v_useFog) * 15.);
    float refBlockDist = u_chunkBlockDist * fogFactorDiv;
    float fogFactor = 0.05 / fogFactorDiv;

    fogAmount = clamp(fogFactor * (fogDistance - refBlockDist), 0., 1.);

    // Apply fog
    outColor.rgb = mix(outColor.rgb, u_fogAddColor.rgb, u_fogAddColor.a * light);
    outColor = mix(outColor, vec4(u_fogColor.rgb, 1.), fogAmount);

    // special effect for sunrise
    outColor.rgb = mix(outColor.rgb, u_fogColor.rgb, u_fogColor.a);
    outColor.rgb = mix(outColor.rgb, u_tintColor.rgb, u_tintColor.a);

#endif

#ifdef terrain_read_flags_vert
    // read flags
    int flags = int(a_flags);
    int flagNormalUp = (flags >> NORMAL_UP_FLAG)  & 1;
    int flagBiome = (flags >> MASK_BIOME_FLAG) & 1;
    int flagNoAO = (flags >> NO_AO_FLAG) & 1;
    int flagNoFOG = (flags >> NO_FOG_FLAG) & 1;
    int flagLookAtCamera = (flags >> LOOK_AT_CAMERA) & 1;
    int flagAnimated = (flags >> FLAG_ANIMATED) & 1;

    v_useFog    = 1.0 - float(flagNoFOG);
    v_lightMode = 1.0 - float(flagNoAO);
    //--
#endif

#ifdef sun_light_pass
    // sun light pass
    if (u_SunDir.w < 0.5) {
        if(normal.x != 0.) {
            light = light * .95;
        } else if(normal.y != 0.) {
            light = light * .6;
        }
    } else {
        // limit brightness to 0.2
        light += max(0., dot(normal, normalize(u_SunDir.xyz))) * u_brightness;
    }
    //--
#endif

#ifdef local_light_pass
    vec3 dir = normalize(-v_world_pos);
    float lightDistance = length(v_world_pos);
    float rad = u_localLightRadius;

    // max power is 16, we use a radious that half of it
    float initBright = rad / 16.;

    if(lightDistance < rad) {
        float percent = (1. - pow(lightDistance / rad, 1.) ) * initBright * max(0., dot(normal, dir));

        light = clamp(percent + light, 0., 1.);
    }
    //--
#endif

#ifdef ao_light_pass_vertex
    ivec4 chunkData0 = ivec4(0, 0, 0, 0);
    ivec4 chunkData1 = ivec4(1 << 16, 1 << 16, 1 << 16, 0);
    if (a_chunkId < -0.5) {
        chunkData1.xy = u_lightOffset.xy;
        chunkData1.z = (int(u_lightOffset.w) << 16) + int(u_lightOffset.z);
    } else {
        int size = textureSize(u_chunkDataSampler, 0).x;
        int chunkId = int(a_chunkId);
        int dataX = chunkId * 2 % size;
        int dataY = (chunkId * 2 - dataX) / size;
        chunkData0 = texelFetch(u_chunkDataSampler, ivec2(dataX, dataY), 0);
        chunkData1 = texelFetch(u_chunkDataSampler, ivec2(dataX + 1, dataY), 0);

        v_world_pos = (vec3(chunkData0.xzy - u_camera_posi) - u_camera_pos) + v_chunk_pos;
        v_position = (u_worldView * vec4(v_world_pos, 1.0)). xyz;
        gl_Position = uProjMatrix * vec4(v_position, 1.0);
    }
    ivec3 lightRegionSize = chunkData1.xyz >> 16;
    ivec3 lightRegionOffset = chunkData1.xyz & 0xffff;
    v_lightOffset.xyz = vec3(lightRegionOffset);
    v_lightOffset.w = float(lightRegionSize.z);
    v_lightId = float(chunkData1.w);
#endif

#ifdef ao_light_pass
    // global illumination
    vec3 absNormal = abs(normal);
    vec3 lightCoord = v_chunk_pos + 0.5 + v_lightOffset.xyz;
    vec3 aoCoord = v_chunk_pos + (normal + absNormal + 1.0) * 0.5 + vec3(0.0, 0.0, 0.5 * v_lightOffset.w) + v_lightOffset.xyz;
    //TODO: clamp?

    // lightCoord.z = clamp(lightCoord.z, 0.0, 0.5 - 0.5 / 84.0);
    vec2 caveDaySample;
    vec3 aoVector;

    if (v_lightId < 0.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[0], 0));
        caveDaySample = texture(u_lightTex[0], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[0], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 1.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[1], 0));
        caveDaySample = texture(u_lightTex[1], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[1], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 2.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[2], 0));
        caveDaySample = texture(u_lightTex[2], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[2], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 3.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[3], 0));
        caveDaySample = texture(u_lightTex[3], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[3], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 4.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[4], 0));
        caveDaySample = texture(u_lightTex[4], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[4], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 5.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[5], 0));
        caveDaySample = texture(u_lightTex[5], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[5], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 6.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[6], 0));
        caveDaySample = texture(u_lightTex[6], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[6], aoCoord * texSize).rgb;
        }
    } else if (v_lightId < 7.5) {
        vec3 texSize = vec3(1.0) / vec3(textureSize(u_lightTex[7], 0));
        caveDaySample = texture(u_lightTex[7], lightCoord * texSize).rb;
        if (v_lightMode > 0.5) {
            aoVector = texture(u_lightTex[7], aoCoord * texSize).rgb;
        }
    }
    float caveSample = caveDaySample.x;
    float daySample = 1.0 - caveDaySample.y;

    float aoSample = 0.0;
    if (v_lightMode > 0.5) {
        aoSample = dot(aoVector, absNormal);
        if (aoSample > 0.5) { aoSample = aoSample * 0.5 + 0.25; }
        aoSample *= aoFactor;
    }

    float gamma = 0.5;
    caveSample = pow(caveSample, 1.0 / gamma);

    caveSample = caveSample * (1.0 - aoSample);
    daySample = daySample * (1.0 - aoSample - max(-v_normal.z, 0.0) * 0.2);

    float totalAO = caveSample + daySample * u_brightness;
    totalAO = max(light, totalAO);
    totalAO = min(totalAO, 1.0 - aoSample);
    totalAO = max(totalAO, 0.075 * (1.0 - aoSample));

    light = mix(totalAO, light, u_aoDisaturateFactor);
    //--
#endif
