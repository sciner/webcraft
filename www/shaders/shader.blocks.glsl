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
    #define NORMAL_UP                   0
    #define MASK_BIOME                  1
    #define NO_AO                       2
    #define NO_FOG                      3
    #define FLAG_ANIMATED               5
    #define FLAG_TEXTURE_SCROLL         6
    #define NO_CAN_TAKE_AO              7
    #define QUAD_FLAG_OPACITY           8
    #define QUAD_FLAG_SDF               9
    #define NO_CAN_TAKE_LIGHT           10
    #define FLAG_MULTIPLY_COLOR         11
    #define FLAG_LEAVES                 12
    #define FLAG_ENCHANTED_ANIMATION    13
    #define FLAG_RAIN_OPACITY           14
    #define FLAG_MASK_COLOR_ADD         15
    #define FLAG_TORCH_FLAME            16
    #define FLAG_FLUID_ERASE            17
    #define DELIMITER_VERTEX     ((1 << 18) - 1)
    #define FLAG_WAVES_VERTEX           18
    #define LOOK_AT_CAMERA              19
    #define LOOK_AT_CAMERA_HOR          20
    #define FLAG_TRIANGLE               21
    #define FLAG_MIR2_TEX               22

#endif

#ifdef global_uniforms
    // global uniform block base
    uniform vec3 u_camera_pos;
    uniform ivec3 u_camera_posi; // absolute camera position
    // Fog
    uniform vec4 u_fogColor;
    uniform vec4 u_tintColor;
    uniform vec4 u_fogAddColor;
    uniform bool u_fogOn;
    uniform bool u_crosshairOn;
    uniform float u_chunkBlockDist;

    uniform float u_brightness;
    uniform float u_time;
    uniform float u_rain_strength;
    uniform vec2 u_resolution;
    uniform float u_eyeinwater;
    uniform vec3 u_shift;
    uniform vec4 u_SunDir;
    uniform float u_localLightRadius;
    uniform float u_aoDisaturateFactor;

    vec3 getCamPeriod() {
        return vec3(u_camera_posi % ivec3(1000)) + u_camera_pos;
    }

    bool checkFlag(int flag) {
        return (v_flags & (1 << flag)) != 0;
    }

#endif

#ifdef global_uniforms_frag
    // global uniforms fragment part
    uniform sampler2D u_texture;
    uniform sampler2D u_texture_n;
    uniform highp isampler3D u_lightTex;
    uniform vec3 u_lightOverride;
    uniform int u_lightMode;

    uniform float u_mipmap;
    uniform float u_blockSize;
    uniform float u_opaqueThreshold;
    uniform float u_useNormalMap;
    uniform sampler2D u_blockDayLightSampler;
    uniform sampler2D u_maskColorSampler;
    //--

#endif

#ifdef global_uniforms_vert
    // global uniforms vertex part
    uniform mat4 uProjMatrix;
    uniform mat4 u_worldView;
    uniform mat4 uModelMatrix;
    uniform int uModelMatrixMode;
    uniform vec3 u_add_pos;
    uniform float u_pixelSize;
    uniform highp isampler2D u_chunkDataSampler;
    uniform highp isampler3D u_gridChunkSampler;
    uniform vec3 u_gridChunkSize;
    uniform vec3 u_gridChunkOffset;
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
    in uint a_color;
    in uint a_flags;
    in vec2 a_quad;

    // please, replace all out with v_
    out vec3 v_world_pos;
    out vec3 v_chunk_pos;
    out vec3 v_position;
    out vec2 v_texcoord0;
    flat out vec2 v_texcoord1_diff;
    flat out vec4 v_texClamp0;
    flat out vec3 v_normal;
    flat out vec4 v_color;
    flat out float v_animInterp;
    flat out float v_lightId;
    flat out vec4 v_lightOffset;
    flat out vec3 v_aoOffset;

    // quad flags
    flat out int v_flags;

    //--
#endif

#ifdef terrain_attrs_frag
    // terrain shader attributes and varings
    in vec3 v_world_pos;
    in vec3 v_chunk_pos;
    in vec3 v_position;
    in vec2 v_texcoord0;
    flat in vec2 v_texcoord1_diff;
    flat in vec4 v_texClamp0;
    flat in vec3 v_normal;
    flat in vec4 v_color;
    flat in float v_animInterp;
    flat in float v_lightId;
    flat in vec4 v_lightOffset;

    // quad flags
    flat in int v_flags;
    float v_lightMode;

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
                outColor = vec4(1. - outColor.rgb, 1.);
        }
    }
    //--
