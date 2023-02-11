#include<header>
#include<constants>

#include<global_uniforms>
#include<global_uniforms_frag>

#include<terrain_attrs_frag>

#include<crosshair_define_func>

#include<vignetting_define_func>

#include<manual_mip_define_func>

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

//******************************************************************************

    float Color_GetSaturation(vec3 c) {
        return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    }

    float Color_GetLuminosity(vec3 c) {
        return 0.3*c.r + 0.59*c.g + 0.11*c.b;
    }

    vec3 Color_SetLuminosity(vec3 c, float lum) {

        vec3 cc = c;
        float d = lum - Color_GetLuminosity(c);
        c.rgb += vec3(d,d,d);
        c.rgb = clamp(c.rgb, vec3(0.), vec3(1.));

        // clip back into legal range
        lum = Color_GetLuminosity(c);
        float cMin = min(c.r, min(c.g, c.b));
        float cMax = max(c.r, max(c.g, c.b));

        if(cMin < 0.) {
            c = mix(vec3(lum,lum,lum), cc, lum / (lum - cMin));
        }

        if(cMax > 1.) {
            c = mix(vec3(lum,lum,lum), cc, (1. - lum) / (cMax - lum));
        }

        return c;
    }

    vec3 BlendMode_Color(vec3 base, vec3 blend) {
        return Color_SetLuminosity(blend, Color_GetLuminosity(base));
    }

    // Generic algorithm to desaturate images used in most game engines
    vec3 generic_desaturate(vec3 color, float factor) {
        vec3 lum = vec3(0.299, 0.587, 0.114);
        vec3 gray = vec3(dot(lum, color));
        return mix(color, gray, factor);
    }

    // Generic algorithm to desaturate images used in most game engines
    vec3 generic_desaturate2(vec3 color, float factor) {
        vec3 gray = vec3( dot( color , vec3( 0.2126 , 0.7152 , 0.0722 ) ) );
        return  mix( color , gray , factor );
    }

    vec3 brightnessContrast(vec3 value, float brightness, float contrast) {
        return (value - 0.5) * contrast + 0.5 + brightness;
    }

//******************************************************************************

vec4 sampleAtlassTexture (vec4 mipData, vec2 texClamped, ivec2 biomPos) {
    vec2 texc = texClamped;

    vec4 color = texture(u_texture, texc * mipData.zw + mipData.xy);

    if (v_color.a > 0.0) {
        float mask_shift = v_color.b;
        vec4 color_mask = texture(u_texture, vec2(texc.x + u_blockSize * max(mask_shift, 1.), texc.y) * mipData.zw + mipData.xy);
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        // Old Blend Mode
        if(v_flagMaskColorAdd > .5) {
            color.rgb += color_mask.rgb * color_mult.rgb;
        } else {
            color.rgb += color_mask.rgb * color_mult.rgb;

            // color_mask.rgb = pow(color_mask.rgb, vec3(0.850));
            // color.rgb += pow(color_mask.rgb * color_mult.rgb, vec3(1.0 / 0.85));
            // color.rgb += 

            // Photoshop Blend Mode @Color
            // color.rgb += BlendMode_Color(color_mask.rgb, color_mult.rgb);

            // color correction
            // color.rgb = pow(color.rgb, vec3(1.0 / 0.5)); // gamma
            // color.rgb = color.rgb + .15; // brightness
            // color.rgb = generic_desaturate(color.rgb, 0.25); // desaturate

        }

    } else if (v_flagMultiplyColor > 0.0) {
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        color.rgb *= color_mult.rgb;
    }

    //if(v_flagEnchantedAnimation > 0.0) {
    //    color.rgb *= 2.0;
    //}

    // color.rgb = pow(color.rgb, vec3(1.0 / 0.6)); // gamma
    // color.rgb = brightnessContrast(color.rgb, 0.05, 0.8); // brightness + contrast
    // color.rgb = generic_desaturate(color.rgb, 0.15); // desaturate

    return color;
}

float median(vec4 p) {
    return max(min(p.r, p.g), min(max(p.r, p.g), p.b));
}

////////////////////////
//float GAMMA = 1.2;
//vec3 gamma(vec3 color, float g) {
//    return pow(color, vec3(g));
//}
//vec3 encodeSRGB(vec3 linearRGB) {
//    vec3 a = 12.92 * linearRGB;
//    vec3 b = 1.055 * pow(linearRGB, vec3(1.0 / 2.4)) - 0.055;
//    vec3 c = step(vec3(0.0031308), linearRGB);
//    return mix(a, b, c);
//}
//vec3 linearToScreen(vec3 linearRGB) {
//    return gamma(linearRGB, 1.0 / GAMMA);
//    // return (iMouse.z < 0.5) ? encodeSRGB(linearRGB) : gamma(linearRGB, 1.0 / GAMMA);
//}
//vec3 screenToLinear(vec3 screenRGB) {
//    return gamma(screenRGB, GAMMA);
//    // return (iMouse.z < 0.5) ? decodeSRGB(screenRGB) : gamma(screenRGB, GAMMA);
//}
vec3 colorCorrection(vec3 color) {
    // color = linearToScreen(color);
    return color;
}

