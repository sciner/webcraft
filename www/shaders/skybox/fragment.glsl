#include<header>

//
uniform samplerCube u_texture;
uniform float u_brightness;
uniform vec4 u_fogColor; // global
uniform vec4 u_fogAddColor; // global
uniform vec3 u_sunDir; // global


uniform vec2 u_resolution; // global

in vec3 v_texCoord;
out vec4 outColor;

const vec3 sunColor = vec3(1., 0.93, 0.59);
const vec3 moonColor = vec3(0.9);


#include<crosshair_define_func>
#include<vignetting_define_func>

float circle(vec3 w, vec3 d, float s, float f) {
    float dist = distance(w, d) - s;

    return smoothstep(f, 1., 1. - dist);
}


void main() {
    vec3 norm    = normalize(v_texCoord);
    vec3 color   = texture(u_texture, v_texCoord).rgb;
    vec4 overlay;
    vec3 sun     = u_sunDir.xyz; 

    float fogFade = smoothstep(0., 0.5, max(0., norm.y));

    float fogFade2  = sqrt(fogFade);

    float sunDisk = circle(norm, sun, 0.05, 0.95);

    //sun
    overlay = vec4(sunColor, sunDisk * fogFade2);

    //moon
    vec3 moonPos = normalize(vec3(sun.z, -sun.y, 2.));
    float moonDisk = circle(norm, moonPos, 0.02, 0.99);
    float moodGlow = circle(norm, moonPos, 0.05, 0.7) * 0.15;
 
    overlay += vec4(moonColor, moonDisk * fogFade2);
    //overlay += stars(v_texCoord) * (1. - u_brightness) * fogFade2;

    // fog
    color =  mix(u_fogColor.rgb, color * max(u_brightness, moodGlow), fogFade);

    // overlay
    color = mix(color, overlay.rgb * 0.5, overlay.a);

    // fog tint
    color = mix(color, u_fogColor.rgb, 1. - pow(1. - u_fogAddColor.a, 2.0));

    outColor = vec4(color, 1.);

    #include<crosshair_call_func>

    #include<vignetting_call_func>   
}