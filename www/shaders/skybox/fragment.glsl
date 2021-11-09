precision highp float;

// vignetting
const float outerRadius = .65, innerRadius = .4, intensity = .1;
const vec3 vignetteColor = vec3(0.0, 0.0, 0.0); //red

//
uniform samplerCube u_texture;
uniform float u_brightness;
uniform vec2 u_resolution;
uniform bool u_textureOn;

varying vec3 v_texCoord;
varying vec4 crosshair;

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
            gl_FragColor.r = 1.0 - gl_FragColor.r;
            gl_FragColor.g = 1.0 - gl_FragColor.g;
            gl_FragColor.b = 1.0 - gl_FragColor.b;
            gl_FragColor.a = 1.0;
    }
}

void drawVignetting() {
    vec2 relativePosition = gl_FragCoord.xy / u_resolution - .5;
    relativePosition.y *= u_resolution.x / u_resolution.y;
    float len = length(relativePosition);
    float vignette = smoothstep(outerRadius, innerRadius, len);
    float vignetteOpacity = smoothstep(innerRadius, outerRadius, len) * intensity; // note inner and outer swapped to switch darkness to opacity
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vignetteColor, vignetteOpacity);
}

void main() {
    if(u_textureOn) {
        vec4 color = textureCube(u_texture, v_texCoord);
        gl_FragColor = vec4(color.rgb * u_brightness, color.a);
    }
    // Draw crosshair
    drawCrosshair();

    // gamma
    // gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.7));

    // contrast
    // gl_FragColor.rgb = gl_FragColor.rgb * 0.25 + 0.75* gl_FragColor.rgb * gl_FragColor.rgb *(3.0-2.0* gl_FragColor.rgb);

    // vignetting
    drawVignetting();
}