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

        vec3 lightCoord = (chunk_pos + 0.5) / vec3(18.0, 18.0, 84.0);
        vec3 absNormal = abs(v_normal);
        vec3 aoCoord = (chunk_pos + (v_normal + absNormal + 1.0) * 0.5) / vec3(18.0, 18.0, 84.0);

        float caveSample = texture(u_lightTex, lightCoord).a;
        float daySample = 1.0 - texture(u_lightTex, lightCoord + vec3(0.0, 0.0, 0.5)).a;
        float aoSample = dot(texture(u_lightTex, aoCoord).rgb, absNormal);
        if (aoSample > 0.5) { aoSample = aoSample * 0.5 + 0.25; }
        aoSample *= aoFactor;

        float gamma = 0.5;
        caveSample = pow(vec3(caveSample, caveSample, caveSample), vec3(1.0/gamma)).r;
        // caveSample = round(caveSample * 16.) / 16.;

        caveSample = caveSample * (1.0 - aoSample);
        daySample = daySample * (1.0 - aoSample - max(-v_normal.z, 0.0) * 0.2);

        light = max(min(caveSample + daySample * u_brightness, 1.0 - aoSample), 0.075 * (1.0 - aoSample));

        float lightDistance = distance(vec3(0., 0., 1.4), world_pos);
        float rad = u_localLightRadius;

        // max power is 16, we use a radious that half of it
        float initBright = rad / 16.;

        if(lightDistance < rad) {
            float percent = (1. - pow(lightDistance / rad, 1.) ) * initBright;

            light = clamp(percent + light, 0., 1.);
        }

        if (u_SunDir.w < 0.5) {
            if(v_normal.x != 0.) {
                light = light * .7;
            } else if(v_normal.y != 0.) {
                light = light * .85;
            }
        } else {
            // limit brightness to 0.2
            light += max(0., dot(v_normal, normalize(u_SunDir.xyz))) * u_brightness;
        }

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