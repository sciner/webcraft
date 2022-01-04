// we can't coment in block, because version must be a first command
#ifdef header
    #version 300 es
    precision highp float;
    precision mediump sampler3D;
    //--
#endif

#ifdef constants
    // basic constans block
    #define LOG2 1.442695
    #define PI 3.14159265359
    #define desaturateFactor 2.0
#endif

#ifdef global_uniforms
    // global uniform block base
    uniform vec3 u_camera_pos;
    // Fog
    uniform vec4 u_fogColor;
    uniform vec4 u_fogAddColor;
    uniform bool u_fogOn;
    uniform float u_chunkBlockDist;

    //
    uniform float u_brightness;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec3 u_shift;
    uniform bool u_TestLightOn;
    uniform vec4 u_SunDir;
    //--
#endif

#ifdef global_uniforms_frag
    // global uniforms fragment part
    uniform sampler2D u_texture;
    uniform lowp sampler3D u_lightTex;
    
    uniform float u_mipmap;
    uniform float u_blockSize;
    uniform float u_opaqueThreshold;
    //--

#endif 

#ifdef global_uniforms_vert
    // global uniforms vertex part
    uniform mat4 uProjMatrix;
    uniform mat4 u_worldView;
    uniform mat4 uModelMatrix;
    uniform vec3 u_add_pos;
    uniform float u_pixelSize;
    //--
#endif

#ifdef terrain_attrs_vert 
    // terrain shader attributes and varings
    in vec3 a_position;
    in vec3 a_axisX;
    in vec3 a_axisY;
    in vec2 a_uvCenter;
    in vec2 a_uvSize;
    in vec3 a_color;
    in float a_flags;
    in vec2 a_quad;

    // please, replace all out with v_
    out vec3 world_pos;
    out vec3 chunk_pos;
    out vec3 v_position;
    out vec2 v_texcoord;
    out vec4 v_texClamp;
    out vec3 v_normal;
    out vec4 v_color;
    out vec4 crosshair;
    out vec2 u_uvCenter;
    //--
#endif

#ifdef terrain_attrs_frag 
    // terrain shader attributes and varings
    in vec3 v_position;
    in vec2 v_texcoord;
    in vec4 v_texClamp;
    in vec4 v_color;
    in vec3 v_normal;
    in float v_fogDepth;
    in vec4 crosshair;
    in vec3 world_pos;
    in vec3 chunk_pos;
    in vec2 u_uvCenter;

    out vec4 outColor;
#endif


#ifdef crosshair_define_func
    // crosshair draw block
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
                outColor.r = 1.0 - outColor.r;
                outColor.g = 1.0 - outColor.g;
                outColor.b = 1.0 - outColor.b;
                outColor.a = 1.0;
        }
    }
    //--
#endif

#ifdef crosshair_call_func
    drawCrosshair();
#endif

#ifdef vignetting_define_func
    // vignetting
    const float outerRadius = .65, innerRadius = .4, intensity = .1;
    const vec3 vignetteColor = vec3(0.0, 0.0, 0.0); // red

    // vignetting draw block
    void drawVignetting() {
        vec2 relativePosition = gl_FragCoord.xy / u_resolution - .5;
        relativePosition.y *= u_resolution.x / u_resolution.y;
        float len = length(relativePosition);
        float vignette = smoothstep(outerRadius, innerRadius, len);
        float vignetteOpacity = smoothstep(innerRadius, outerRadius, len) * intensity; // note inner and outer swapped to switch darkness to opacity
        outColor.rgb = mix(outColor.rgb, vignetteColor, vignetteOpacity);
    }
    //--
#endif

#ifdef vignetting_call_func
    // apply vignette to render result
    drawVignetting();
    //--
#endif

