precision highp float;

#define LOG2 1.442695
const float desaturateFactor = 2.0;

uniform sampler2D u_texture;
uniform sampler2D u_texture_mask;

// Fog
uniform vec4 u_fogColor;
uniform vec4 u_fogAddColor;
uniform float u_fogDensity;
uniform bool u_fogOn;
uniform float u_chunkBlockDist;

//
uniform float u_brightness;

// HUD
uniform vec2 u_resolution;
uniform sampler2D u_HUDTexture;

varying vec3 v_position;
varying vec2 v_texcoord;
varying vec4 v_texClamp;
varying vec4 v_color;
varying vec3 v_normal;
varying float light;

varying float v_fogDepth;
uniform float u_time;

void main() {
    vec2 texCoord = clamp(v_texcoord, v_texClamp.xy, v_texClamp.zw);
    vec2 texc = vec2(texCoord.s, texCoord.t);

    // Game
    if(u_fogOn) {

        // Read texture

        vec4 color = texture2D(u_texture, texc);
        vec4 color_mask = texture2D(u_texture_mask, texc);

        // color.rgb = color_mask.rgb;

        // Apply light
        color = vec4(color.rgb * u_brightness * light, color.a);
        if(color.a < 0.1) discard;

        // Multiply color by mask
        // vec2 maskc = vec2(v_color.b, 22. / 32.);
        // vec4 color_mask = texture2D(u_texture, maskc);

        vec4 color_mult = texture2D(u_texture, vec2(v_color.r, v_color.g));
        color.rgb *= (color_mult.rgb + (1. - color_mult.rgb) * (1. - color_mask.rgb));

        gl_FragColor = color;

        // Calc fog amount
        float fogDistance = length(v_position);
        float fogAmount = 0.;
        if(fogDistance > u_chunkBlockDist) {
            fogAmount = clamp(0.05 * (fogDistance - u_chunkBlockDist), 0., 1.);
        }

        // Apply fog
        gl_FragColor = mix(gl_FragColor, u_fogColor, fogAmount);
        gl_FragColor.r = (gl_FragColor.r * (1. - u_fogAddColor.a) + u_fogAddColor.r * u_fogAddColor.a);
        gl_FragColor.g = (gl_FragColor.g * (1. - u_fogAddColor.a) + u_fogAddColor.g * u_fogAddColor.a);
        gl_FragColor.b = (gl_FragColor.b * (1. - u_fogAddColor.a) + u_fogAddColor.b * u_fogAddColor.a);

    } else {
        gl_FragColor = texture2D(u_texture, texc);
        if(gl_FragColor.a < 0.1) discard;
        gl_FragColor *= v_color;
    }
}
