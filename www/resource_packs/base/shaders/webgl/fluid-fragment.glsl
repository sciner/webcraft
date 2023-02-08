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
#include<raindrops_define_func>
#include<shoreline_func>

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
    vec4 centerSample;

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
        #include<raindrops_onwater>

        if(v_noCanTakeLight < 0.5) {
            #include<local_light_pass>
            #include<ao_light_pass>
            #include<shoreline>
            // Apply light
            color.rgb *= (combinedLight * sunNormalLight);
        } else {
            color.rgb *= sunNormalLight;
        }

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