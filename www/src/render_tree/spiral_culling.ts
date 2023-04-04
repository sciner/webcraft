import type {Plane, FrustumProxy} from "../frustum.js";
import type {SpiralGrid} from "../helpers/spiral_generator.js";
import {Vector} from "../helpers/vector.js";

const EPS = 1e-6;

class CalcLine {
    A = 0;
    B = 0;
    C = 0;
    D = 0;
    error = 0;
    // x = F * z + G;
    F = 0;
    G = 0;
    sign = 0;

    copyFrom(line2) {
        this.A = line2.A;
        this.B = line2.B;
        this.C = line2.C;
        this.D = line2.D;
        this.error = line2.error;
    }
}

class CalcSegment {
    left = 0;
    right = 0;
}

function numberSort(a, b) {
    return a - b;
}

function initLines(lines: CalcLine[], planes: Plane[], offset: Vector, result: CalcSegment) {
    for (let i = 0; i < 6; i++) {
        const line = lines[i];
        const plane = planes[i];
        line.D = plane.constant + plane.normal.x * tempVec.x
            + plane.normal.y * tempVec.y + plane.normal.z * tempVec.z;
        line.A = plane.normal.x;
        line.B = plane.normal.z;
        line.C = plane.normal.y;
        line.error = 0;
        if (Math.abs(line.A) < EPS) {
            if (Math.abs(line.B) < EPS) {
                if (line.C > 0) {
                    result.left = Math.max(result.left, -line.D / line.C);
                } else {
                    result.right = Math.min(result.right, -line.D / line.C);
                }
                line.error = 1;
            } else {
                line.error = 2;
            }
        }
    }
}

function filterLines(lines: CalcLine[], arg: number, result: CalcSegment) {
    for (let i = 0; i < 6; i++) {
        const {A, B, C, D, error} = lines[i];
        if (error === 2) {
            let z = (-lines[i].D - C * arg) / B;
            if (B > 0) {
                result.left = Math.max(result.left, z);
            } else {
                result.right = Math.min(result.right, z);
            }
        } else if (error === 0) {
            lines[i].F = -B / A;
            lines[i].G = (-D - C * arg) / A;
            lines[i].sign = Math.sign(A);
        }
    }
}

function intersectLines(lines: CalcLine[], result: number[], clamp: CalcSegment, padding: number) {
    for (let i = 0; i < 6; i++) {
        if (lines[i].error > 0) {
            continue;
        }
        for (let j = i + 1; j < 6; j++) {
            if (lines[j].error > 0) {
                continue;
            }
            if (Math.abs(lines[i].F - lines[j].F) > EPS) {
                const val = -(lines[i].G - lines[j].G) / (lines[i].F - lines[j].F);
                if (val >= clamp.left - padding && val <= clamp.right + padding) {
                    result.push(val);
                }
            }
        }
    }
}

const tempSeg = new CalcSegment();

function lineSegment(addTo: CalcSegment, lines: CalcLine[], arg: number) {
    tempSeg.right = -Infinity;
    tempSeg.left = Infinity;
    for (let i = 0; i < 6; i++) {
        let val = lines[i].F * arg + lines[i].G;
        if (lines[i].sign > 0) {
            tempSeg.left = Math.max(tempSeg.left, val);
        } else {
            tempSeg.right = Math.min(tempSeg.right, val);
        }
    }
    if (tempSeg.left - EPS <= tempSeg.right) {
        addTo.left = Math.min(addTo.left, tempSeg.left);
        addTo.right = Math.min(addTo.right, tempSeg.right);
    }
}

function scanLine(result: CalcSegment, lines: CalcLine[], inter: number[], lf: number, rt: number, i_start: number) {
    lineSegment(result, lines, lf);
    lineSegment(result, lines, rt);
    while (i_start > 0 && inter[i_start - 1] > lf) {
        i_start--;
    }
    while (inter[i_start] <= lf) {
        i_start++;
    }
    while (inter[i_start] < rt) {
        lineSegment(result, lines, inter_Z_top[i_start]);
        i_start++;
    }
    if (i_start > 0) {
        // just in case...
        i_start--;
    }
    return i_start;
}

let linesTop = [];
for (let i = 0; i < 6; i++) {
    linesTop[i] = new CalcLine();
}
let linesBottom = [];
for (let i = 0; i < 6; i++) {
    linesBottom[i] = new CalcLine();
}

let inter_Z_top = [];
let inter_Z_bottom = [];

let Y_segment = new CalcSegment();
let Z_top = new CalcSegment();
let Z_bottom = new CalcSegment();
let X_seg = new CalcSegment();

let tempVec = new Vector();

export class SpiralCulling {
    grid: SpiralGrid;
    updateID = 0;
    paddingBlocks = 1;

    constructor(grid: SpiralGrid) {
        this.grid = grid;
    }

    update(frustum: FrustumProxy, chunkSize: Vector) {
        this.updateID++;
        const {grid, paddingBlocks} = this;
        const {marginVec} = grid.size;

        const {planes, camPos} = frustum;

        tempVec.copyFrom(grid.center).multiplyVecSelf(chunkSize).subSelf(camPos);

        let Y_min = -Infinity, Y_max = Infinity;

        initLines(linesTop, planes, tempVec, Y_segment);
        for (let i = 0; i < 6; i++) {
            linesBottom[i].copyFrom(linesTop[i]);
        }

        for (let Y0 = -marginVec.y; Y0 <= marginVec.y; Y0++) {
            let Y_bottom = Math.max(Y_min, Y0 * chunkSize.y - paddingBlocks);
            let Y_top = Math.min(Y_max, (Y0 + 1) * chunkSize.y + paddingBlocks);
            if (Y_bottom > Y_top) {
                continue;
            }
            Z_top.left = Z_bottom.left = -marginVec.z * chunkSize.z;
            Z_top.right = Z_bottom.right = (marginVec.z + 1) * chunkSize.z;
            filterLines(linesTop, Y_top, Z_top);
            filterLines(linesBottom, Y_bottom, Z_bottom);

            const left = Math.min(Z_bottom.left, Z_top.left);
            const right = Math.min(Z_bottom.right, Z_top.right);
            if (left > right) {
                // no intersection at all
                continue;
            }

            intersectLines(linesTop, inter_Z_top, Z_top, paddingBlocks);
            intersectLines(linesBottom, inter_Z_bottom, Z_bottom, paddingBlocks);


            inter_Z_top.sort(numberSort);
            inter_Z_bottom.sort(numberSort);
            inter_Z_top.push(Infinity);
            inter_Z_bottom.push(Infinity);

            const leftChunkZ = Math.floor(left / marginVec.z);
            const rightChunkZ = Math.ceil(right / marginVec.z);

            let i_top = 0, i_bottom = 0;
            for (let z = leftChunkZ; z < rightChunkZ; z++) {
                X_seg.left = Infinity;
                X_seg.right = -Infinity;
                const lf = z * chunkSize.z - paddingBlocks;
                const rt = z * chunkSize.z + paddingBlocks;
                i_top = scanLine(X_seg, linesTop, inter_Z_top, lf, rt, i_top);
                i_bottom = scanLine(X_seg, linesBottom, inter_Z_bottom, lf, rt, i_bottom);

                //TODO: finally, add the chunks!
            }
        }
    }
}
