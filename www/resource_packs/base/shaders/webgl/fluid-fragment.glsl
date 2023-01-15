#include<header>
#define SHADER_NAME WaterShader
// how far caustic apply displace
#define CAUSTIC_DISPLACEMENT .1 
// minimal delta in depth for displace
// fix  a `cutting` a blocks that under water partially 
#define CAUSTIC_DISPLACEMENT_GAP .01

// how many reflection in water when it exist
#define WATER_REFLECTION_FACTOR 0.6

// how fast reflection is fadeout to edges where not data
#define WATER_REFLECTION_FADE 0.8

#include<constants>

#include<global_uniforms>
#include<global_uniforms_frag>

uniform mat4 uProjMatrix;

uniform vec4 u_fluidUV[2];

uniform sampler2D u_backTextureColor;
uniform sampler2D u_backTextureDepth;

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
in vec3 v_lookVector;
in vec3 v_tangentNormal;
in vec2 v_farNear;

in float v_noCanTakeAO;
in float v_noCanTakeLight;
in float v_flagMultiplyColor;

out vec4 outColor;

#include<crosshair_define_func>

#include<vignetting_define_func>

#include<manual_mip_define_func>

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

float linearizeDepth(float z) {
    float far = v_farNear.x;
    float near = v_farNear.y;
    return (2.0 * near) / (far + near - z * (far - near));
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
    sunNormalLight = dot(minecraftSun, v_normal * v_normal);

    // declare causticRes
    #include<caustic_pass_onwater>

    if(v_noCanTakeLight < 0.5) {
        #include<local_light_pass>
        #include<ao_light_pass>
        // Apply light
        color.rgb *= combinedLight * sunNormalLight;
    } else {
        color.rgb *= sunNormalLight;
    }


    outColor = color;

    #include<fog_frag>
    if(u_crosshairOn) {
        #include<crosshair_call_func>
    }
    #include<vignetting_call_func>

    vec2 backSize = vec2(textureSize(u_backTextureColor, 0));
    vec2 backUV =  gl_FragCoord.xy / backSize;

    vec2 offset = CAUSTIC_DISPLACEMENT * causticRes.xy;

    float backDepth = linearizeDepth(texture(u_backTextureDepth, backUV).r);
    float actualDepth = linearizeDepth(gl_FragCoord.z);
    float depthDiff = 10. * (backDepth - actualDepth) ;

    float displaceEdgeError = .02;
    float displaceErrorFactor= depthDiff < displaceEdgeError ? max(0.0, depthDiff / displaceEdgeError) : 1.0;

    vec2 colorBackUv = backUV + offset * displaceErrorFactor;

    vec4 refraction = texture(u_backTextureColor, colorBackUv, -0.5);
    vec4 reflection = vec4(0.0);

    /* ------------------ */
    vec3 ref = reflect(v_position, v_tangentNormal);

    vec4 ndc = uProjMatrix * vec4(ref, 1.0);
    ndc /= ndc.w;
    // ndc.y *= -1.0;

    vec2 ndc2d = (1. + ndc.xy) * 0.5 + offset * displaceErrorFactor;

    float DEBUG = 0.0;

    // fix me
    // projection problems
    // we clip a lot of data
    if (abs(v_normal.z) > 0.5) {
        bool isIn = abs(ndc2d.x  - 0.5) < 0.5 && abs(ndc2d.y - 0.5) < 0.5 && v_tangentNormal.y > 0.5;

        if (isIn) {
            reflection = texture(u_backTextureColor, ndc2d, -0.5);

            float factX = WATER_REFLECTION_FACTOR * (1. - smoothstep(WATER_REFLECTION_FADE, 1.0, ndc2d.y));
            float factY = 1. - smoothstep(WATER_REFLECTION_FADE, 1.0, abs(0.5 - ndc2d.x) * 2.0);

            reflection.a = factX * factY;
        } 
    }
    /* ----------------------- */

    float mixFactor = 1.0;

    vec4 rrcolor = mix(refraction, reflection, reflection.a);

    outColor = outColor * mixFactor + (1. - mixFactor * outColor.a) * rrcolor;
    
    if (DEBUG > 0.0) {
        outColor  = reflection;
    }
}