const SHADER = `

var<private> FAR: f32 = 1000.0;
var<private> NEAR: f32 = 10.0;

var<private> DOF: f32 = 0.5;
var<private> FOV: f32 = 0.53;

fn perspectiveDepthToViewZ(invClipZ : f32, near : f32, far: f32) -> f32 {
       return ( near * far ) / ( ( far - near ) * invClipZ - far );
}

fn worldDistToTexel(uv: vec2<f32>, depth: f32) -> f32 {
    var angle = 2. * (uv - vec2<f32>(0.5)) * FOV;

    return length(depth / cos(angle));
}

struct VertexOutput {
  [[builtin(position)]] pos : vec4<f32>;
  [[location(0)]] uv : vec2<f32>;
};

[[stage(vertex)]]
fn main_vert([[builtin(vertex_index)]] v_index : u32) -> VertexOutput{
    var output : VertexOutput;
    var pos = array<vec2<f32>, 6>(
        vec2<f32>( 1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0, -1.0), vec2<f32>(-1.0,  1.0));

        
    var uv = array<vec2<f32>, 6>(
      vec2<f32>(1.0, 0.0),vec2<f32>(1.0, 1.0),vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0));
    
    output.pos = vec4<f32>(pos[v_index], 0.0, 1.0);
    output.uv = uv[v_index];
    
    return output;
}

[[block]] struct Uniform {
    near: f32;
    far: f32;
    distance: f32;
    intensity: f32;
    count: f32;
};

[[group(0), binding(0)]] var u_depth: texture_depth_2d;
[[group(0), binding(1)]] var u_color: texture_2d<f32>;
[[group(0), binding(2)]] var u_sampler: sampler;
[[group(0), binding(3)]] var<uniform> ubo: Uniform;

[[stage(fragment)]]
fn main_frag([[location(0)]] coord : vec2<f32>) -> [[location(0)]] vec4<f32> {
  let size = vec2<f32>(textureDimensions(u_depth, 0));
  let fp = vec2<i32>(coord.xy * size);
  
  var texDepth = textureLoad(u_depth, fp,0);
  //var glDepth = 200. * (1. - texDepth);
  //var viewZ = perspectiveDepthToViewZ(glDepth, ubo.near, ubo.far);
  
  //viewZ = worldDistToTexel(coord.xy, viewZ);
 
  //let dof = clamp(0.0, 1.0, ubo.distance / 120.0);

  var blurFactor = clamp(0., 1., 1. - 300. * (1. - texDepth));

  var c = textureSample(u_color, u_sampler, coord);
  var blur: vec4<f32> = c;
  var count = i32(ubo.count);
  var runs = count * 2 + 1;

  for(var i: i32 = -count; i <= count; i = i + 1) {
      for(var j: i32 = -count; j <= count; j = j + 1) {
         blur = blur + ubo.intensity * textureSample(u_color, u_sampler, coord + blurFactor * vec2<f32>(f32(i), f32(j)) / size);
      }
  }
  
  c = blur / f32(runs * runs);
  
  return vec4<f32> (c.rgb, 1.0);
}
`;

const BLIT = `

struct VertexOutput {
  [[builtin(position)]] pos : vec4<f32>;
  [[location(0)]] uv : vec2<f32>;
};

[[stage(vertex)]]
fn main_vert([[builtin(vertex_index)]] v_index : u32) -> VertexOutput{
    var output : VertexOutput;
    var pos = array<vec2<f32>, 6>(
        vec2<f32>( 1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0, -1.0), vec2<f32>(-1.0,  1.0));

        
    var uv = array<vec2<f32>, 6>(
      vec2<f32>(1.0, 0.0),vec2<f32>(1.0, 1.0),vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0));
    
    output.pos = vec4<f32>(pos[v_index], 0.0, 1.0);
    output.uv = uv[v_index];
    
    return output;
}


[[group(0), binding(0)]] var u_color_blit: texture_2d<f32>;

[[stage(fragment)]]
fn blit_frag([[location(0)]] coord : vec2<f32>) -> [[location(0)]] vec4<f32> {
  let size = textureDimensions(u_color_blit, 0);
  let fp = vec2<i32>(coord.xy * vec2<f32>(size));

  return textureLoad(u_color_blit, fp,0);
}
`
export class Postprocess {
    constructor(context, options) {
        this.context = context;
        this.options = options;

        const {
            device
        } = context;

        this.data = new Float32Array([
            10,//near,
            1000,//far,
            0,//distance,
            1,//intensity,
            2,//count of blur
        ]);

        this.ubo = device.createBuffer({
            size: this.data.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            mappedAtCreation: true
        });

        new Float32Array(this.ubo.getMappedRange()).set(this.data);
        this.ubo.unmap();

        this.pipeline = device.createRenderPipeline({
            vertex: {
                module: device.createShaderModule({
                   code: SHADER
                }),
                entryPoint: 'main_vert'
            },

            fragment: {
                module: device.createShaderModule({
                    code: SHADER
                }),
                entryPoint: 'main_frag',
                targets: [
                    {
                        format: this.context.format
                    }
                ]
            },
            primitive: {
                cullMode: 'none',
                topology: 'triangle-list',
            }
        });

        this.blitPipeline = device.createRenderPipeline({
            vertex: {
                module: device.createShaderModule({
                    code: BLIT
                }),
                entryPoint: 'main_vert'
            },

            fragment: {
                module: device.createShaderModule({
                    code: BLIT
                }),
                entryPoint: 'blit_frag',
                targets: [
                    {
                        format: this.context.format
                    }
                ]
            },
            primitive: {
                cullMode: 'none',
                topology: 'triangle-list',
            }
        });

    }

    blit(commandEncoder, target) {
        const {
            device,
            size
        } = this.context;

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: target,
                    loadValue: [0,0,0,0],
                    storeOp: 'store',
                }
            ],
        });

        renderPass.setPipeline(this.blitPipeline);
        //renderPass.setViewport(size.width - 200,0, 200, 200, 0, 1);
        renderPass.setBindGroup(0, this.blitGroup);
        renderPass.draw(6);
        renderPass.endPass();
    }

    setAttribs({
                   far = 1000,
                   near = 10,
                   distance = 100,
                   intensity = 1,
    }) {
        this.data.set([
            near,
            far,
            distance,
            intensity,
            2
        ]);
    }

    /**
     *
     * @param {GPUCommandEncoder} commandEncoder
     */
    run(commandEncoder, target) {
        const {
            device,
            size
        } = this.context;

        if (!this.group) {
            this.resize(size.width, size.height);
        }

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: target,
                    loadValue: 'load',
                    storeOp: 'store',
                }
            ],
        });

        device.queue.writeBuffer(this.ubo, 0, this.data.buffer);

        renderPass.setPipeline(this.pipeline);
        //renderPass.setViewport(size.width - 200,0, 200, 200, 0, 1);
        renderPass.setBindGroup(0, this.group);
        renderPass.draw(6);
        renderPass.endPass();
    }

    resize(w, h) {
        const { device } = this.context;

        this.group = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.context.depth.createView({aspect: "depth-only"})
                },
                {
                    binding: 1,
                    resource: this.context.main.createView()
                },
                {
                    binding: 2,
                    resource: device.createSampler()
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.ubo
                    }
                }
            ]
        });


        this.blitGroup = device.createBindGroup({
            layout: this.blitPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.context.main.createView()
                },
            ]
        });
    }
}
