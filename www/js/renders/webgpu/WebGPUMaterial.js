import {BaseMaterial} from "../BaseRenderer.js";

export class WebGPUMaterial extends BaseMaterial {
    /**
     *
     * @param {WebGPURenderer} render
     * @private
     */
    _init(render) {
        const {
            device,
            activePipeline
        } = render;

        if (this.group) {
            this.group.destroy();
        }

        this.group = device.createBindGroup({
            // we should restricted know group and layout
            // will think that always 0
            layout: activePipeline.getBindGroupLayout(0),
            entries: [
                // what should be this?
            ]
        });
    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    bind(render) {
        if (!this.group)
            this._init(render);

        render.activeBindings.push(this.group);
    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    unbind(render) {
        const index = render.activeBindings.indexOf(this.group);

        if (index > -1) {
            render.activeBindings.splice(index, 1);
        }
    }
}