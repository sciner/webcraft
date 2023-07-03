import {ObjectDrawer} from "../batch/ObjectDrawer.js";
import {ExtensionType, Geometry} from "vauxcel";
import {IvanArray} from "../../helpers.js";
import type {MeshPart} from "../../mesh/mesh_builder.js";
import {MultiDrawBuffer} from "./multi_draw_buffer.js";

export class GLMeshDrawer extends ObjectDrawer {
    [key: string]: any;

    static extension = {
        name: 'mesh',
        type: ExtensionType.RendererPlugin,
    };

    mdb = new MultiDrawBuffer();

    draw(geom, material?, a_pos = null, modelMatrix = null, draw_type = 'triangles',
         start: number = 0, size: number = geom.size) {
        if (this.parts.count) {
            this.flush();
        }
        const { context } = this;
        if (geom.size === 0) {
            return;
        }
        let gl = context.gl;
        let gl_draw_type: number;
        switch(draw_type) {
            case 'triangles': {
                gl_draw_type = gl.TRIANGLES;
                break;
            }
            case 'line_loop': {
                gl_draw_type = gl.LINE_LOOP;
                break;
            }
        }
        material.shader.updatePos(a_pos, modelMatrix);
        material.bind();
        geom.bind(material.shader);
        gl.drawArraysInstanced(gl_draw_type, 0, 6, size);
        // stat
        context.stat.drawquads += geom.size;
        context.stat.drawcalls++;
    }

    parts = new IvanArray<MeshPart>();

    curMat: any;
    curGeom: Geometry;

    batchPart(part, material?, a_pos = null, modelMatrix = null) {
        if (this.curGeom && (this.curMat !== material || this.curGeom !== material)) {
            this.flush();
        }
        this.draw(part.geom, material, a_pos, modelMatrix, 'triangles', part.start, part.size)
    }

    flush() {
        this.curGeom = null;
        this.curMat = null;
    }
}