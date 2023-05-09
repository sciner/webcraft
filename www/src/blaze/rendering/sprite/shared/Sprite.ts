import { Cache } from '../../../assets/cache/Cache';
import { Texture } from '../../renderers/shared/texture/Texture';
import { Container } from '../../scene/Container';
import { SpriteRenderable } from './SpriteRenderable';

export class Sprite extends Container<SpriteRenderable>
{
    static from(id: Texture | string)
    {
        if (typeof id === 'string')
        {
            return new Sprite(Cache.get(id));
        }

        return new Sprite(id);
    }

    constructor(texture: Texture = Texture.EMPTY)
    {
        super();

        this.renderable = new SpriteRenderable(texture, this);
    }

    get anchor()
    {
        return this.renderable.anchor;
    }

    get texture()
    {
        return this.renderable.texture;
    }

    set texture(value: Texture)
    {
        this.renderable.texture = value;
    }
}
