import { ExtensionType } from '../../../../extensions/Extensions.js';
import { Matrix } from '../../../../maths/Matrix.js';
import { BindGroup } from '../../gpu/shader/BindGroup.js';
import { UniformGroup } from '../shader/UniformGroup.js';

import type { ExtensionMetadata } from '../../../../extensions/Extensions.js';
import type { WebGPURenderer } from '../../gpu/WebGPURenderer.js';
import type { Renderer } from '../../types.js';
import type { ISystem } from '../system/ISystem.js';

export type GlobalUniformGroup = UniformGroup<{
    projectionMatrix: { value: Matrix; type: string }
    worldTransformMatrix: { value: Matrix; type: string }
    worldAlpha: { value: number; type: string }
}>;

export class GlobalUniformSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'globalUniforms',
    };

    renderer: Renderer;
    bindGroup: BindGroup;
    rootUniformsAndBindGroup: GlobalUniformGroup;

    stackIndex = 0;
    bindGroupStack: BindGroup[] = [];

    globalUniformsPool: GlobalUniformGroup[] = [];
    activeUniforms: GlobalUniformGroup[] = [];

    bindGroupPool: BindGroup[] = [];
    activeBindGroups: BindGroup[] = [];

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    reset(projection: Matrix): void
    {
        this.stackIndex = 0;

        for (let i = 0; i < this.activeUniforms.length; i++)
        {
            this.globalUniformsPool.push(this.activeUniforms[i]);
        }

        for (let i = 0; i < this.activeBindGroups.length; i++)
        {
            this.bindGroupPool.push(this.activeBindGroups[i]);
        }

        this.activeUniforms.length = 0;
        this.activeBindGroups.length = 0;

        this.push(projection, Matrix.IDENTITY, 1);
    }

    bind(projection: Matrix, transform: Matrix, alpha: number)
    {
        const uniformGroup = this.globalUniformsPool.pop() || this.createUniforms();

        this.activeUniforms.push(uniformGroup);

        uniformGroup.uniforms.projectionMatrix = projection;
        uniformGroup.uniforms.worldTransformMatrix = transform;
        uniformGroup.uniforms.worldAlpha = alpha;

        uniformGroup.update();

        if ((this.renderer as WebGPURenderer).renderPipes.uniformBatch)
        {
            this.bindGroup = (this.renderer as any).renderPipes.uniformBatch.getUniformBindGroup(uniformGroup);
        }
        else
        {
            this.renderer.uniformBuffer.updateUniformGroup(uniformGroup as any);

            this.bindGroup = this.bindGroupPool.pop() || new BindGroup();
            this.activeBindGroups.push(this.bindGroup);
            this.bindGroup.setResource(uniformGroup, 0);
        }
    }

    get uniformGroup()
    {
        return this.bindGroup.resources[0] as UniformGroup;
    }

    push(projection: Matrix, transform: Matrix, alpha: number): void
    {
        this.bind(projection, transform, alpha);

        this.bindGroupStack[this.stackIndex] = this.bindGroup;

        this.stackIndex++;
    }

    pop()
    {
        this.stackIndex--;
        this.bindGroup = this.bindGroupStack[this.stackIndex - 1];
    }

    createUniforms(): GlobalUniformGroup
    {
        const globalUniforms = new UniformGroup({
            projectionMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
            worldTransformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
            // TODO - someone smart - set this to be a unorm8x4 rather than a vec4<f32>
            worldAlpha: { value: 1, type: 'f32' },
        }, {
            ubo: true,
            isStatic: true,
        });

        return globalUniforms;
    }

    destroy()
    {
        // boom!
    }
}
