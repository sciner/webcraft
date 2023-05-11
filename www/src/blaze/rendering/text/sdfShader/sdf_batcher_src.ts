import {TrivialShaderSource} from "../renderers/shared/shader/TrivialShaderSource.js";

export let sdf_batcher_src = new TrivialShaderSource();

sdf_batcher_src.vert = `precision highp float;
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
in float aTextureId;

uniform globalUniforms {
  mat3 projectionMatrix;
  mat3 worldTransformMatrix;
  float worldAlpha;
};

uniform mat3 transformMatrix;
uniform vec4 color;

out vec2 vTextureCoord;
out vec4 vColor;
out float vTextureId;

void main(void){
    gl_Position = vec4((projectionMatrix * worldTransformMatrix * transformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);

    vTextureCoord = aUV;
    vTextureId = aTextureId;
    
    vec4 colorOut = aColor.bgra * color.rgba;

    colorOut.rgb *= aColor.a;
    colorOut *=  worldAlpha;

    vColor = colorOut;
}
`;

sdf_batcher_src.frag = `in vec2 vTextureCoord;
in vec4 vColor;
in float vTextureId;

uniform sampler2D uSamplers[%count%];
uniform float distance;

out vec4 finalColor;

void main(void){
    vec4 outColor;
    %forloop%


    // To stack MSDF and SDF we need a non-pre-multiplied-alpha texture.
   outColor.rgb = outColor.rgb / outColor.a;

    // MSDF
    float median = outColor.r + outColor.g + outColor.b -
                    min(outColor.r, min(outColor.g, outColor.b)) -
                    max(outColor.r, max(outColor.g, outColor.b));
   
    // SDF
    median = min(median, outColor.a);

    float screenPxDistance = distance * (median - 0.5);
    float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
    if (median < 0.01) {
        alpha = 0.0;
    } else if (median > 0.99) {
        alpha = 1.0;
    }

    finalColor =  vec4(vColor.rgb * alpha, alpha);
}
`;

sdf_batcher_src.source = `struct GlobalUniforms {
  projectionMatrix:mat3x3<f32>,
  worldTransformMatrix:mat3x3<f32>,
  worldAlpha: f32
}

struct LocalUniforms {
  color:vec4<f32>,
  transformMatrix:mat3x3<f32>,
  distance: f32
}

// struct DistanceUniforms {
//   distance: f32,
// }

@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
%bindings%
@group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
//@group(3) @binding(0) var<uniform> distanceUniforms : DistanceUniforms;


struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color : vec4<f32>,
    @location(2) @interpolate(flat) textureId : u32,
  };

  
@vertex
fn mainVertex(
  @location(0) aPosition : vec2<f32>, 
  @location(1) aUV : vec2<f32>,
  @location(2) aColor : vec4<f32>,
  @location(3) aTexture : f32,
) -> VSOutput {

  var  mvpMatrix = globalUniforms.projectionMatrix * globalUniforms.worldTransformMatrix * localUniforms.transformMatrix;

  var  colorOut = aColor.bgra * localUniforms.color.rgba;

  var alpha = vec4<f32>(
    colorOut.a * globalUniforms.worldAlpha,
    colorOut.a * globalUniforms.worldAlpha,
    colorOut.a * globalUniforms.worldAlpha,
    globalUniforms.worldAlpha
  );

  colorOut *= alpha;


  return VSOutput(
    vec4<f32>((mvpMatrix * vec3<f32>(aPosition, 1.0)).xy, 0.0, 1.0),
    aUV,
    colorOut,
    u32(aTexture)
  );
};


@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) color:vec4<f32>,
  @location(2) @interpolate(flat) textureId: u32,
) -> @location(0) vec4<f32> {


    var uvDx = dpdx(uv);
    var uvDy = dpdy(uv);

    var outColor:vec4<f32>;
    
    %forloop%
  
    var dist = outColor.r;

    // MSDF
  var median = outColor.r + outColor.g + outColor.b -
      min(outColor.r, min(outColor.g, outColor.b)) -
      max(outColor.r, max(outColor.g, outColor.b));
  // SDF
  median = min(median, outColor.a);

  // on 2D applications fwidth is screenScale / glyphAtlasScale * distanceFieldRange
  
  var screenPxDistance = localUniforms.distance * (median - 0.5);
  var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
  if (median < 0.01) {
    alpha = 0.0;
  } else if (median > 0.99) {
    alpha = 1.0;
  }

  return vec4(color.rgb * alpha, alpha);
};
`;