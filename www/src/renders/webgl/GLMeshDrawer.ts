import {ObjectDrawer} from "../batch/ObjectDrawer.js";

export class GLMeshDrawer extends ObjectDrawer {
    [key: string]: any;
    draw(geom, material?, a_pos = null, modelMatrix = null, draw_type = 'triangles') {
        const { context } = this;
        if (geom.size === 0) {
            return;
        }
        let gl = context.gl;
        switch(draw_type) {
            case 'triangles': {
                draw_type = gl.TRIANGLES;
                break;
            }
            case 'line_loop': {
                draw_type = gl.LINE_LOOP;
                break;
            }
        }
        material.shader.updatePos(a_pos, modelMatrix);
        material.bind();
        geom.bind(material.shader);
        gl.drawArraysInstanced(draw_type, 0, 6, geom.size);
        // stat
        context.stat.drawquads += geom.size;
        context.stat.drawcalls++;
    }
}