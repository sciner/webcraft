export class ObjectDrawer
{
    [key: string]: any;
    constructor(context)
    {
        this.context = context;
    }

    flush()
    {
        // flush!
    }

    destroy()
    {
        this.context = null;
    }

    start()
    {
        // set the shader..
    }

    stop()
    {
        this.flush();
    }

    draw(obj)
    {
        // render the object
    }
}
