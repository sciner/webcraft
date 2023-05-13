import {TrivialShaderSource} from "../renderers/shared/shader/TrivialShaderSource.js";

export let mesh_src = new TrivialShaderSource();

mesh_src.vertex = `in vec2 aPosition;
in vec2 aUV;

uniform globalUniforms {
  mat3 projectionMatrix;
  mat3 worldTransformMatrix;
  float worldAlpha;
};

uniform mat3 transformMatrix;
uniform vec4 color;

out vec2 vTextureCoord;
out vec4 vColor;

void main(void){
    gl_Position = vec4((projectionMatrix * worldTransformMatrix * transformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);

    vTextureCoord = aUV;
    
    vColor = color * worldAlpha;
}
`;

mesh_src.fragment = `in vec2 vTextureCoord;
in vec4 vColor;

uniform sampler2D uTexture;

out vec4 outColor;

void main(void){
   outColor = texture(uTexture, vTextureCoord) * vColor;
}
`;

mesh_src.source = `struct GlobalUniforms {
  projectionMatrix:mat3x3<f32>,
  worldTransformMatrix:mat3x3<f32>,
  worldAlpha: f32
}

struct LocalUniforms {
  transformMatrix:mat3x3<f32>,
  color:vec4<f32>
}


@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms: LocalUniforms;

@group(2) @binding(0) var uTexture: texture_2d<f32>;
@group(2) @binding(1) var uSampler: sampler;



struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color : vec4<f32>,
  };

  
@vertex
fn mainVertex(
  @location(0) aPosition : vec2<f32>, 
  @location(1) aUV : vec2<f32>,
) -> VSOutput {

    var  mvpMatrix = globalUniforms.projectionMatrix * globalUniforms.worldTransformMatrix * localUniforms.transformMatrix;

    var  colorOut = localUniforms.color;

    colorOut.r *= colorOut.a;
    colorOut.g *= colorOut.a;
    colorOut.b *= colorOut.a;
    
  return VSOutput(
    vec4<f32>((mvpMatrix * vec3<f32>(aPosition, 1.0)).xy, 0.0, 1.0),
    aUV,
    colorOut,
  );
};


@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) color:vec4<f32>,
) -> @location(0) vec4<f32> {

  return textureSample(uTexture, uSampler, uv) * color;
  
}
`;