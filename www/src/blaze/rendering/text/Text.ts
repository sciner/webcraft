import { Container } from '../scene/Container';
import { TextRenderable } from './TextRenderable';

import type { TextOptions } from './TextRenderable';
import type { TextStyle } from './TextStyle';

export class Text extends Container<TextRenderable>
{
    constructor(options: TextOptions)
    {
        super();

        this.renderable = new TextRenderable(options, this);
    }

    get anchor()
    {
        return this.renderable.anchor;
    }

    set text(value: string)
    {
        this.renderable.text = value;
    }

    get text(): string
    {
        return this.renderable.text;
    }

    set style(value: TextStyle | Partial<TextStyle>)
    {
        this.renderable.style = value;
    }

    get style(): TextStyle
    {
        return this.renderable.style;
    }
}
