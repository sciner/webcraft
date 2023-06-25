#include<header>
#include<constants>

uniform vec4 u_fluidUV[2];

in vec3 v_world_pos;
in vec3 v_chunk_pos;
in vec3 v_position;
in vec2 v_texcoord0;
flat in vec4 v_fluidAnim;
flat in vec3 v_normal;
flat in vec4 v_color;
flat in float v_lightId;
flat in vec4 v_lightOffset;
flat in int v_flags;
float v_lightMode;
flat in int v_cubeSide;

out vec4 outColor;

#include<global_uniforms>
#include<global_uniforms_frag>

#include<vignetting_define_func>

#include<manual_mip_define_func>
#include<raindrops_define_func>
#include<ao_light_define_func>
#include<shoreline_func>

////// LAVA

    mat2 rot(float a){
    return mat2(cos(a),sin(a),-sin(a),cos(a));
    }

    float hash21(vec2 n) {
        return fract(cos(dot(n, vec2(5.9898, 4.1414))) * 65899.89956);
    }

    float noise( in vec2 n ) {
        const vec2 d = vec2(0.0, 1.0);
        vec2 b = floor(n);
        vec2 f = smoothstep(vec2(0.), vec2(1), fract(n));
        return mix(mix(hash21(b), hash21(b + d.yx), f.x), mix(hash21(b + d.xy), hash21(b + d.yy), f.x), f.y);
        }

    vec2 mixNoise(vec2 p) {
        float epsilon = .968785675;
        float noiseX = noise(vec2(p.x+epsilon,p.y))-noise(vec2(p.x-epsilon,p.y));
        float noiseY = noise(vec2(p.x,p.y+epsilon))-noise(vec2(p.x,p.y-epsilon));
        return vec2(noiseX,noiseY);
    }

    float fbm(in vec2 p) {
        float amplitude=3.;
        float total = 0.;
        vec2 pom = p;
        float iTime = u_time / 1000.;
        for (float i= 1.3232; i < 7.45; i++) {
            p += iTime*.05;
            //pom+=iTime*0.09;
            vec2 n= mixNoise(i*p*.3244243+iTime*.131321);
            n*=rot(iTime*.5-(0.03456*p.x+0.0342322*p.y)*50.);
            p += n*.5;
            total+= (sin(noise(p)*8.5)*0.55+0.4566)/amplitude;

            p = mix(pom,p,0.5);

            amplitude *= 1.3;

            p *= 2.007556;
            pom *= 1.6895367;
        }
        return total;
    }

//// LAVA

vec4 sampleAtlassTexture (vec4 mipData, vec2 texClamped, ivec2 biomPos) {
    vec2 texc = texClamped;

    vec4 color = texture(u_texture, texc * mipData.zw + mipData.xy);

    if (v_color.a > 0.0) {
        float mask_shift = v_color.b;
        vec4 color_mask = texture(u_texture, vec2(texc.x + u_blockSize * max(mask_shift, 1.), texc.y) * mipData.zw + mipData.xy);
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        color.rgb += color_mask.rgb * color_mult.rgb;
    } else if (checkFlag(FLAG_MULTIPLY_COLOR)) {
        vec4 color_mult = texelFetch(u_maskColorSampler, biomPos, 0);
        color.rgb *= color_mult.rgb;
    }

    return color;
}

void main() {
    #include_post<flat_decode>
    #include<terrain_read_flags_frag>

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
    sunNormalLight = dot(minecraftSun, v_normal * v_normal);

    if(fluidId == 1) {
        /// LAVA
        vec3 cam_period5 = getCamPeriod();
        float scale = 4.;
        float pixels = 1. / 32.;
        float div = pixels / scale;
        vec2 uv;
        if(v_cubeSide == 2 || v_cubeSide == 3) {
            vec2 tms = vec2(0., u_time / 5000.);
            uv = vec2(v_world_pos.xz + cam_period5.xz + tms + pixels / 2.) / scale;
        } else if(v_cubeSide == 4 || v_cubeSide == 5) {
            vec2 tms = vec2(0., u_time / 5000.);
            uv = vec2(v_world_pos.yz + cam_period5.yz + tms + pixels / 2.) / scale;
        } else {
            uv = vec2(v_world_pos.xy + cam_period5.xy + pixels / 2.) / scale;
        }
        // pixelate
        uv = round(uv / div) * div;
        float fbm_value = fbm(uv);
        vec3 col = vec3(.212, 0.08, 0.03) / max(fbm_value, 0.0001);
        col = pow(col, vec3(1.5));
        color.rgb = col;
        ///// LAVA
    } else {

        #include<caustic_pass_onwater>

        vec3 mul;
        float daySample;

        if(!checkFlag(FLAG_NO_CAN_TAKE_LIGHT)) {
            #include<local_light_pass>
            #include<ao_light_pass>
            #include<shoreline>
            mul = (combinedLight * sunNormalLight);
        } else {
            mul = vec3(sunNormalLight);
        }
    
        #include<raindrops_onwater>
        // Apply light
        color.rgb *= mul;

    }

    // _include<swamp_fog>

    // // vintage sepia
    // vec3 sepia = vec3(1.2, 1.0, 0.8);
    // float grey = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // vec3 sepiaColour = vec3(grey) * sepia;
    // color.rgb = mix(color.rgb, vec3(sepiaColour), 0.65);
    // // swap r & b
    // float bb = color.b;
    // color.b = color.r;
    // color.r = bb;
    // // vintage sepia

    outColor = color;

    #include<fog_frag>
    #include<vignetting_call_func>

}