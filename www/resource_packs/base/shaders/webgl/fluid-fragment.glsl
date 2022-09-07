#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_frag>

in vec3 v_position;
in vec2 v_texcoord0;
in vec2 v_texcoord1_diff;
in vec4 v_color;
in vec3 v_normal;
in float v_fogDepth;
in vec3 v_world_pos;
in vec3 v_chunk_pos;
in float v_animInterp;
in float v_lightMode;
in float v_useFog;
in float v_lightId;
in vec4 v_lightOffset;

in float v_noCanTakeAO;
in float v_noCanTakeLight;
in float v_flagMultiplyColor;

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

void main() {

    vec2 size = vec2(textureSize(u_texture, 0));
    vec2 texClamped = clamp(v_texcoord0, v_texClamp0.xy, v_texClamp0.zw);
    vec4 mipData = vec4(0.0, 0.0, 1.0, 1.0);
    ivec2 biome = ivec2(0.0);
    vec4 color = vec4(0.0);
    float playerLight = 0.0, sunNormalLight = 1.0;
    vec3 combinedLight = vec3(1.0);

    // Game
    if(u_fogOn) {
        // default texture fetch pipeline

        mipData = manual_mip(v_texcoord0, size);
        biome = ivec2(round(v_color.rg));
        color = sampleAtlassTexture (mipData, texClamped, biome);

        if (v_animInterp > 0.0) {
            color = mix(
                color,
                sampleAtlassTexture (mipData, texClamped + v_texcoord1_diff, biome),
                v_animInterp
            );
        }

        if(v_noCanTakeLight < 0.5) {
            #include<local_light_pass>
            #include<ao_light_pass>
            if(v_noCanTakeAO == .0) {
                #include<sun_light_pass>
            }
            // Apply light
            color.rgb *= combinedLight * sunNormalLight;
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