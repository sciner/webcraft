import { Vector } from '../../helpers.js';
import GeometryTerrain from '../../geometry_terrain.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { Renderer } from '../../render.js';
import type { WebGLMaterial } from '../../renders/webgl/WebGLMaterial.js';

const {mat4, vec3, quat} = glMatrix;

declare interface ivec3 {
    set(arr : float[]) : any
}

const _mx = mat4.create()
const _pos = new Vector();

// Any mesh
export class Mesh_Object_Base {
    pos:                    Vector = new Vector(0, 0, 0)
    life:                   float = 1.0
    flags:                  int = 0
    matrix:                 imat4 = mat4.create()
    gl_material?:           WebGLMaterial
    vertices:               float[] = []
    buffer?:                GeometryTerrain
    lightTex?:              any
    visible:                boolean = true
    scale:                  ivec3 = vec3.create()
    pivot:                  ivec3 = vec3.create()
    position:               ivec3 = vec3.create()
    rotation:               ivec3 = vec3.create()
    quat:                   float[] = quat.create()
    ignoreParentRotation:   boolean = false

    // Constructor
    constructor(args? : any) {
        this.scale.set([1, 1, 1])
    }

    setGLMaterial(gl_material : any) {
        this.gl_material = gl_material
    }

    setVertices(vertices : float[]) {
        this.vertices = vertices
        this.rebuild()
    }

    changeFlags(flags: int) {
        this.flags = flags
        if(this.buffer) {
            this.buffer.changeFlags(flags)
        }
    }

    rebuild() {
        if(this.buffer) {
            this.buffer.destroy()
            this.buffer = null
        }
        this.buffer = new GeometryTerrain(this.vertices)
        this.buffer.changeFlags(this.flags)
    }

    updateMatrix() {
        mat4.identity(this.matrix)
        quat.fromEuler(this.quat, this.rotation[0], this.rotation[1], this.rotation[2], 'zyx')
        mat4.fromRotationTranslationScaleOrigin(this.matrix, this.quat, this.position, this.scale, this.pivot)
    }

    // Draw
    draw(render : Renderer, delta : float) {
        this.drawBuffer(render, this.pos, this.matrix)
    }

    // Draw directly without any pre-computation
    drawBuffer(render : Renderer, pos : Vector, mx : imat4) {
        if(this.buffer && this.visible) {
            if (this.ignoreParentRotation) {
                _pos.copyFrom(pos);
                _pos.addScalarSelf(mx[12], mx[13], mx[14])
                render.renderBackend.drawMesh(this.buffer, this.gl_material, _pos, this.matrix)
            } else {
                mat4.identity(_mx)
                mat4.multiply(_mx, mx, this.matrix)
                // TODO: need to update this.lightTex befor draw?
                render.renderBackend.drawMesh(this.buffer, this.gl_material, pos, _mx)
            }
        }
    }

    destroy() {
        if(this.buffer) {
            this.buffer.destroy()
            this.buffer = null
        }
    }

    get isAlive() : boolean {
        return this.life > 0;
    }

    // TODO: Update light texture from chunk
    // updateLightTex(render) {
    //     const chunk = render.world.chunkManager.getChunk(this.chunk_addr);
    //     if (!chunk) {
    //         return;
    //     }
    //     this.chunk = chunk;
    //     this.lightTex = chunk.getLightTexture(render.renderBackend);
    // }

}