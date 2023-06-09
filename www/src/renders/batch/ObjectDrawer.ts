import {ObjectRenderer} from "vauxcel";

export class ObjectDrawer extends ObjectRenderer
{
    [key: string]: any;

    constructor(renderer) {
        super(renderer);
    }

    initQubatch(context) {
        this.context = context;
    }
}
