import { ObjectDrawer } from './ObjectDrawer.js';

/**
 * copied from PixiJS
 */
export class BatchSystem
{
    [key: string]: any;
    constructor(context)
    {
        this.context = context;

        this.emptyDrawer = new ObjectDrawer(context);
        this.currentDrawer = this.emptyDrawer;
    }

    setObjectDrawer(objectDrawer)
    {
        if (this.currentDrawer === objectDrawer)
        {
            return;
        }

        this.currentDrawer.stop();
        this.currentDrawer = objectDrawer;

        this.currentDrawer.start();
    }

    flush()
    {
        this.setObjectDrawer(this.emptyDrawer);
    }

    reset()
    {
        this.setObjectDrawer(this.emptyDrawer);
    }

    destroy()
    {
        this.renderer = null;
    }
}
