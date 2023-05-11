import { Container } from '../../scene/Container';
import { MeshRenderable } from './MeshRenderable';

import type { Texture } from '../../renderers/shared/texture/Texture';
import type { MeshGeometry } from './MeshGeometry';
import type { MeshRenderableOptions } from './MeshRenderable';

export class Mesh extends Container<MeshRenderable>
{
    constructor(options: Omit<MeshRenderableOptions, 'renderableData'>)
    {
        super();

        this.renderable = new MeshRenderable({ ...options, renderableData: this });
    }

    get texture()
    {
        return this.renderable.texture;
    }

    set texture(value: Texture)
    {
        this.renderable.texture = value;
    }

    get geometry()
    {
        return this.renderable.geometry;
    }

    set geometry(value: MeshGeometry)
    {
        this.renderable.geometry = value;
    }
}

