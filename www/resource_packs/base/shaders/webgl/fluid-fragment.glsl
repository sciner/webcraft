#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_frag>

uniform vec4 u_fluidUV[2];

in vec3 v_position;
in vec2 v_texcoord0;
in vec4 v_fluidAnim;
in vec4 v_color;
in vec3 v_normal;
in float v_fogDepth;
in vec3 v_world_pos;
in vec3 v_chunk_pos;
in float v_lightMode;
in float v_useFog;
in float v_lightId;
in vec4 v_lightOffset;

in float v_noCanTakeAO;
in float v_noCanTakeLight;
in float v_flagMultiplyColor;

out vec4 outColor;

#include<crosshair_define_func>

#include<vignetting_define_func>

#include<manual_mip_define_func>

vec2 randVec(float inVal) {
    return vec2(fract(sin(dot(vec2(inVal*1.1,2352.75053) ,vec2(12.9898,78.233))) * 43758.5453)-0.5,
           fract(sin(dot(vec2(715.23515, inVal) ,vec2(27.2311,31.651))) * 65161.6513)-0.5);
}

float randFloat(vec2 inVal) {
    return fract(sin(dot(vec2(inVal.x, inVal.y) ,vec2(89.4516,35.516))) * 13554.3651);
}

vec4 rainDrops(vec3 pos, vec2 fragCoord) {

    float iTime = u_time / 1000.;
    fragCoord = fragCoord * 10.; // + pos.xy * 10.;

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
    for(float iterations = 0.; iterations < numIterations; iterations++){
        for(float xpos = -1.;xpos<=1.;xpos++){
            for(float ypos = -1.;ypos<=1.;ypos++){
                uv = (2.*fragCoord.xy - pos.xy) / pos.y;
                uv /= zoom;
                uv += iterations*vec2(3.21,2.561);
                uv += vec2(xpos*0.3333,ypos*0.3333);
                uvStep = (ceil((uv*1.0-vec2(.5,.5)))/1.);
                uvStep += vec2(xpos,ypos)*100.;
                uv = vec2(fract(uv.x+0.5)-.5,fract(uv.y+0.5)-.5);

                // Variables:
                float timeRand = randFloat(uvStep);
                float timeLoop = fract(newTime+timeRand);
                float timeIter = floor(newTime+timeRand);

                /// Creating ringMap:
                float ringMap = sharpness*9.*distance(uv, randVec(timeIter+uvStep.x+uvStep.y)*0.5);
                // float ringMap = sharpness*9.*distance(uv, randVec(0.)*0.);
                float clampMinimum = -(1.+((numRings-1.)*2.0));
                ringMap = clamp((ringMap-expansionSpeed*sharpness*(timeLoop))+1., clampMinimum, 1.);

                // Rings and result
                float rings = (cos((ringMap+newTime)*pi)+1.0)/2.;
                rings *= pow(1.-timeLoop,2.);
                float bigRing = sin((ringMap-clampMinimum)/(1.-clampMinimum)*pi);
                float result = rings * bigRing;
                resp += vec4(result) * strength;
            }
        }
    }

    return resp;

}

vec4 sampleAtlassTexture (vec4 mipData, vec2 texClamped, ivec2 biomPos) {
    vec2 texc = texClamped;

    vec4 color = texture(u_texture, texc * mipData.zw + mipData.xy);

    if (v_color.a > 0.0) {
        float mask_shift = v_color.b;
        vec4 color_mask = texture(u_texture, vec2(texc.x + u_blockSize * max(mask_shift, 1.), texc.y) * mipData.zw + mipData.xy);
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        color.rgb += color_mask.rgb * color_mult.rgb;
    } else if (v_flagMultiplyColor > 0.0) {
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        color.rgb *= color_mult.rgb;
    }

    return color;
}

void main() {
    vec2 size = vec2(textureSize(u_texture, 0));
    int fluidId = int(round(v_fluidAnim.x));
    vec2 fluidSubTexSize = u_fluidUV[fluidId].xy;
    vec2 texClamped = clamp(v_texcoord0 - floor(v_texcoord0), 0.001, 0.999) * fluidSubTexSize + u_fluidUV[fluidId].zw;
    vec4 mipData = vec4(0.0, 0.0, 1.0, 1.0);
    ivec2 biome = ivec2(0.0);
    vec4 color = vec4(0.0);
    float playerLight = 0.0, sunNormalLight = 1.0;
    vec3 combinedLight = vec3(1.0);

    // Game
    if(u_fogOn) {
        // default texture fetch pipeline

        mipData = manual_mip(v_texcoord0 * fluidSubTexSize, size);
        biome = ivec2(round(v_color.rg));
        color = sampleAtlassTexture (mipData, texClamped + vec2(0.0, v_fluidAnim.y), biome);
        if (v_fluidAnim.w > 0.0) {
            color = mix(
                color,
                sampleAtlassTexture (mipData, texClamped + vec2(0.0, v_fluidAnim.z), biome),
                v_fluidAnim.w
            );
        }

        vec3 minecraftSun = vec3(0.6, 0.8, 1.0);

        if (v_normal.z < 0.0) minecraftSun.z = 0.5;
        float sunNormalLight = dot(minecraftSun, v_normal * v_normal);

        #include<caustic_pass_onwater>

        if(v_noCanTakeLight < 0.5) {
            #include<local_light_pass>
            #include<ao_light_pass>
            // Apply light
            color.rgb *= combinedLight * sunNormalLight;
        } else {
            color.rgb *= sunNormalLight;
        }

        //
        vec3 cam_period2 = vec3(u_camera_posi % ivec3(400)) + u_camera_pos;
        float x = v_world_pos.x + cam_period2.x;
        float y = v_world_pos.y + cam_period2.y;
        vec3 pos = vec3(x, y, 0.) / 10.;
        color.rgb += rainDrops(pos, v_texcoord0).rgb;

        outColor = color;

        #include<fog_frag>
        if(u_crosshairOn) {
            #include<crosshair_call_func>
        }
        #include<vignetting_call_func>

    } else {
        outColor = texture(u_texture, texClamped);
        if(outColor.a < 0.1) discard;
        outColor *= v_color;
    }

}