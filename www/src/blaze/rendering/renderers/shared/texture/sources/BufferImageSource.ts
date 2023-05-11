import { TextureSource } from './TextureSource.js';

import type { TypedArray } from '../../buffer/Buffer.js';
import type { TextureSourceOptions } from './TextureSource.js';

export interface BufferSourceOptions extends TextureSourceOptions<Buffer>
{
    width: number;
    height: number;
}

export class BufferImageSource extends TextureSource<TypedArray | ArrayBuffer>
{
    type = 'buffer';
}
