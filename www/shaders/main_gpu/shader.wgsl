[[block]] struct VExtendUniform {
    ModelMatrix : mat4x4<f32>;
    add_pos : vec3<f32>;
    mipmap: f32;
};

[[block]] struct VUniforms {
    ProjMatrix : mat4x4<f32>;
    worldView : mat4x4<f32>;
    fogOn : f32;
    brightness : f32;
    pixelSize : f32;
};


[[block]] struct FUniforms {
    // Fog
    fogColor : vec4<f32>;
    fogAddColor : vec4<f32>;
    //fogDensity : f32;
    //fogOn: bool;
    chunkBlockDist: f32;
    //
    // brightness : f32;
    blockSize : f32;
    opaqueThreshold : f32;
};

struct Attrs {
    [[location(0)]] position : vec3<f32>;
    [[location(1)]] axisX : vec3<f32>;
    [[location(2)]] axisY : vec3<f32>;

    [[location(3)]] uvCenter : vec2<f32>;
    [[location(4)]] uvSize : vec2<f32>;

    [[location(5)]] color : vec3<f32>;

    [[location(6)]] occlusion : vec4<f32>;

    [[location(7)]] flags : f32;

    [[location(8)]] quad : vec2<f32>;

    [[location(9)]] quadOcc : vec4<f32>;
};

struct VertexOutput {
    [[builtin(position)]] VPos : vec4<f32>;
    [[location(0)]] position : vec3<f32>;
    [[location(1)]] texcoord : vec2<f32>;
    [[location(2)]] texClamp : vec4<f32>;
    [[location(3)]] color : vec4<f32>;
    [[location(4)]] normal : vec3<f32>;
    [[location(5)]] light : f32;
};

[[group(0), binding(0)]] var<uniform> u : VUniforms;
[[group(0), binding(1)]] var<uniform> fu : FUniforms;

[[group(1), binding(0)]] var<uniform> eu : VExtendUniform;
[[group(1), binding(1)]] var u_sampler: sampler;
[[group(1), binding(2)]] var u_texture: texture_2d<f32>;

//[[group(0), binding(4)]] var u_texture_mask: texture_2d<f32>;


[[stage(vertex)]]
fn main_vert(a : Attrs) -> VertexOutput {
    var v: VertexOutput;

    v.color = vec4<f32>(a.color, dot(a.occlusion, a.quadOcc));

    // find flags
    var flagBiome : f32 = step(1.5, a.flags);
    var flags : f32 = a.flags - flagBiome * 2.0;
    var flagNormalUp : f32 = step(0.5, flags);

    if (flagNormalUp > 0.0) {
        v.normal = -a.axisY;
    } else {
        v.normal = normalize(cross(a.axisX, a.axisY));
    }

    v.normal = vec3<f32>(v.normal.x, v.normal.z, v.normal.y);

    var pos : vec3<f32> = a.position + (a.axisX * a.quad.x) + (a.axisY * a.quad.y);
    v.texcoord = a.uvCenter + (a.uvSize * a.quad);
    v.texClamp = vec4<f32>(a.uvCenter - abs(a.uvSize * 0.5) + u.pixelSize * 0.5, a.uvCenter + abs(a.uvSize * 0.5) - u.pixelSize * 0.5);

    var sun_dir : vec3<f32> = vec3<f32>(0.7, 1.0, 0.85);
    var n : vec3<f32> = normalize(v.normal);
    v.light = max(.5, dot(n, sun_dir) - v.color.a);

    if(u.fogOn > 0.0) {
        if (flagBiome < 0.5) {
            v.color.r = -1.0;
        }
    }
    // 1. Pass the view position to the fragment shader
    v.position = (u.worldView * (eu.ModelMatrix * vec4<f32>(pos, 1.0) + vec4<f32>(eu.add_pos, 0.0))).xyz;
    v.VPos = u.ProjMatrix * vec4<f32>(v.position, 1.0);

    return v;
}

[[stage(fragment)]]
fn main_frag(v : VertexOutput) -> [[location(0)]] vec4<f32>{
    var outColor: vec4<f32>;
    var texCoord : vec2<f32> = clamp(v.texcoord, v.texClamp.xy, v.texClamp.zw);
    var texc : vec2<f32> = vec2<f32>(texCoord.x, texCoord.y);

    var mipScale : vec2<f32> = vec2<f32>(1.0);
    var mipOffset : vec2<f32> = vec2<f32>(0.0);
    var biome : vec2<f32> = v.color.rg;

    if (eu.mipmap > 0.0) {
        biome = biome * 0.5;

        // manual implementation of EXT_shader_texture_lod
        var fw : vec2<f32> = fwidth(v.texcoord) * f32(textureDimensions(u_texture, 0).x);
        fw = fw / 1.4;
        var steps : vec4<f32> = vec4<f32>(step(2.0, fw.x), step(4.0, fw.x), step(8.0, fw.x), step(16.0, fw.x));

        mipOffset.x = dot(steps, vec4<f32>(0.5, 0.25, 0.125, 0.0625));
        mipScale.x = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));

        steps = vec4<f32>(step(2.0, fw.y), step(4.0, fw.y), step(8.0, fw.y), step(16.0, fw.y));

        mipOffset.y = dot(steps, vec4<f32>(0.5, 0.25, 0.125, 0.0625));
        mipScale.y = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
    }

    // Game
    if(u.fogOn > 0.0) {
        // Read texture
        var color : vec4<f32> = textureSample(u_texture, u_sampler, texc * mipScale + mipOffset);

        if(color.a < 0.1) {
            discard;
        }

        if (fu.opaqueThreshold > 0.1) {
            if (color.a < fu.opaqueThreshold) {
                discard;
            } else {
                color.a = 1.0;
            }
        }

        if (v.color.r >= 0.0) {
            var color_mask: vec4<f32> = textureSample(u_texture, u_sampler, vec2<f32>(texc.x + fu.blockSize, texc.y) * mipScale + mipOffset);
            var color_mult: vec4<f32> = textureSample(u_texture, u_sampler, biome);

            color = vec4<f32>(
                color.rgb + color_mask.rgb * color_mult.rgb,
                color.a
            );
        }

        // Apply light
        color = vec4<f32>(
            color.rgb * u.brightness * v.light,
            color.a
        );

        outColor = color;

        // Calc fog amount
        var fogDistance : f32 = length(v.position);
        var fogAmount : f32 = 0.0;

        if(fogDistance > fu.chunkBlockDist) {
            fogAmount = clamp(0.05 * (fogDistance - fu.chunkBlockDist), 0., 1.);
        }

        // Apply fog
        outColor = mix(outColor, fu.fogColor, fogAmount);

        outColor = vec4<f32>(
            (outColor.r * (1. - fu.fogAddColor.a) + fu.fogAddColor.r * fu.fogAddColor.a),
            (outColor.g * (1. - fu.fogAddColor.a) + fu.fogAddColor.g * fu.fogAddColor.a),
            (outColor.b * (1. - fu.fogAddColor.a) + fu.fogAddColor.b * fu.fogAddColor.a),
            outColor.a
        );

    } else {
        outColor = textureSample(u_texture, u_sampler, texc);

        if(outColor.a < 0.1) {
            discard;
        }

        outColor = outColor * v.color;
    }

    return outColor;
}
