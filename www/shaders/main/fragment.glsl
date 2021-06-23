precision highp float;

#define LOG2 1.442695
const float desaturateFactor = 2.0;

uniform sampler2D u_texture;

// Fog
uniform vec4 u_fogColor;
uniform vec4 u_fogAddColor;
uniform float u_fogDensity;
uniform bool u_fogOn;

//
uniform float u_brightness;

// HUD
uniform vec2 u_resolution;
uniform sampler2D u_HUDTexture;

varying vec3 v_position;
varying vec2 v_texcoord;
varying vec4 v_color;
varying vec3 v_normal;
varying float light;

varying float v_fogDepth;

uniform float u_time;

void main() {

    // Game
    if(u_fogOn) {

        // Read texture
        // vec4 color = texture2D(u_texture, vec2(v_texcoord.s, v_texcoord.t)) * vec4(v_color.rgb * max(u_brightness, v_color.a - 1.), 1.0);
        vec4 color = texture2D(u_texture, vec2(v_texcoord.s, v_texcoord.t));
        
        // Lightning
        //float brightness_mul = 1.1;
        
        //float n = floor(v_color.a + .5);

        //if(n == 1. || n == 2.) {
            // front && back
        //    brightness_mul = .7;
        //} else if(n == 5. || n == 6.) {
            // left && right
        //    brightness_mul = .9;
        //} else if(n == 3.) {
            // down
        //    brightness_mul = .7;
        //}

        color = vec4(color.rgb * u_brightness * light , color.a);

        if(color.a < 0.1) discard;

        // Calc fog amount
        float fogDistance = length(v_position);
        float fogAmount = 1. - exp2(-u_fogDensity * u_fogDensity * fogDistance * fogDistance * LOG2);
        if(fogAmount < .5) {
            fogAmount = .0;
        } else {
            fogAmount = (fogAmount - .5) * 2.;
        }
        fogAmount = clamp(fogAmount, 0., 1.);

        // Apply fog
        gl_FragColor = mix(color, u_fogColor, fogAmount);
        gl_FragColor.r = (gl_FragColor.r * (1. - u_fogAddColor.a) + u_fogAddColor.r * u_fogAddColor.a);
        gl_FragColor.g = (gl_FragColor.g * (1. - u_fogAddColor.a) + u_fogAddColor.g * u_fogAddColor.a);
        gl_FragColor.b = (gl_FragColor.b * (1. - u_fogAddColor.a) + u_fogAddColor.b * u_fogAddColor.a);

        // Desaturate colors in night
        //if(u_brightness != 1.) {
        //    float gs = 0.2126 * gl_FragColor.r + 0.7152 * gl_FragColor.g + 0.0722 * gl_FragColor.b;
        //    vec4 grayscale = vec4(gs, gs, gs, 1);
        //    float u_brightness2 = clamp(u_brightness * desaturateFactor, .0, 1.);
        //    gl_FragColor = (gl_FragColor * u_brightness2) + (grayscale * (1.0 - u_brightness2));
        //}

    } else {
        vec4 color = texture2D(u_texture, vec2(v_texcoord.s, v_texcoord.t)) * vec4(v_color.rgb, 1.0);
        // if(color.a < 0.1 ) discard;
        gl_FragColor = vec4(color.rgb, v_color.a);
    }
}