#include<header>
#include<constants>

#include<terrain_attrs_frag>
#include<normal_light_frag_varying>

#include<global_uniforms>
#include<global_uniforms_frag>

#include<crosshair_define_func>

#include<vignetting_define_func>

#include<manual_mip_define_func>
#include<ao_light_define_func>

#include<torch_flame_func>

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
        if(checkFlag(FLAG_MASK_COLOR_ADD)) {
            color.rgb += color_mask.rgb * color_mult.rgb;
        } else {
            color.rgb += color_mask.rgb * color_mult.rgb;

            // // float y = mod(v_chunk_pos.z, 1.);
            // if(v_flagVerticalGrass > .5) {
            //     float h = v_flagTallGrass > .5 ? 2. : 1.;
            //     if(h < 1.5) {
            //         float y = (h - mod(texc.y * 32., h)) * 1.;
            //         // color.rgb += pow(color.rgb, vec3(1.0 / y));
            //         color.rgb += clamp(y * color.rgb, 0., 1.) ;
            //     }
            // }

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

    } else if (checkFlag(FLAG_MULTIPLY_COLOR)) {
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        color.rgb *= color_mult.rgb;
    }

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

float hash(vec3 p)  // replace this by something better
{
    p  = fract( p*0.3183099+.1 );
	p *= 17.0;
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}

float noise( in vec3 x ) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix( hash(i+vec3(0,0,0)), 
                        hash(i+vec3(1,0,0)),f.x),
                   mix( hash(i+vec3(0,1,0)), 
                        hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash(i+vec3(0,0,1)), 
                        hash(i+vec3(1,0,1)),f.x),
                   mix( hash(i+vec3(0,1,1)), 
                        hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

void main() {
    #include_post<flat_decode>
    #include<terrain_read_flags_frag>

    vec2 size = vec2(textureSize(u_texture, 0));
    vec2 texClamped = clamp(v_texcoord0, v_texClamp0.xy, v_texClamp0.zw);
    vec4 mipData = vec4(0.0, 0.0, 1.0, 1.0);
    ivec2 biome = ivec2(0.0);
    vec4 color = vec4(0.0);
    vec3 uvNormal = vec3(0.0, 0.0, 1.0);
    float playerLight = 0.0, sunNormalLight = 1.0;
    vec3 combinedLight = vec3(1.0);

    if(checkFlag(FLAG_QUAD_SDF)) {

        // sdf pipeline

        // text not should be mip-mapped
        // ignore a lot of pipeline passes
        vec4 data = texture(u_texture, texClamped);

        float threshold = 0.6;
        float outline = 0.2;

        float msdfSize = 100.0;

        vec4 msdfColor = vec4(v_color.rgb / 255.0, 1.0);
        // vec4 outlineColor = vec4(1.0 - v_color.rgb / 255.0, 0.8);
        vec4 outlineColor = vec4(0.0, .0, .0, 0.8);

        float msdfFactor =  0.5 * length(fwidth(v_texcoord0) * msdfSize);
        float totalThreshold = threshold - outline;

        float dist = median(data);
        float fill = smoothstep(
            totalThreshold - msdfFactor,
            totalThreshold + msdfFactor,
            dist
        );

        color = mix(vec4(0.0), msdfColor, fill);

        float outlineFactor = 1. - smoothstep(totalThreshold - msdfFactor, threshold, dist);
        // outlineFactor = 0.;
        // if(outlineFactor < .5) {
        //     outlineFactor = 0.;
        // } else {
        //     outlineFactor = 1.;
        // }
        color = mix(color, outlineColor, outlineFactor) * color.a;

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

        if(checkFlag(FLAG_FLUID_ERASE)) {
            color.a = .0;
        } else if(checkFlag(FLAG_TORCH_FLAME)) {
            #include<torch_flame>
            if(color.a < 0.7) discard;
        } else {
            // text not allow to discard in this place
            if(checkFlag(FLAG_QUAD_OPACITY)) {
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

            if(checkFlag(FLAG_ENCHANTED_ANIMATION)) {
                #include<enchanted_animation>
            }
        }

    }

    if(!checkFlag(FLAG_NO_CAN_TAKE_LIGHT)) {
        vec4 centerSample;
        float daySample;
        #include<local_light_pass>
        #include<ao_light_pass>
        if(!checkFlag(FLAG_NO_CAN_TAKE_AO)) {
            #include<sun_light_pass>
        }
        if (cavePart > 0.0 && u_useNormalMap > 0.5 && u_sunDir.w < 0.5) {
            #include<normal_light_pass>
        }
        if(u_eyeinwater > 0. && !checkFlag(FLAG_NO_FOG)) {
            // caustics on underwater blocks
            #include<caustic1_pass>
        }
        // Apply light
        color.rgb *= combinedLight * sunNormalLight;
    }

    if(checkFlag(FLAG_RAIN_OPACITY)) {
        color.a *= u_rain_strength;
    }

    // _include<swamp_fog>

    // float dist = distance(vec3(0., 0., 1.4), v_world_pos);

    // float fog = 0.;
    // float STEPS = 50.;
    // vec3 cam_period = getCamPeriod();
    // vec3 end_pos = v_world_pos;
    // for (float i = 0.; i < STEPS; i++) {
    //     float s = i / STEPS;
    //     vec3 p = vec3(end_pos.x * s, end_pos.y * s, end_pos.z * s);
    //     fog += noise(cam_period + p) / STEPS;
    // }

    // // color.rgb += vec3((noise((v_world_pos + getCamPeriod()) / 2.) - .5) / 1.);
    // color.rgb += vec3(fog * 0.2, fog * 0.6, fog * .2);
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
    // #include<vignetting_call_func>
}