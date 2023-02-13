import {ObjectDrawer} from "../batch/ObjectDrawer.js";

export class GPUCubeDrawer extends ObjectDrawer {
    [key: string]: any;
    draw(cube) {
        const { context } = this;
        if (geom.size === 0) {
            return;
        }

        material.shader.bind();
        geom.bind(material.shader);

        if (a_pos) {
            material = material.getSubMat();
            context.subMats.push(material);
        }


        material.updatePos(a_pos, modelMatrix);
        material.bind(context);

        context.passEncoder.setPipeline(material.pipeline);

        geom.buffers.forEach((e, i) => {
            e.bind();
            if (e.index) {
                context.passEncoder.setIndexBuffer(e.buffer, 'uint16');
                return;
            }

            context.passEncoder.setVertexBuffer(i, e.buffer);
        })


        context.passEncoder.setBindGroup(0, material.group);

        if(material.skinGroup)
            context.passEncoder.setBindGroup(1, material.skinGroup);

        context.passEncoder.draw(6, geom.size, 0, 0);
    }
}