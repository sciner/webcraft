#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_frag>

#include<terrain_attrs_frag>

#include<crosshair_define_func>

#include<vignetting_define_func>

#include<manual_mip_define_func>

vec3 gamma(vec3 color){
    return pow(color, vec3(1.0/2.0));
}

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 sampleAtlassTextureNormal (vec2 texcoord, vec4 texClamp) {
    vec2 texCoord = clamp(texcoord, texClamp.xy, texClamp.zw);
    vec2 texc = texCoord.xy;

    vec4 mipData = manual_mip (texcoord, vec2(textureSize(u_normal, 0)));

    vec4 data = texture(u_normal, texc * mipData.zw + mipData.xy);

    vec3 normal = v_normal;

    if (data.a > 0.0) {
        normal = (data.xyz - 0.5) * 2.0;
        normal.x *= sign(v_uvSize.x);
        normal.y *= sign(-v_uvSize.y);

        normal = normalize((uModelMatrix * v_normalMatrix * vec4(normal, 0.0))).xyz;
    }

    return normal;
}

vec4 sampleAtlassTexture (vec2 texcoord, vec4 texClamp, vec2 biomPos) {
    vec2 texCoord = clamp(texcoord, texClamp.xy, texClamp.zw);
    vec2 texc = texCoord.xy;

    vec4 mipData = manual_mip (texcoord, vec2(textureSize(u_texture, 0)));

    vec4 color = texture(u_texture, texc * mipData.zw + mipData.xy);

    if (v_color.r >= 0.0) {
        vec4 color_mask = texture(u_texture, vec2(texc.x + u_blockSize * max(v_color.b, 1.), texc.y) * mipData.zw + mipData.xy);
        vec4 color_mult = texture(u_texture, biomPos);
        color.rgb += color_mask.rgb * color_mult.rgb;
    }

    return color;
}

void main() {

    vec2 texCoord = clamp(v_texcoord0, v_texClamp0.xy, v_texClamp0.zw);
    vec2 texc = texCoord.xy;

    vec2 biome = v_color.rg * (1. - 0.5 * step(0.5, u_mipmap));

    float light = 0.0;

    // Game
    if(u_fogOn) {

        // Read texture
        vec4 color = 
            mix(
                sampleAtlassTexture (v_texcoord0, v_texClamp0, biome),
                sampleAtlassTexture (v_texcoord1, v_texClamp1, biome),
                v_animInterp
            );

        // used for light pass
        vec3 normal = sampleAtlassTextureNormal (v_texcoord0, v_texClamp0);

        if(color.a < 0.1) discard;
        if (u_opaqueThreshold > 0.1) {
            if (color.a < u_opaqueThreshold) {
                discard;
            } else {
                color.a = 1.0;
            }
        }

        #include<local_light_pass>
        #include<ao_light_pass>
        #include<sun_light_pass>

        // Apply light
        color.rgb *= light;
        outColor = color;

        #include<fog_frag>
        #include<crosshair_call_func>
        #include<vignetting_call_func>

    } else {
        outColor = texture(u_texture, texc);
        if(outColor.a < 0.1) discard;
        outColor *= v_color;
    }

}