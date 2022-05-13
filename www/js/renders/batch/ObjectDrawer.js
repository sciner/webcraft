export class ObjectDrawer
{
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
