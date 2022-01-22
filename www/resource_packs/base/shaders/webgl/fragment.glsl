#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_frag>

#include<terrain_attrs_frag>

#include<crosshair_define_func>

#include<vignetting_define_func>

vec3 gamma(vec3 color){
    return pow(color, vec3(1.0/2.0));
}

void main() {

    vec2 texCoord = clamp(v_texcoord, v_texClamp.xy, v_texClamp.zw);
    vec2 texc = vec2(texCoord.s, texCoord.t);

    vec2 mipScale = vec2(1.0);
    vec2 mipOffset = vec2(0.0);
    vec2 biome = v_color.rg;

    float light = 0.0;

    #include<manual_mip>

    // Game
    if(u_fogOn) {
        // Read texture
        vec4 color = texture(u_texture, texc * mipScale + mipOffset);
        // color *= vec4(1.2, 1.2, 1.2, 1.);

        if(color.a < 0.1) discard;
        if (u_opaqueThreshold > 0.1) {
            if (color.a < u_opaqueThreshold) {
                discard;
            } else {
                color.a = 1.0;
            }
        }

        if (v_color.r >= 0.0) {
            vec4 color_mask = texture(u_texture, vec2(texc.x + u_blockSize, texc.y) * mipScale + mipOffset);
            vec4 color_mult = texture(u_texture, biome);
            color.rgb += color_mask.rgb * color_mult.rgb;
        }

        /*
        if (v_color.r >= 0.0) {
            vec4 color_mask = texture(u_texture, vec2(texc.x + u_blockSize, texc.y) * mipScale + mipOffset);
            vec4 color_mult = texture(u_texture, biome);
            // color.rgb += color_mask.rgb * color_mult.rgb;
            color += mix(vec4(color_mask.rgb * color_mult.rgb, 0.), color_mask, 1. - color.a);
        }

        if(color.a < 0.1) discard;
        if (u_opaqueThreshold > 0.1) {
            if (color.a < u_opaqueThreshold) {
                discard;
            } else {
                color.a = 1.0;
            }
        }*/

        #include<local_light_pass>

        #include<ao_light_pass>

        #include<sun_light_pass>

        // Apply light
        color.rgb *= light;

        outColor = color;

        #include<fog_frag>
        // outColor = vec4(gamma(outColor.rgb), outColor.a);

        // Draw crosshair
        #include<crosshair_call_func>

        // gamma
        // outColor.rgb = pow(outColor.rgb, vec3(0.7));

        // contrast
        // outColor.rgb = outColor.rgb * 0.25 + 0.75* outColor.rgb * outColor.rgb *(3.0-2.0* outColor.rgb);

        // vignetting
        #include<vignetting_call_func>

    } else {
        outColor = texture(u_texture, texc);
        if(outColor.a < 0.1) discard;
        outColor *= v_color;
    }

}