#include<header>

// noise factor for rediuce gradinet banding issues
#define BANDING_NOISE 0.01 
//
uniform samplerCube u_texture;
uniform float u_brightness;
uniform float u_nightshift;
uniform vec3 u_baseColor;
uniform vec4 u_fogColor; // global
uniform vec4 u_fogAddColor; // global
uniform vec3 u_sunDir; // global
uniform bool u_crosshairOn;

// used in crosshair_define_func
uniform vec2 u_resolution; // global

in vec3 v_texCoord;
out vec4 outColor;

const vec3 sunColor = vec3(0.95, 0.88, 0.25);
const vec3 moonColor = vec3(0.9);

#include<crosshair_define_func>
#include<vignetting_define_func>

float rect(vec3 w, vec3 d, float s){
    vec3 dist = abs(w - d) - vec3(s);
    float outDist = length(max(dist, 0.0));
    float inDist = min(max(dist.z, max(dist.x, dist.y)), 0.0);

    return outDist + inDist;
}

float sdfFunc(vec3 w, vec3 d, float s, float f) {
    float dist = distance(w, d) - s;
    //float dist = rect(w, d, s);

    return smoothstep(f, 1., 1. - dist);
}

vec3 mapToCube(vec3 pos) {
    vec3 norm = normalize(pos);
    vec3 upos = abs(norm);

    return norm / max(upos.z, max(upos.x, upos.y));
}

float rand3Df(vec3 co){
    return fract(sin(dot(co, vec3(12.9898, 78.233, 85.26))) * 43758.5453);
}

void main() {
    vec3 norm    = normalize(v_texCoord);
    vec3 color   = u_baseColor;// texture(u_texture, v_texCoord).rgb;
    vec3 sun     = normalize(u_sunDir.xyz);
    vec4 overlay;

    // random for fix banding 
    float r = (0.5 - rand3Df(norm)) * BANDING_NOISE;

    float fogFade = smoothstep(0., 0.5, max(0., norm.y + r));

    float fogFade2  = smoothstep(0., 0.1, norm.y);

    float sunDisk = sdfFunc(norm, sun, 0.03, 0.98);

    //sun
    overlay = vec4(sunColor, sunDisk);

    // glow intensity of sun
    float sunGlow = sdfFunc(norm, sun + vec3(r), 0.05, 0.7) * 0.45;

    overlay += vec4(sunGlow) * smoothstep(-0.05, 0.05, sun.y);

    // overlay *= fogFade2;

    //moon
    vec3 moonPos = -sun;
    float moonDisk = sdfFunc(norm, moonPos, 0.02, 0.99);
    float moodGlow = sdfFunc(norm, moonPos + vec3(r), 0.05, 0.7) * 0.15 * u_nightshift;

    overlay += vec4(moonColor, moonDisk * fogFade2);
    //overlay += stars(v_texCoord) * (1. - u_brightness) * fogFade2;

    // fog
    color =  mix(u_fogColor.rgb, color * max(u_brightness, moodGlow), fogFade);

    // overlay
    color = mix(color, overlay.rgb * 0.5, overlay.a * u_nightshift);

    // fog tint
    color = mix(color, u_fogColor.rgb, (1. - pow(1. - u_fogAddColor.a, 2.0)) * u_nightshift + (1.0 - u_nightshift));

    // special effect for sunrise 
    color = mix(color, u_fogColor.rgb, u_fogColor.a);

    // // vintage sepia
    // vec3 sepia = vec3(1.2, 1.0, 0.8);
    // float grey = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // vec3 sepiaColour = vec3(grey) * sepia;
    // color.rgb = mix(color.rgb, vec3(sepiaColour), 0.5);
    // // vintage sepia

    outColor = vec4(color, 1.);

    #include<crosshair_call_func>

    #include<vignetting_call_func>
}