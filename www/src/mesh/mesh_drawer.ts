import {ObjectDrawer} from "../renders/batch/ObjectDrawer.js";
import {ExtensionType, Geometry, DRAW_MODES} from "vauxcel";
import {MultiDrawBuffer} from "../renders/webgl/multi_draw_buffer.js";
import {IvanArray} from "../helpers.js";
import type {MeshPart} from "./mesh_builder.js";

export class MeshDrawer extends ObjectDrawer {
    [key: string]: any;

    static extension = {
        name: 'mesh',
        type: ExtensionType.RendererPlugin,
    };

    mdb = new MultiDrawBuffer();

    draw(geom, material?, a_pos = null, modelMatrix = null, instanceCount: number = geom.size, baseInstance: number = 0) {
        if (this.parts.count) {
            this.flush();
        }
        const { context } = this;
        if (instanceCount === 0) {
            return;
        }
        material.shader.updatePos(a_pos, modelMatrix);
        material.bind();
        geom.bind(material.shader);
        if (baseInstance)
        {
            this.renderer.geometry.drawBI(DRAW_MODES.TRIANGLES, 6, 0, instanceCount, baseInstance);
        } else {
            this.renderer.geometry.draw(DRAW_MODES.TRIANGLES, 6, 0, instanceCount);
        }
        // stat
        context.stat.drawquads += geom.size;
        context.stat.drawcalls++;
    }

    parts = new IvanArray<MeshPart>();

    curMat: any = null;
    curGeom: Geometry = null;

    batchPart(part: MeshPart, material?, a_pos = null, modelMatrix = null) {
        // if (this.curGeom && (this.curMat !== material || this.curGeom !== material)) {
        //     this.flush();
        // }
        this.draw(part.geom, material, a_pos, modelMatrix, part.count, part.start)
    }

    flush() {
        this.curGeom = null;
        this.curMat = null;
    }
}
