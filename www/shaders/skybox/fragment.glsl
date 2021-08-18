precision highp float;

//
uniform samplerCube u_texture;
uniform float u_brightness_value;

varying vec3 v_texCoord;

void main() {
    vec4 color = textureCube(u_texture, v_texCoord);
	gl_FragColor = vec4(color.rgb * u_brightness_value, color.a);
}
