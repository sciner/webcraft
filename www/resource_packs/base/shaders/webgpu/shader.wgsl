struct VExtendUniform {
    ModelMatrix : mat4x4<f32>;
    add_pos : vec3<f32>;
};

struct VUniforms {
    ProjMatrix : mat4x4<f32>;
    worldView : mat4x4<f32>;
    fogOn : f32;
    brightness : f32;
};

struct TextureUniforms {
    pixelSize : f32;
    blockSize: f32;
    mipmap: f32;
};

struct FUniforms {
    // Fog
    fogColor : vec4<f32>;
    fogAddColor : vec4<f32>;
    //fogDensity : f32;
    //fogOn: bool;
    chunkBlockDist: f32;
    //
    // brightness : f32;
    opaqueThreshold : f32;
};

struct Attrs {
    [[location(0)]] position : vec3<f32>;
    [[location(1)]] axisX : vec3<f32>;
    [[location(2)]] axisY : vec3<f32>;

    [[location(3)]] uvCenter : vec2<f32>;
    [[location(4)]] uvSize : vec2<f32>;

    [[location(5)]] color : vec3<f32>;

    [[location(6)]] flags : f32;

    [[location(7)]] quad : vec2<f32>;
};

struct VertexOutput {
    [[builtin(position)]] VPos : vec4<f32>;
    [[location(0)]] position : vec3<f32>;
    [[location(1)]] texcoord : vec2<f32>;
    [[location(2)]] texClamp : vec4<f32>;
    [[location(3)]] color : vec4<f32>;
    [[location(4)]] normal : vec3<f32>;
    [[location(5)]] chunk_pos : vec3<f32>;
};

[[group(0), binding(0)]] var<uniform> u : VUniforms;
[[group(0), binding(1)]] var<uniform> fu : FUniforms;

[[group(1), binding(0)]] var<uniform> eu : VExtendUniform;
[[group(1), binding(1)]] var u_sampler: sampler;
[[group(1), binding(2)]] var u_texture: texture_2d<f32>;
[[group(1), binding(3)]] var<uniform> tu : TextureUniforms;
[[group(1), binding(4)]] var lightTexSampler: sampler;
[[group(1), binding(5)]] var lightTex: texture_3d<f32>;


[[stage(vertex)]]
fn main_vert(a : Attrs) -> VertexOutput {
    var v: VertexOutput;

    v.color = vec4<f32>(a.color, 1.0);

    // find flags
    var flagBiome : f32 = step(1.5, a.flags);
    var flags : f32 = a.flags - flagBiome * 2.0;
    var flagNormalUp : f32 = step(0.5, flags);

    if (flagNormalUp > 0.0) {
        v.normal = -a.axisY;
    } else {
        v.normal = normalize(cross(a.axisX, a.axisY));
    }

    v.normal = (eu.ModelMatrix * vec4<f32>(v.normal, 0.0)).xyz;

    var pos : vec3<f32> = a.position + (a.axisX * a.quad.x) + (a.axisY * a.quad.y);
    v.texcoord = a.uvCenter + (a.uvSize * a.quad);
    v.texClamp = vec4<f32>(a.uvCenter - abs(a.uvSize * 0.5) + tu.pixelSize * 0.5, a.uvCenter + abs(a.uvSize * 0.5) - tu.pixelSize * 0.5);

    if(u.fogOn > 0.0) {
        if (flagBiome < 0.5) {
            v.color.r = -1.0;
        }
    }

    // 1. Pass the view position to the fragment shader
    v.chunk_pos = (eu.ModelMatrix * vec4<f32>(pos, 1.0)).xyz;
    v.position = v.chunk_pos + eu.add_pos;
    v.VPos = u.ProjMatrix * u.worldView * vec4<f32>(v.position, 1.0);

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

    if (tu.mipmap > 0.0) {
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
        var color : vec4<f32> = textureSampleLevel(u_texture, u_sampler, texc * mipScale + mipOffset, 0.0);

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
            var color_mask: vec4<f32> = textureSampleLevel(u_texture, u_sampler, vec2<f32>(texc.x + tu.blockSize, texc.y) * mipScale + mipOffset, 0.0);
            var color_mult: vec4<f32> = textureSampleLevel(u_texture, u_sampler, biome, 0.0);

            color = vec4<f32>(
                color.rgb + color_mask.rgb * color_mult.rgb,
                color.a
            );
        }

        /*
    var n : vec3<f32> = normalize(v.normal);
    var dayLight: f32 = max(.5, dot(n, sun_dir) - v.color.a);

    var lightCoord: vec3<f32> =  pos + v.normal.xzy * 0.5;
    lightCoord = lightCoord + vec3<f32>(1.0, 1.0, 1.0);
    lightCoord = lightCoord / vec3<f32>(20.0, 20.0, 44.0);
    var lightSample: f32 = textureSampleLevel(lightTex, lightTexSampler, lightCoord, 0.0).r;
    var nightLight: f32 = min(lightSample * 16.0, 1.0) * (1.0 - v.color.a);

    v.light = dayLight * u.brightness + nightLight * (1.0 - u.brightness);
        */

        var sun_dir : vec3<f32> = vec3<f32>(0.7, 1.0, 0.85);

        var lightCoord: vec3<f32> = (v.chunk_pos + 0.5) / vec3<f32>(18.0, 18.0, 84.0);
        var absNormal: vec3<f32> = abs(v.normal);
        var aoCoord: vec3<f32> = (v.chunk_pos + (v.normal + absNormal + 1.0) * 0.5) / vec3<f32>(18.0, 18.0, 84.0);

        var caveSample: f32 = textureSampleLevel(lightTex, lightTexSampler, lightCoord, 0.0).a;
        var daySample: f32 = 1.0 - textureSampleLevel(lightTex, lightTexSampler, lightCoord + vec3<f32>(0.0, 0.0, 0.5), 0.0).a;
        var aoSample: f32 = dot(textureSampleLevel(lightTex, lightTexSampler, aoCoord, 0.0).rgb, absNormal)  ;
        if (aoSample > 0.5) { aoSample = aoSample * 0.5 + 0.25; }
        aoSample = aoSample * 0.5;

        caveSample = caveSample * (1.0 - aoSample);
        daySample = daySample * (1.0 - aoSample - max(-v.normal.z, 0.0) * 0.2);

        var light: f32 = max(min(caveSample + daySample * u.brightness, 0.8 - aoSample), 0.2 * (1.0 - aoSample));
        // Apply light
        color = vec4<f32>(
            color.rgb * light,
            color.a
        );

        outColor = color;

        // Calc fog amount
        var fogDistance : f32 = length(v.position.xy);
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
