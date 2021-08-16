const SHADER = `

var<private> FAR: f32 = 10000.0;
var<private> NEAR: f32 = 10.0;

fn perspectiveDepthToViewZ(invClipZ : f32) -> f32 {
       return ( NEAR * FAR ) / ( ( FAR - NEAR ) * invClipZ - FAR );
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

[[group(0), binding(0)]] var u_depth: texture_depth_2d;

[[stage(fragment)]]
fn main_frag([[location(0)]] coord : vec2<f32>) -> [[location(0)]] vec4<f32> {
  let size = textureDimensions(u_depth, 0);
  let fp = vec2<i32>(coord.xy * vec2<f32>(size));
  let d =  1.0 /  (1. - textureLoad(u_depth, fp,0));
  let result = perspectiveDepthToViewZ(d);

  return vec4<f32> (result, result, result, 1.0);
}
`;
export class Postprocess {
    constructor(context, options) {
        this.context = context;
        this.options = options;

        const {
            device
        } = context;

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

        this.ubo = device.createBuffer({
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            size: 2 * 4
        });
    }

    /**
     *
     * @param {GPUCommandEncoder} commandEncoder
     */
    run(commandEncoder) {
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
                    view: this.context.currentBackTexture,
                    loadValue: 'load',
                    storeOp: 'store',
                }
            ],
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setViewport(size.width - 200,0, 200, 200, 0, 1);
        renderPass.setBindGroup(0, this.group);
        renderPass.draw(6);
        renderPass.endPass();
    }

    resize(w, h) {
        const {
            device
        } = this.context;

        device.queue.writeBuffer(this.ubo, 0, new Float32Array([200, 200]).buffer);

        this.group = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.context.depth.createView({aspect: "depth-only"})
                }
            ]
        })
    }
}