import {Vector} from "../helpers.js";
import type { BaseRenderer } from "../renders/BaseRenderer.js";
import {Buffer, Geometry, TYPES} from 'vauxcel';

const MIN_LINES_COUNT = 12
const STRIDE_FLOATS = 8

export class LineGeometry extends Geometry {
    [key: string]: any;

    constructor() {
        super();
        // убрал, для уменьшения объема оперативной памяти
        // this.vertices = vertices;
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = STRIDE_FLOATS;
        this.stride = this.strideFloats * 4;

        this.resize(MIN_LINES_COUNT);
        this.buffer = new Buffer(this.data, true);
        /**
         *
         * @type {BaseRenderer}
         */
        this.context = null;

        this.pos = new Vector();

        this.defAABBColor = 0xFF0000FF; // AARRGGBB
        this.defLineColor = 0xFFFFFFFF;
        this.defGridColor = 0xFF00FF00;

        this.defLineWidth = .5;
        this.defAABBWidth = .5;
        this.defGridWidth = .3;

        this.initGeom();
    }

    resize(cnt : int) {
        this.size = cnt;
        const oldData = this.data;
        this.data = new Float32Array(this.strideFloats * cnt);
        this.uint32View = new Uint32Array(this.data.buffer);
        if (oldData) {
            this.data.set(oldData, 0);
            this.buffer?.update(this.data);
        }
    }

    initGeom() {
        const {stride, buffer} = this;
        this.addAttribute('a_point1', buffer, 3, false,undefined, stride, 0, 1);
        this.addAttribute('a_point2', buffer, 3, false, undefined, stride, 3 * 4, 1);
        this.addAttribute('a_lineWidth', buffer, 1, false, undefined, stride, 6 * 4, 1);
        this.addAttribute('a_color', buffer, 4, true, TYPES.UNSIGNED_BYTE, stride, 7 * 4, 1);
        this.addAttribute('a_quad', LineGeometry.quadBuf, 2);
    }

    bind(shader) {
        if (shader) {
            this.context = shader.context;
        }
        this.context.pixiRender.geometry.bind(this);
    }

    clear() {
        this.instances = 0;
        this.updateID++;
    }

    ensureCapacity(extraInstances) {
        while (this.instances + extraInstances > this.size) {
            this.resize(this.size * 2);
        }
    }

    addLineInner(x1, y1, z1, x2, y2, z2, isLocal, lineWidth, colorABGR) {
        const {data, uint32View, strideFloats, pos} = this;
        let ind = (this.instances++) * strideFloats;
        if (isLocal) {
            data[ind++] = x1;
            data[ind++] = z1;
            data[ind++] = y1;
            data[ind++] = x2;
            data[ind++] = z2;
            data[ind++] = y2;
        } else {
            data[ind++] = x1 - pos.x;
            data[ind++] = z1 - pos.z;
            data[ind++] = y1 - pos.y;
            data[ind++] = x2 - pos.x;
            data[ind++] = z2 - pos.z;
            data[ind++] = y2 - pos.y;
        }
        data[ind++] = lineWidth;
        uint32View[ind++] = colorABGR;
        this.buffer?.update();
    }

    addLine(vec1, vec2, {
        isLocal = false,
        lineWidth = this.defLineWidth,
        colorABGR = this.defLineColor
    }) {
        this.addLineInner(vec1.x, vec1.y, vec1.z, vec2.x, vec2.y, vec2.z, isLocal, lineWidth, colorABGR)
    }

    addAABB(aabb, {
        isLocal = false,
         lineWidth = this.defAABBWidth,
         colorABGR = this.defAABBColor}) {
        this.ensureCapacity(12);
        for (let d1 = 0; d1 <= 1; d1++) {
            for (let d2 = 0; d2 <= 1; d2++) {
                let x1 = d1 ? aabb.x_max : aabb.x_min;
                let y2 = d2 ? aabb.y_max : aabb.y_min;
                this.addLineInner(
                    x1, y2, aabb.z_min,
                    x1, y2, aabb.z_max,
                    isLocal, lineWidth, colorABGR
                );
                let z2 = d2 ? aabb.z_max : aabb.z_min;
                this.addLineInner(
                    x1, aabb.y_min, z2,
                    x1, aabb.y_max, z2,
                    isLocal, lineWidth, colorABGR
                );
                let y1 = d1 ? aabb.y_max : aabb.y_min;
                this.addLineInner(
                    aabb.x_min, y1, z2,
                    aabb.x_max, y1, z2,
                    isLocal, lineWidth, colorABGR
                );
            }
        }
    }

    addBlockGrid({pos, size, isLocal = false,
                     lineWidth = this.defGridWidth, colorABGR = this.defGridColor}) {
        this.ensureCapacity((size.x * size.y + size.x * size.z + size.y * size.z) * 2);
        let x_min = pos.x, y_min = pos.y, z_min = pos.z;
        let x_max = pos.x + size.x, y_max = pos.y + size.y, z_max = pos.z + size.z;
        for (let d1 = 0; d1 <= 1; d1++) {
            for (let d2 = 0; d2 <= size.y; d2++) {
                let x1 = pos.x + d1 * size.x;
                let y2 = pos.y + d2;
                this.addLineInner(
                    x1, y2, z_min,
                    x1, y2, z_max,
                    isLocal, lineWidth, colorABGR
                )

                let z1 = pos.z + d1 * size.z;
                this.addLineInner(
                    x_min, y2, z1,
                    x_max, y2, z1,
                    isLocal, lineWidth, colorABGR
                )
            }

            for (let d2 = 0; d2 <= size.x; d2++) {
                let y1 = pos.y + d1 * size.y;
                let x2 = pos.x + d2;
                this.addLineInner(
                    x2, y1, z_min,
                    x2, y1, z_max,
                    isLocal, lineWidth, colorABGR
                )

                let z1 = pos.z + d1 * size.z;
                this.addLineInner(
                    x2, y_min, z1,
                    x2, y_max, z1,
                    isLocal, lineWidth, colorABGR
                )
            }

            for (let d2 = 0; d2 <= size.z; d2++) {
                let y1 = pos.y + d1 * size.y;
                let z2 = pos.z + d2;
                this.addLineInner(
                    x_min, y1, z2,
                    x_max, y1, z2,
                    isLocal, lineWidth, colorABGR
                )

                let x2 = pos.x + d1 * size.x;
                this.addLineInner(
                    x2, y_min, z2,
                    x2, y_max, z2,
                    isLocal, lineWidth, colorABGR
                )
            }
        }
    }

    destroy() {
        // we not destroy it, it shared
        super.destroy();
    }

    draw(render : BaseRenderer) {
        render.batch.setObjectRenderer(render.line);
        render.line.draw(this);
    }

    static quadBuf = new Buffer(new Float32Array([
        0., -1.,
        1., -1.,
        1., 1.,
        0., -1.,
        1., 1.,
        0., 1.]
    ), true);
}