void main() {

    vec2 size = vec2(textureSize(u_texture, 0));
    vec2 texClamped = clamp(v_texcoord0, v_texClamp0.xy, v_texClamp0.zw);
    vec4 mipData = vec4(0.0, 0.0, 1.0, 1.0);
    ivec2 biome = ivec2(0.0);
    vec4 color = vec4(0.0);
    vec3 uvNormal = vec3(0.0, 0.0, 1.0);
    float playerLight = 0.0, sunNormalLight = 1.0;
    vec3 combinedLight = vec3(1.0);

    // Game
    // if(u_fogOn) {

        if(v_flagQuadSDF > 0.5) {

            // sdf pipeline

            // text not should be mip-mapped
            // ignore a lot of pipeline passes
            vec4 data = texture(u_texture, texClamped);

            float threshold = 0.6;
            float outline = 0.2;

            float msdfSize = 100.0;

            vec4 msdfColor = vec4(v_color.rgb / 255.0, 1.0);
            vec4 outlineColor = vec4(1.0 - v_color.rgb / 255.0, 0.8);

            float msdfFactor =  0.5 * length(fwidth(v_texcoord0) * msdfSize);
            float totalThreshold = threshold - outline;

            float dist = median(data);
            float fill = smoothstep(
                totalThreshold - msdfFactor,
                totalThreshold + msdfFactor,
                dist
            );

            color = mix(vec4(0.0), msdfColor, fill);

            color = mix(color, outlineColor, 1. - smoothstep(totalThreshold - msdfFactor, threshold, dist)) * color.a;

            // discard transparency
            // for smooth edge value should be lower than visible step
            if (color.a < 4.0 / 256.0) {
                discard;
            }
        } else {

            // default texture fetch pipeline

            biome = ivec2(round(v_color.rg));
            mipData = manual_mip(v_texcoord0, size);
            color = sampleAtlassTexture (mipData, texClamped, biome);
            if (u_useNormalMap > 0.5) {
                uvNormal = texture(u_texture_n, texClamped * mipData.zw + mipData.xy).rgb * 2.0 - 1.0;
            }

            if (v_animInterp > 0.0) {
                color = mix(
                    color,
                    sampleAtlassTexture (mipData, texClamped + v_texcoord1_diff, biome),
                    v_animInterp
                );
            }

            // text not allow to discard in this place
            if(v_flagOpacity != 0.) {
                color.a *= v_color.b / 255.0;
            } else {
                if(color.a < 0.1) discard;
                if (u_opaqueThreshold > 0.1) {
                    if (color.a < u_opaqueThreshold) {
                        discard;
                    } else {
                        color.a = 1.0;
                    }
                }
            }

            if(v_flagEnchantedAnimation > 0.0) {
                #include<enchanted_animation>
            }

        }

        if(v_noCanTakeLight < 0.5) {

            vec4 centerSample;
            #include<local_light_pass>
            #include<ao_light_pass>
            if(v_noCanTakeAO == .0) {
                #include<sun_light_pass>
            }
            if (cavePart > 0.0 && u_useNormalMap > 0.5 && u_SunDir.w < 0.5) {
                #include<normal_light_pass>
            }
            if(u_eyeinwater > 0. && v_useFog > 0.5) {
                // caustics on underwater blocks
                #include<caustic1_pass>
            }
            // Apply light
            color.rgb *= combinedLight * sunNormalLight;
        }

        if(v_flagRainOpacity > .5) {
             color.a *= u_rain_strength;
        }

        // #include<swamp_fog>

        // float dist = distance(vec3(0., 0., 1.4), v_world_pos) / 64.;
        outColor = color;
        // outColor.rgb = colorCorrection(outColor.rgb);

        #include<fog_frag>

        // // vintage sepia
        // vec3 sepia = vec3(1.2, 1.0, 0.8);
        // float grey = dot(outColor.rgb, vec3(0.299, 0.587, 0.114));
        // vec3 sepiaColour = vec3(grey) * sepia;
        // outColor.rgb = mix(outColor.rgb, vec3(sepiaColour), 0.5);
        // outColor.rgb = mix(outColor.rgb, vec3(.0, .0, 1.), .025);
        // // vintage sepia

        if(u_crosshairOn) {
            #include<crosshair_call_func>
        }
        #include<vignetting_call_func>

    // } else {
    //     outColor = texture(u_texture, texClamped);
    //     if(outColor.a < 0.1) discard;
    //     outColor *= v_color;
    // }

}