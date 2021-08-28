precision highp float;

//
uniform samplerCube u_texture;
uniform float u_brightness_value;

varying vec3 v_texCoord;

void main() {
    vec4 color = textureCube(u_texture, v_texCoord);
	gl_FragColor = vec4(color.rgb * u_brightness_value, color.a);
        
    /*  
        // Draw crosshair
        vec2 u_resolution = vec2(512., 512.);
        float ch_width = 2.0;// / 1000.;
        float ch_height = 14.0;// / 1000.;
        float w = gl_FragCoord.z;
        float h = gl_FragCoord.z;
        float x = gl_FragCoord.x;
        float y = gl_FragCoord.y;

        if((x > w / 2.0 - ch_width && x < w / 2.0 + ch_width &&
            y > h / 2.0 - ch_height && y < h / 2.0 + ch_height) || 
            (x > w / 2.0 - ch_height && x < w / 2.0 + ch_height &&
            y > h / 2.0 - ch_width && y < h / 2.0 + ch_width)
            ) {
                gl_FragColor.r = 1.0 - gl_FragColor.r;
                gl_FragColor.g = 1.0 - gl_FragColor.g;
                gl_FragColor.b = 1.0 - gl_FragColor.b;
                gl_FragColor.a = 1.0;
        }
    */

}