#endif

#ifdef crosshair_call_func
    // Draw crosshair
    if (u_crosshairOn) {
        drawCrosshair();
    }
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
    // drawVignetting();
    //--
#endif

#ifdef torch_flame_func

    // Fire Flame shader

    // procedural noise from IQ
    vec2 tf_hash(vec2 p) {
        p = vec2( dot(p,vec2(127.1,311.7)),
                dot(p,vec2(269.5,183.3)) );
        return -1.0 + 2.0*fract(sin(p)*43758.5453123);
    }

    float tf_noise( in vec2 p ) {
        const float K1 = 0.366025404; // (sqrt(3)-1)/2;
        const float K2 = 0.211324865; // (3-sqrt(3))/6;

        vec2 i = floor( p + (p.x+p.y)*K1 );

        vec2 a = p - i + (i.x+i.y)*K2;
        vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0*K2;

        vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

        vec3 n = h*h*h*h*vec3( dot(a, tf_hash(i+0.0)), dot(b, tf_hash(i+o)), dot(c, tf_hash(i+1.0)));

        return dot( n, vec3(70.0) );
    }

    float tf_fbm(vec2 uv) {
        float f;
        mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
        f  = 0.5000 * tf_noise(uv); uv = m * uv;
        f += 0.2500 * tf_noise(uv); uv = m * uv;
        f += 0.1250 * tf_noise(uv); uv = m * uv;
        f += 0.0625 * tf_noise(uv); uv = m * uv;
        f = 0.5 + 0.5*f;
        return f;
    }

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

#ifdef shoreline_func

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
            -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

#endif

#ifdef raindrops_define_func
    vec2 randVec(float inVal) {
        return vec2(fract(sin(dot(vec2(inVal*1.1,2352.75053) ,vec2(12.9898,78.233))) * 43758.5453)-0.5,
            fract(sin(dot(vec2(715.23515, inVal) ,vec2(27.2311,31.651))) * 65161.6513)-0.5);
    }

    float randFloat(vec2 inVal) {
        return fract(sin(dot(vec2(inVal.x, inVal.y) ,vec2(89.4516,35.516))) * 13554.3651);
    }

    vec4 rainDrops(vec3 pos) {

        float iTime = u_time / 1000.;

        // Controls:
        float zoom = 0.6 + 0.46 * sin(iTime * 0.6);
        zoom = 1.0;
        float sharpness = 4.5 * zoom; // maybe plug in ddx and ddy here to mimic mip-mapping (avoid artifacts at long distances)
        // sharpness = 6.5; // uncomment this line to see when it's not "blurring" when zoomed out, crispy!
        float expansionSpeed = 4.0;
        float rainSpeed = 1.6;
        float numRings = 3.0;
        const float numIterations = 1.;
        float strength = 0.3;

        // other numbers:
        const float pi = 3.141592;
        float newTime = iTime * rainSpeed;

        vec2 uv;
        vec2 uvStep;
        vec4 resp = vec4(0.);
        for(float iterations = 0.; iterations < numIterations; iterations++) {
            for(float x = -1.; x <= 1.; x++) {
                for(float y = -1.; y <= 1.; y++) {

                    uv = pos.xy;
                    uv /= zoom;
                    uv += iterations * vec2(3.21, 2.561);
                    uv += vec2(x * 0.3333, y * 0.3333);
                    uvStep = (ceil((uv * 1.0 - vec2(.5, .5))) / 1.);
                    uvStep += vec2(x, y) * 100.;
                    uv = vec2(fract(uv.x + 0.5) - .5, fract(uv.y + 0.5) - .5);

                    // Variables:
                    float timeRand = randFloat(uvStep);
                    float timeLoop = fract(newTime+timeRand);
                    float timeIter = floor(newTime+timeRand);

                    /// Creating ringMap:
                    float ringMap = sharpness * 9. * distance(uv, randVec(timeIter+uvStep.x + uvStep.y) * 0.5);
                    // float ringMap = sharpness*9.*distance(uv, randVec(0.)*0.);
                    float clampMinimum = -(1. + ((numRings - 1.) * 2.0));
                    ringMap = clamp((ringMap - expansionSpeed * sharpness * timeLoop) + 1., clampMinimum, 1.);

                    // Rings and result
                    float rings = (cos((ringMap + newTime) * pi) + 1.0) / 2.;
                    rings *= pow(1. - timeLoop, 2.);
                    float bigRing = sin((ringMap - clampMinimum) / (1. - clampMinimum) * pi);
                    float result = rings * bigRing;
                    resp += vec4(result) * strength;

                }
            }
        }

        return resp;

    }
