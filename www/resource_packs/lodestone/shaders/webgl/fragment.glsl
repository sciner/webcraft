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

    if (u_mipmap > 0.0) {
        biome *= 0.5;

        // manual implementation of EXT_shader_texture_lod
        vec2 fw = fwidth(v_texcoord) * float(textureSize(u_texture, 0));
        fw /= 1.4;
        vec4 steps = vec4(step(2.0, fw.x), step(4.0, fw.x), step(8.0, fw.x), step(16.0, fw.x));
        mipOffset.x = dot(steps, vec4(0.5, 0.25, 0.125, 0.0625));
        mipScale.x = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
        steps = vec4(step(2.0, fw.y), step(4.0, fw.y), step(8.0, fw.y), step(16.0, fw.y));
        mipOffset.y = dot(steps, vec4(0.5, 0.25, 0.125, 0.0625));
        mipScale.y = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
    }

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
        aoSample *= 0.5;

        float gamma = 0.5;
        caveSample = pow(vec3(caveSample, caveSample, caveSample), vec3(1.0/gamma)).r;
        // caveSample = round(caveSample * 16.) / 16.;

        caveSample = caveSample * (1.0 - aoSample);
        daySample = daySample * (1.0 - aoSample - max(-v_normal.z, 0.0) * 0.2);

        float light = max(min(caveSample + daySample * u_brightness, 1.0 - aoSample), 0.075 * (1.0 - aoSample));

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

        // Calc fog amount
        float fogDistance = length(world_pos.xy);
        float fogAmount = 0.;
        if(fogDistance > u_chunkBlockDist) {
            fogAmount = clamp(0.05 * (fogDistance - u_chunkBlockDist), 0., 1.);
        }

        // Apply fog
        outColor = mix(outColor, u_fogColor, fogAmount);
        outColor.r = (outColor.r * (1. - u_fogAddColor.a) + u_fogAddColor.r * u_fogAddColor.a);
        outColor.g = (outColor.g * (1. - u_fogAddColor.a) + u_fogAddColor.g * u_fogAddColor.a);
        outColor.b = (outColor.b * (1. - u_fogAddColor.a) + u_fogAddColor.b * u_fogAddColor.a);

        // outColor = vec4(gamma(outColor.rgb), outColor.a);

        // Draw crosshair
        drawCrosshair();

        // gamma
        // outColor.rgb = pow(outColor.rgb, vec3(0.7));

        // contrast
        // outColor.rgb = outColor.rgb * 0.25 + 0.75* outColor.rgb * outColor.rgb *(3.0-2.0* outColor.rgb);

        // vignetting
        drawVignetting();

    } else {
        outColor = texture(u_texture, texc);
        if(outColor.a < 0.1) discard;
        outColor *= v_color;
    }

}