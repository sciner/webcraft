#version 300 es

precision highp float;

#define LOG2 1.442695
const float desaturateFactor = 2.0;

// vignetting
const float outerRadius = .65, innerRadius = .4, intensity = .1;
const vec3 vignetteColor = vec3(0.0, 0.0, 0.0); // red

uniform sampler2D u_texture;

uniform vec3 u_camera_pos;
// Fog
uniform vec4 u_fogColor;
uniform vec4 u_fogAddColor;
uniform bool u_fogOn;
uniform float u_chunkBlockDist;

//
uniform float u_brightness;
uniform vec2 u_resolution;
uniform vec3 u_shift;
uniform bool u_TestLightOn;
uniform vec3 sun_dir;

in vec3 v_position;
in vec2 v_texcoord;
in vec4 v_texClamp;
in vec4 v_color;
in vec3 v_normal;
in float light;
in float v_fogDepth;
in vec4 crosshair;
in vec3 world_pos;

uniform float u_mipmap;
uniform float u_blockSize;
uniform float u_opaqueThreshold;

out vec4 outColor;

struct PointLight {
    vec3 WorldSpacePos;
    vec4 Color;
    float Radius;
};

void drawCrosshair() {
    float w = u_resolution.x;
    float h = u_resolution.y;
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;
    if((x > w / 2.0 - crosshair.w && x < w / 2.0 + crosshair.w &&
        y > h / 2.0 - crosshair.z && y < h / 2.0 + crosshair.z) ||
        (x > w / 2.0 - crosshair.z && x < w / 2.0 + crosshair.z &&
        y > h / 2.0 - crosshair.w && y < h / 2.0 + crosshair.w)
        ) {
            outColor.r = 1.0 - outColor.r;
            outColor.g = 1.0 - outColor.g;
            outColor.b = 1.0 - outColor.b;
            outColor.a = 1.0;
    }
}

void drawVignetting() {
    vec2 relativePosition = gl_FragCoord.xy / u_resolution - .5;
    relativePosition.y *= u_resolution.x / u_resolution.y;
    float len = length(relativePosition);
    float vignette = smoothstep(outerRadius, innerRadius, len);
    float vignetteOpacity = smoothstep(innerRadius, outerRadius, len) * intensity; // note inner and outer swapped to switch darkness to opacity
    outColor.rgb = mix(outColor.rgb, vignetteColor, vignetteOpacity);
}

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

        float u_brightness2 = u_brightness;

        if(u_TestLightOn) {
            u_brightness2 = clamp(1. + u_brightness2, 0., 1.);
            color = mix(color, vec4(1.,1.,1.,1.1), u_brightness2);
        }

        // Static point light
        /*
        PointLight pl = PointLight(vec3(2902., 2794., 70.), vec4(1.,1.,1.,1.), 7.); // 250000000
        float lightDistance = distance(pl.WorldSpacePos, world_pos + u_camera_pos);
        if(lightDistance < pl.Radius) {
            float percent = 1. - lightDistance / pl.Radius;
            if(percent < 1.) {
                u_brightness2 = clamp(percent + u_brightness2, 0., 1.);
                // color = mix(color, pl.Color, percent);
            }
        }
        */

        // Apply light
        color.rgb *= u_brightness2 * light;

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