#endif

#ifdef fog_frag

    // Calc fog amount
    float fogDistance = length(v_world_pos.xyz);
    float fogFactorDiv = 1.0;
    if (checkFlag(NO_FOG)) {
        fogFactorDiv = 15.0;
    }
    float refBlockDist = u_chunkBlockDist * fogFactorDiv;
    float refBlockDist2 = 4. * fogFactorDiv;

    float fogFactor = 0.05 / fogFactorDiv;
    float fogFactor2 = 0.0025 / fogFactorDiv;

    float fogAmount = clamp(fogFactor * (fogDistance - refBlockDist), 0., 1.);
    fogAmount = fogAmount + fogFactor2 * (fogDistance - refBlockDist2);
    fogAmount = clamp(fogAmount, 0., 1.);

    // Apply fog
    outColor.rgb = mix(outColor.rgb, u_fogAddColor.rgb, u_fogAddColor.a * combinedLight);
    // outColor.rgb = u_fogAddColor.rgb + (1. - u_fogAddColor.a * combinedLight) * outColor.rgb;
    outColor = mix(outColor, vec4(u_fogColor.rgb, 1.), fogAmount);

    // special effect for sunrise
    outColor.rgb = mix(outColor.rgb, u_fogColor.rgb, u_fogColor.a);
    outColor.rgb = mix(outColor.rgb, u_tintColor.rgb, u_tintColor.a);

#endif

#ifdef terrain_read_flags_vert
    // read flags
    int flags = int(a_flags) & 0xffffff;
    v_flags = flags;
#endif

#ifdef terrain_read_flags_frag
    v_lightMode = 1.0 - float((v_flags >> NO_AO) & 1);
#endif

#ifdef sun_light_pass
    // sun light pass
    if (u_SunDir.w < 0.5) {
        float lighter = (1. - v_lightMode);
        vec3 minecraftSun = vec3(0.6 + lighter * .2, 0.8 + lighter * .1, 1.0);
        if (v_normal.z < 0.0) minecraftSun.z = 0.5 + lighter * .25;
        sunNormalLight = dot(minecraftSun, v_normal * v_normal);
    } else {
        // limit brightness to 0.2
        sunNormalLight = 1.0 + max(0., dot(v_normal, normalize(u_SunDir.xyz))) * u_brightness;
        combinedLight = vec3(1.0);
    }
    //--
#endif

#ifdef local_light_pass
    // local light from hand located object
    float lightDistance = distance(vec3(0., 0., 1.4), v_world_pos);
    float rad = u_localLightRadius;

    // max power is 16, we use a radious that half of it
    float initBright = rad / 16.;

    if(lightDistance < rad) {
        float percent = (1. - pow(lightDistance / rad, 1.) ) * initBright;

        playerLight = clamp(percent + playerLight, 0., 1.);
    }
    //--
#endif

#ifdef ao_light_pass_vertex
    ivec4 chunkData0 = ivec4(0, 0, 0, 0);
    ivec4 chunkData1 = ivec4(1 << 16, 1 << 16, 1 << 16, 0);
    if (a_chunkId < -0.5) {
        vec3 localPos = a_position;
        if (uModelMatrixMode > 0) {
            localPos = (uModelMatrix *  vec4(localPos.xzy, 1.0)).xzy;
        }
        vec3 chunkCoord = floor((localPos - u_gridChunkOffset) / u_gridChunkSize);
        chunk_corner = chunkCoord * u_gridChunkSize + u_gridChunkOffset;
        //TODO: use "-" here, 0 <= chunkCoord < 2 * gridTexSize
        ivec3 ts = textureSize(u_gridChunkSampler, 0);
        int chunkIntData = texelFetch(u_gridChunkSampler, ivec3(chunkCoord) % ts, 0).r;
        chunkData1.x = chunkIntData & 0x1ff;
        chunkData1.y = (chunkIntData >> 9) & 0x1ff;
        chunkData1.z = (chunkIntData >> 18) & 0x1ff;
        chunkData1.w = (chunkIntData >> 27) & 0xf;
        v_flags = v_flags | (1 << NO_AO);
    } else {
        int size = textureSize(u_chunkDataSampler, 0).x;
        int chunkId = int(a_chunkId);
        int dataX = chunkId * 2 % size;
        int dataY = (chunkId * 2 - dataX) / size;
        chunkData0 = texelFetch(u_chunkDataSampler, ivec2(dataX, dataY), 0);
        chunkData1 = texelFetch(u_chunkDataSampler, ivec2(dataX + 1, dataY), 0);

        add_pos = vec3(chunkData0.xzy - u_camera_posi) - u_camera_pos;
    }
    ivec3 lightRegionSize = chunkData1.xyz >> 16;
    ivec3 lightRegionOffset = chunkData1.xyz & 0xffff;
    v_lightOffset.xyz = vec3(lightRegionOffset);
    v_lightOffset.w = float(lightRegionSize.z);
    v_lightId = float(chunkData1.w);
