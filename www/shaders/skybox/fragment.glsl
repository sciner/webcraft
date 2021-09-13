precision highp float;

//
uniform samplerCube u_texture;
uniform float u_brightness_value;
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

void main() {
    if(u_textureOn) {
        vec4 color = textureCube(u_texture, v_texCoord);
        gl_FragColor = vec4(color.rgb * u_brightness_value, color.a);
    }
    // Draw crosshair
    drawCrosshair();
}