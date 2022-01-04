#include<header>

//
uniform samplerCube u_texture;
uniform float u_brightness;
uniform vec2 u_resolution;
uniform bool u_textureOn;

in vec3 v_texCoord;
out vec4 outColor;

#include<crosshair_define_func>
#include<vignetting_define_func>

void main() {
    if(u_textureOn) {
        vec4 color = texture(u_texture, v_texCoord);
        outColor = vec4(color.rgb * u_brightness, color.a);
    }

    #include<crosshair_call_func>

    #include<vignetting_call_func>   
}