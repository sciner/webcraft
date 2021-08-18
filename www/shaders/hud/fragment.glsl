precision mediump float;

varying vec2 vertPos;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform bool u_noDraw;
uniform bool u_noCrosshair;

void main() {

    if(!u_noDraw) {

        vec2 texCoord = vec2( vertPos.s, -vertPos.t ) * 0.5 + 0.5;
        gl_FragColor  = texture2D(u_texture, texCoord.st);

        if(!u_noCrosshair) {
            // Draw crosshair
            float ch_width = 2.0;
            float ch_height = 14.0;
            if((gl_FragCoord.x > u_resolution.x / 2.0 - ch_width && gl_FragCoord.x < u_resolution.x / 2.0 + ch_width &&
                gl_FragCoord.y > u_resolution.y / 2.0 - ch_height && gl_FragCoord.y < u_resolution.y / 2.0 + ch_height) || 
                (gl_FragCoord.x > u_resolution.x / 2.0 - ch_height && gl_FragCoord.x < u_resolution.x / 2.0 + ch_height &&
                gl_FragCoord.y > u_resolution.y / 2.0 - ch_width && gl_FragCoord.y < u_resolution.y / 2.0 + ch_width)
               ) {
                    gl_FragColor.r = 1.0 - gl_FragColor.r;
                    gl_FragColor.g = 1.0 - gl_FragColor.g;
                    gl_FragColor.b = 1.0 - gl_FragColor.b;
                    gl_FragColor.a = 1.0;
            }
        }
        
    }

}