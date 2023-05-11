import { Buffer } from '../../buffer/Buffer.js';
import { BufferUsage } from '../../buffer/const.js';

import type { TypedArray } from '../../buffer/Buffer.js';

export function ensureIsBuffer(buffer: Buffer | TypedArray | number[], index: boolean): Buffer
{
    if (!(buffer instanceof Buffer))
    {
        let usage: number = index ? BufferUsage.INDEX : BufferUsage.VERTEX;

        // its an array!
        if (buffer instanceof Array)
        {
            if (index)
            {
                buffer = new Uint32Array(buffer);
                usage = BufferUsage.INDEX | BufferUsage.COPY_DST;
            }

            else
            {
                buffer = new Float32Array(buffer);
                usage = BufferUsage.VERTEX | BufferUsage.COPY_DST;
            }
        }

        buffer = new Buffer({
            data: buffer,
            label: 'index-mesh-buffer',
            usage
        });
    }

    return buffer;
}