#endif

#ifdef ao_light_define_func
#define LIGHT_SOLID_SHIFT 9
#define LIGHT_SOLID_MASK 3
#define LIGHT_AO_SHIFT 8
#define LIGHT_AO_MASK 3
int sampleCubeLight(ivec4 source, int shift) {
    int val = 0;
    if (shift >= 4) {
        if (shift >= 6) {
            val = source.w;
        } else {
            val = source.z;
        }
    } else {
        if (shift >= 2) {
            val = source.y;
        } else {
            val = source.x;
        }
    }
    if ((shift & 1) == 1) {
        return (val >> 16) & 0xffff;
    }
    return val & 0xffff;
}
#endif

#ifdef ao_light_pass
    // global illumination
    vec3 absNormal = abs(v_normal);
    vec3 signNormal = sign(v_normal);
    vec3 lightCoord = v_chunk_pos + 1.0 + v_lightOffset.xyz + v_normal * 0.01;
    int aoMask = 0;
    if (absNormal.x >= absNormal.y && absNormal.x >= absNormal.z) {
        aoMask = 6;
    } else if (absNormal.y >= absNormal.z) {
        aoMask = 5;
    } else {
        aoMask = 3;
    }
    //TODO: clamp?
    // lightCoord.z = clamp(lightCoord.z, 0.0, 0.5 - 0.5 / 84.0);
    // vec4 centerSample;

    vec3 texSize;
    if (u_lightOverride.z > 1.5) {
        centerSample.xy = u_lightOverride.xy;
    } else {
        if (v_lightId < 0.5) {
            // default light
        } else if (v_lightId < 1.5) {
            ivec3 lightCoordInt = ivec3(floor(lightCoord));
            ivec3 lightCoordHalf = lightCoordInt >> 1;
            ivec4 big0 = texelFetch(u_lightTex, lightCoordHalf, 0);
            int shift = (lightCoordInt.x & 1) | (lightCoordInt.y & 1) << 1 | (lightCoordInt.z & 1) << 2;
            int little0 = sampleCubeLight(big0, shift);
            if (u_lightMode > 0) {
                centerSample.x = float(little0 & 0x0f) / 15.0;
                centerSample.y = float((little0 >> 4) & 0x0f) / 15.0;
                centerSample.z = 0.0;
            } else {
                //TODO: this should be lowp
                vec3 lightPart = lightCoord - floor(lightCoord) - 0.5;
                ivec3 dirSign = ivec3(sign(lightPart));
                ivec3 dirStep = ivec3(step(vec3(0.0), lightPart));
                int dirShift = 7 ^ (dirStep.x + dirStep.y * 2 + dirStep.z * 4);
                int neibShift = shift ^ dirShift;
                ivec4 big1, big2, big3, big4;
                if ((neibShift & 1) != 0) {
                    big1 = texelFetch(u_lightTex, lightCoordHalf + ivec3(dirSign.x, 0, 0), 0);
                } else {
                    big1 = big0;
                }
                int little1 = sampleCubeLight(big1, shift ^ 1);
                if ((neibShift & 2) != 0) {
                    big2 = texelFetch(u_lightTex, lightCoordHalf + ivec3(0, dirSign.y, 0), 0);
                } else {
                    big2 = big0;
                }
                int little2 = sampleCubeLight(big2, shift ^ 2);
                if ((neibShift & 4) != 0) {
                    big4 = texelFetch(u_lightTex, lightCoordHalf + ivec3(0, 0, dirSign.z), 0);
                } else {
                    big4 = big0;
                }
                int little4 = sampleCubeLight(big4, shift ^ 4);

                vec4 part = vec4(abs(lightPart), 0.0);
                float aoPart;

                if (aoMask == 3) {
                    aoPart = part.x * float((little1 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK)
                        + part.y * float((little2 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK)
                        - part.x * part.y * float(((little1 & little2) >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK);
                } else if (aoMask == 5) {
                    aoPart = part.x * float((little1 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK)
                        + part.z * float((little4 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK)
                        - part.x * part.z * float(((little1 & little4) >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK);
                } else if (aoMask == 6) {
                    aoPart = part.y * float((little2 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK)
                        + part.z * float((little4 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK)
                        - part.y * part.z * float(((little2 & little4) >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK);
                }

                ivec2 mainVec = ivec2(little0 & 0x0f, little0 & 0xf0);
                ivec4 caveGrad, dayGrad;
                if (((little1 >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_MASK) == 0) {
                    caveGrad.x = sign((little1 & 0x0f) - mainVec.x);
                    dayGrad.x = sign((little1 & 0xf0) - mainVec.y);
                } else {
                    part.x = 0.0;
                }
                if (((little2 >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_MASK) == 0) {
                    caveGrad.y = sign((little2 & 0x0f) - mainVec.x);
                    dayGrad.y = sign((little2 & 0xf0) - mainVec.y);
                } else {
                    part.y = 0.0;
                }
                if (((little4 >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_MASK) == 0) {
                    caveGrad.z = sign((little4 & 0x0f) - mainVec.x);
                    dayGrad.z = sign((little4 & 0xf0) - mainVec.y);
                } else {
                    part.z = 0.0;
                }

                if (aoMask == 6) {
                    if ((((little2 | little4) >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_MASK) == 0) {
                        ivec4 big6;
                        if ((neibShift & 6) == 6) {
                            big6 = texelFetch(u_lightTex, lightCoordHalf + ivec3(0, dirSign.y, dirSign.z), 0);
                        } else {
                            if ((neibShift & 2) != 0) {
                                big6 = big2;
                            } else {
                                big6 = big4;
                            }
                        }
                        int little6 = sampleCubeLight(big6, shift ^ 6);
                        if (((little6 >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_SHIFT) == 0) {
                            caveGrad.w = sign((little6 & 0x0f) - mainVec.x);
                            dayGrad.w = sign((little6 & 0xf0) - mainVec.y);
                        }
                        caveGrad.w -= caveGrad.y + caveGrad.z;
                        dayGrad.w -= dayGrad.y + dayGrad.z;
                        part.w = part.y * part.z;
                        if (aoMask == 6) {
                            aoPart += 2.0 * part.w * float((little6 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK);
                        }
                    }
                }
                if (aoMask == 5) {
                    if ((((little1 | little4) >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_MASK) == 0) {
                        ivec4 big5;
                        if ((neibShift & 5) == 5) {
                            big5 = texelFetch(u_lightTex, lightCoordHalf + ivec3(dirSign.x, 0, dirSign.z), 0);
                        } else {
                            if ((neibShift & 1) != 0) {
                                big5 = big1;
                            } else {
                                big5 = big4;
                            }
                        }
                        int little5 = sampleCubeLight(big5, shift ^ 5);
                        if (((little5 >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_SHIFT) == 0) {
                            caveGrad.w = sign((little5 & 0x0f) - mainVec.x);
                            dayGrad.w = sign((little5 & 0xf0) - mainVec.y);
                        }
                        caveGrad.w -= caveGrad.x + caveGrad.z;
                        dayGrad.w -= dayGrad.x + dayGrad.z;
                        part.w = part.x * part.z;
                        if (aoMask == 5) {
                            aoPart += 2.0 * part.w * float((little5 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK);
                        }
                    }
                }
                if (aoMask == 3) {
                    if ((((little1 | little2) >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_MASK) == 0) {
                        ivec4 big3;
                        if ((neibShift & 3) == 3) {
                            big3 = texelFetch(u_lightTex, lightCoordHalf + ivec3(dirSign.x, dirSign.y, 0), 0);
                        } else {
                            if ((neibShift & 1) != 0) {
                                big3 = big1;
                            } else {
                                big3 = big2;
                            }
                        }
                        int little3 = sampleCubeLight(big3, shift ^ 3);
                        if (((little3 >> LIGHT_SOLID_SHIFT) & LIGHT_SOLID_SHIFT) == 0) {
                            caveGrad.w = sign((little3 & 0x0f) - mainVec.x);
                            dayGrad.w = sign((little3 & 0xf0) - mainVec.y);
                        }
                        caveGrad.w -= caveGrad.y + caveGrad.x;
                        dayGrad.w -= dayGrad.y + dayGrad.x;
                        part.w = part.x * part.y;
                        if (aoMask == 3) {
                            aoPart += 2.0 * part.w * float((little3 >> LIGHT_AO_SHIFT) & LIGHT_AO_MASK);
                        }
                    }
                }
                centerSample.x = clamp((float(mainVec.x) + dot(vec4(caveGrad), part)) / 15.0, 0.0, 1.0);
                centerSample.y = clamp((float(mainVec.y >> 4) + dot(vec4(dayGrad), part)) / 15.0, 0.0, 1.0);
                centerSample.z = aoPart / 3.0;
            }
            //if (v_lightMode > 0.5) {
            //    aoVector = vec4(texture(u_lightTex[0], aoCoord0 * texSize).w, texture(u_lightTex[0], aoCoord1 * texSize).w,
            //        texture(u_lightTex[0], aoCoord2 * texSize).w, texture(u_lightTex[0], aoCoord3 * texSize).w);
            //}
        }
        if (u_lightOverride.z > 0.5) {
            centerSample.xy = u_lightOverride.xy;
        }
    }

    float caveSample = centerSample.x;
    float daySample = 1.0 - centerSample.y;

    float cavePart = max(caveSample, playerLight);
    float dayPart = daySample * u_brightness;
    float sumCaveDay = cavePart + dayPart;
    vec2 lutCoord = vec2(cavePart, dayPart);
    lutCoord = (clamp(lutCoord, 0.0, 1.0) * 15.0 + 0.5) / 32.0;
    vec3 lutColor = texture(u_blockDayLightSampler, lutCoord).rgb;

    if (sumCaveDay < 0.01) {
        sumCaveDay = 0.01;
    }
    if (sumCaveDay > 1.0) {
        sumCaveDay = 1.0;
        cavePart = sumCaveDay - dayPart;
    }

    float aoSample = 0.0;
    if (v_lightMode > 0.5) {
        aoSample = centerSample.z;
        if (aoSample > 0.5) { aoSample = aoSample * 0.5 + 0.25; }
        aoSample *= aoFactor;
    }

    /*float gamma = 0.5;
    caveSample = pow(caveSample, 1.0 / gamma);*/

    combinedLight = lutColor * (1.0 - aoSample);
#endif

#ifdef normal_light_vert_varying
flat out vec3 v_axisU;
flat out vec3 v_axisV;
#endif

#ifdef normal_light_frag_varying
flat in vec3 v_axisU;
flat in vec3 v_axisV;
#endif

#ifdef normal_light_vert
if(!checkFlag(FLAG_MIR2_TEX)) {
    v_axisU = normalize(axisX);
    v_axisV = normalize(axisY);
} else {
    v_axisU = normalize(-axisY);
    v_axisV = normalize(-axisX);
}
v_axisU *= sign(a_uvSize.x);
v_axisV *= sign(a_uvSize.y);
#endif

#ifdef normal_light_pass
    const vec3 cubeArr[8] = vec3[8] (
        vec3(0.0, 0.0, 0.0),
        vec3(1.0, 0.0, 0.0),
        vec3(0.0, 1.0, 0.0),
        vec3(1.0, 1.0, 0.0),
        vec3(0.0, 0.0, 1.0),
        vec3(1.0, 0.0, 1.0),
        vec3(0.0, 1.0, 1.0),
        vec3(1.0, 1.0, 1.0)
    );

    vec3 caveNormal = vec3(0.0);
    vec3 normalCoord = lightCoord - 0.5 + vec3(0.0, 0.0, v_lightOffset.w * 0.5);
    vec3 normalCenter = floor(normalCoord);
    vec3 interp = normalCoord - normalCenter;
    ivec3 iCoord[8];
    for (int i = 0; i < 8; i++) {
        iCoord[i] = ivec3(normalCenter + cubeArr[i]);
    }

    vec4 normalSample[8];

    if (v_lightId < 0.5) {
    } else if (v_lightId < 1.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[0], iCoord[i], 0);
        }
    } else if (v_lightId < 2.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[1], iCoord[i], 0);
        }
    } else if (v_lightId < 3.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[2], iCoord[i], 0);
        }
    } else if (v_lightId < 4.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[3], iCoord[i], 0);
        }
    } else if (v_lightId < 5.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[4], iCoord[i], 0);
        }
    } else if (v_lightId < 6.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[5], iCoord[i], 0);
        }
    } else if (v_lightId < 7.5) {
        for (int i = 0; i < 8; i++) {
            normalSample[i] = texelFetch(u_lightTex[6], iCoord[i], 0);
        }
    }

    float total = 0.0;
    for (int i = 0; i < 8; i++) {
        if (normalSample[i].w > 0.5) {
            float weight = (cubeArr[7-i].x * (1.0 - interp.x) + cubeArr[i].x * interp.x)
                * (cubeArr[7-i].y * (1.0 - interp.y) + cubeArr[i].y * interp.y)
                * (cubeArr[7-i].z * (1.0 - interp.z) + cubeArr[i].z * interp.z);
            vec3 norm = (normalSample[i].xyz * 255.0 - 128.0) / 8.0;
            norm += vec3(iCoord[i]) - normalCoord;
            norm += max(0.0, -dot(norm, v_normal)) * v_normal;
            caveNormal += norm * weight;
            total += weight;
        }
    }
    if (total >= 0.01) {
        caveNormal /= total;
    } else {
        caveNormal = vec3(0.0);
    }

    uvNormal = normalize(uvNormal);
    vec3 surfaceNormal = v_axisU * uvNormal.x + v_axisV * uvNormal.y + v_normal * uvNormal.z;
    caveNormal += v_normal;

    combinedLight = lutColor;

    dayPart /= sumCaveDay;
    cavePart = min(1.5 * cavePart, 1.0) / sumCaveDay;

    combinedLight *= dayPart * sunNormalLight * (1.0 - aoSample)
        + cavePart * max(0.5, dot(caveNormal, surfaceNormal) / length(caveNormal))
        * (1.0 - aoSample * 0.5);
    //  + cavePart * abs(caveNormal) / length(caveNormal);
    sunNormalLight = 1.0;
#endif

#ifdef caustic_pass_onwater
    vec2 pc = (v_world_pos.xy + getCamPeriod().xy) * 64.;

    mat3 m = mat3(-2,-1,2, 3,-2,1, 1,2,2);
    vec3 a = vec3( pc / 4e2, (u_time / 2000.) / 4. ) * m,
         b = a * m * .4,
         c1 = b * m * .3;
    vec4 k = vec4(pow(
          min(min(   length(.5 - fract(a)),
                     length(.5 - fract(b))
                  ), length(.5 - fract(c1)
             )), 7.) * 25.);

    k.rgb *= vec3(182./255., 235./255., 255./255.);
    color.rgb += k.rgb / 2.;
#endif

// Enchanted animation
#ifdef enchanted_animation

    vec3 cam_period = getCamPeriod();
    vec2 vert = vec2(cam_period.z / 2., cam_period.z / 2.) + vec2(v_world_pos.z / 2., v_world_pos.z / 2. + u_time / 2000.);
    vec2 pc = (v_texcoord0.xy + v_world_pos.xy + cam_period.xy + vert.xy) * 256.;

    mat3 m = mat3(-2,-1,2, 3,-2,1, 1,2,2);
    vec3 a = vec3( pc / 4e2, (u_time / 1000.) / 4. ) * m,
         b = a * m * .4,
         c1 = b * m * .3;
    vec4 k = vec4(pow(
          min(min(   length(.5 - fract(a)),
                     length(.5 - fract(b))
                  ), length(.5 - fract(c1)
             )), 7.) * 25.);

    color.rgb += k.rgb * vec3(1.5, 0., 6.);

#endif

// VERSION1
#ifdef caustic1_pass

    vec3 cam_period = getCamPeriod();
    vec2 vert = vec2(cam_period.z / 2., cam_period.z / 2.) + vec2(v_world_pos.z / 2., v_world_pos.z / 2.);
    vec2 pc = (v_texcoord0.xy + v_world_pos.xy + cam_period.xy + vert.xy) * 64.;

    mat3 m = mat3(-2,-1,2, 3,-2,1, 1,2,2);
    vec3 a = vec3( pc / 4e2, (u_time / 2000.) / 4. ) * m,
         b = a * m * .4,
         c1 = b * m * .3;
    vec4 k = vec4(pow(
          min(min(   length(.5 - fract(a)),
                     length(.5 - fract(b))
                  ), length(.5 - fract(c1)
             )), 7.) * 25.);

    color.rgb += k.rgb;

#endif

// VERSION2
#ifdef caustic2_pass

    #define TAU 6.28318530718
    #define MAX_ITER 3

	float time = (u_time / 1000.) + 23.0;
    // uv should be the 0-1 uv of texture...
	vec2 uv = v_texcoord0.xy * 50.; // / u_resolution.xy * 4.;
    vec2 p = mod(uv * TAU, TAU) - 250.0;

	vec2 i = vec2(p);
	float c = 1.0;
	float inten = .005;

	for (int n = 0; n < MAX_ITER; n++) {
		float t = time * (1.0 - (3.5 / float(n + 1)));
		i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
		c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
	}
	c /= float(MAX_ITER);
	c = 1.17 - pow(c, 1.4);
	vec3 colour = vec3(pow(abs(c), 8.0));
    colour = clamp(colour + vec3(0.0, 0.35, 0.5), 0.0, 1.0);
    color.rgb *= colour.rgb;

#endif

#ifdef raindrops_onwater
    if(u_rain_strength > 0.) {
        vec3 cam_period2 = getCamPeriod();
        vec3 pos = vec3(v_world_pos.xy + cam_period2.xy, 0.);
        // pixelate
        // pos = round(pos / (1./32.)) * (1./32.);
        color.rgb += rainDrops(pos * 2.).rgb * u_rain_strength;
    }
#endif

#ifdef shoreline
    // water lighter
    float water_lighter_limit = .02;
    if(centerSample.z > water_lighter_limit) {
        // if(centerSample.z > .4) {
        //     color.rgb += 1.;
        // }
        float m = centerSample.z < .03 ? 1. - (.03 - centerSample.z) / .01 : 1.;
        // float water_lighter = min(centerSample.z / water_lighter_limit, .1);
        vec3 cam_period = getCamPeriod();
        float x = v_world_pos.x + cam_period.x;
        float y = v_world_pos.y + cam_period.y;
        // color.rgb += water_lighter * 1.25;
        color.rgb += min((max(snoise(vec2(x, y) * 10. + u_time / 1000.), 0.) / 2.) * 2., 1.) * m / 5.;
    }
#endif

#ifdef waves_vertex_func

    float getWaveValue() {
        vec3 cam_period = getCamPeriod();
        float x = v_world_pos.x + cam_period.x;
        float y = v_world_pos.y + cam_period.y;
        float waves_amp = 30.;
        float waves_freq = 10.;
        return sin(u_time / 500. + x * waves_freq) / waves_amp +
               cos(u_time / 500. + y * waves_freq) / waves_amp;
    }

#endif

#ifdef swamp_fog
    // swamp fog
    vec3 cam_period4 = getCamPeriod();
    float z = v_world_pos.z + cam_period4.z;
    float start_fog = 81.;
    float fog_height = 3.;
    float mul = .5;
    float a = mul;
    if(z <= start_fog + fog_height) {
        if(z >= start_fog) {
            a = clamp((1. - (z - start_fog) / fog_height) * mul, .0, 1.);
        }
        float dist = distance(vec3(0., 0., 1.4), v_world_pos) / 8.;
        a *= clamp(dist, 0., 1.);
        color.rgb = mix(color.rgb, vec3(.2, .4, .0), a);
    }
#endif

#ifdef torch_flame

    // vec3 cam_period6 = getCamPeriod();
    // vec2 bpos6 = round(v_world_pos.xy + cam_period6.xy);
    // float add_time6 = (bpos6.x * 10. + bpos6.y * 10.);
    float iTime = ((u_time /*+ add_time */) / 1000.);

    float flame_frame = .6;
    // TODO: depends on bbmodel texture size
    float tex_scale = 3072. / 8.;
    vec2 uv = v_texcoord0;
    vec2 flame_pixelate = vec2(5., 1.) * 96.;
    uv = vec2(mod(uv.x * tex_scale, 1.) / 5. + flame_frame, mod(uv.y * -tex_scale, 1.));
    uv = round(uv * flame_pixelate) / flame_pixelate;

    vec2 q = uv;
    q.x *= 5.;
    q.y *= 2.;
    float strength = floor(q.x + 1.);
    float T3 = max(3., 1.25 * strength) * (iTime / 1.5);
    q.x = mod(q.x, 1.) - 0.5;
    q.y -= 0.25;
    float n = tf_fbm(strength * q - vec2(0, T3));
    float c = 1. - 16. * pow(max(0., length(q * vec2(1.8 + q.y * 1.5, .75)) - n * max(0., q.y + .25)), 1.2);
    // float c1 = n * c * (1.5 - pow(1.25 * uv.y, 4.));
    float c1 = n * c * (1.5 - pow(1.250 * uv.y, 4.));
    c1 = clamp(c1, 0., 1.);
    vec3 col = vec3(1.5*c1, 1.5*c1*c1*c1, c1*c1*c1*c1*c1*c1);
    // col = col.zyx; // blue flame
    // col = 0.85*col.yxz; // green flame

    float a = c * (1. - pow(uv.y, 3.));
    color.rgba = vec4(mix(vec3(0.), col, a), a);

#endif