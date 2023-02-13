/**
 * Flexible wrapper around `ArrayBuffer` that also provides typed array views on demand.
 * copied from PixiJS
 */
export class ViewableBuffer
{
    [key: string]: any;
    constructor(sizeOrBuffer)
    {
        if (typeof sizeOrBuffer === 'number')
        {
            /**
             * Underlying `ArrayBuffer` that holds all the data and is of capacity `this.size`.
             *
             * @member {ArrayBuffer}
             */
            this.rawBinaryData = new ArrayBuffer(sizeOrBuffer);
        }
        else if (sizeOrBuffer instanceof Uint8Array)
        {
            this.rawBinaryData = sizeOrBuffer.buffer;
        }
        else
        {
            this.rawBinaryData = sizeOrBuffer;
        }

        this.uint32View = new Uint32Array(this.rawBinaryData);

        this.float32View = new Float32Array(this.rawBinaryData);
    }

    get int8View()
    {
        if (!this._int8View)
        {
            this._int8View = new Int8Array(this.rawBinaryData);
        }

        return this._int8View;
    }

    get uint8View()
    {
        if (!this._uint8View)
        {
            this._uint8View = new Uint8Array(this.rawBinaryData);
        }

        return this._uint8View;
    }

    get int16View()
    {
        if (!this._int16View)
        {
            this._int16View = new Int16Array(this.rawBinaryData);
        }

        return this._int16View;
    }

    get uint16View()
    {
        if (!this._uint16View)
        {
            this._uint16View = new Uint16Array(this.rawBinaryData);
        }

        return this._uint16View;
    }

    get int32View()
    {
        if (!this._int32View)
        {
            this._int32View = new Int32Array(this.rawBinaryData);
        }

        return this._int32View;
    }

    view(type)
    {
        return this[`${type}View`];
    }

    destroy()
    {
        this.rawBinaryData = null;
        this._int8View = null;
        this._uint8View = null;
        this._int16View = null;
        this._uint16View = null;
        this._int32View = null;
        this.uint32View = null;
        this.float32View = null;
    }

    static sizeOf(type)
    {
        switch (type)
        {
            case 'int8':
            case 'uint8':
                return 1;
            case 'int16':
            case 'uint16':
                return 2;
            case 'int32':
            case 'uint32':
            case 'float32':
                return 4;
            default:
                throw new Error(`${type} isn't a valid view type`);
        }
    }
}
