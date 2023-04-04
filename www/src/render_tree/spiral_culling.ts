import type {Plane, FrustumProxy} from "../frustum.js";
import type {SpiralGrid} from "../helpers/spiral_generator.js";
import {Vector} from "../helpers/vector.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
const {mat3, vec3} = glMatrix;

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
        line.A = plane.normal.x;
        // YZ are swapped in planes render data
        line.B = plane.normal.y;
        line.C = plane.normal.z;
        //
        line.D = plane.constant + line.A * tempVec.x
            + line.B * tempVec.z + line.C * tempVec.y;
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
    tempSeg.right = Infinity;
    tempSeg.left = -Infinity;
    for (let i = 0; i < 6; i++) {
        if (lines[i].error > 0) {
            continue;
        }
        let val = lines[i].F * arg + lines[i].G;
        if (lines[i].sign > 0) {
            tempSeg.left = Math.max(tempSeg.left, val);
        } else {
            tempSeg.right = Math.min(tempSeg.right, val);
        }
    }
    if (tempSeg.left - EPS <= tempSeg.right) {
        addTo.left = Math.min(addTo.left, tempSeg.left);
        addTo.right = Math.max(addTo.right, tempSeg.right);
    }
}

function scanLine(result: CalcSegment, lines: CalcLine[], inter: number[], seg: CalcSegment, i_start: number) {
    lineSegment(result, lines, seg.left);
    lineSegment(result, lines, seg.right);
    while (i_start > 0 && inter[i_start - 1] > seg.left) {
        i_start--;
    }
    while (inter[i_start] <= seg.left) {
        i_start++;
    }
    while (inter[i_start] < seg.right) {
        lineSegment(result, lines, inter_Z_top[i_start]);
        i_start++;
    }
    if (i_start > 0) {
        // just in case...
        i_start--;
    }
    return i_start;
}

let tempMat3 = mat3.create();
let tempVec3 = vec3.create();

function frustumCorners(result: Vector[], lines: CalcLine[]) {
    const mat = tempMat3;
    const vec = tempVec3;
    let cnt = 0;
    for (let i = 0; i < 2; i++) {
        for (let j = 2; j < 4; j++) {
            for (let k = 4; k < 6; k++) {
                mat[0] = lines[i].A;
                mat[1] = lines[j].A;
                mat[2] = lines[k].A;
                mat[3] = lines[i].B;
                mat[4] = lines[j].B;
                mat[5] = lines[k].B;
                mat[6] = lines[i].C;
                mat[7] = lines[j].C;
                mat[8] = lines[k].C;
                mat3.invert(mat, mat);
                vec[0] = -lines[i].D;
                vec[1] = -lines[j].D;
                vec[2] = -lines[k].D;
                vec3.transformMat3(vec, vec, mat);
                result[cnt++].set(vec[0], vec[1], vec[2]);
            }
        }
    }
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
let Z_seg = new CalcSegment();

let tempVec = new Vector();
let frustPoints = [];
let frustSegPoints = [];
for (let i = 0; i < 8; i++) {
    frustPoints.push(new Vector());
}

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
        const {cullIDs} = grid;
        const {marginVec, depth, dw, startByYZ, radByYZ, indexByYZ} = grid.size;

        const {planes, camPos} = frustum;

        tempVec.copyFrom(grid.center).multiplyVecSelf(chunkSize).subSelf(camPos);

        let Y_min = -Infinity, Y_max = Infinity;

        initLines(linesTop, planes, tempVec, Y_segment);
        for (let i = 0; i < 6; i++) {
            linesBottom[i].copyFrom(linesTop[i]);
        }

        frustumCorners(frustPoints, linesTop);

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

            frustSegPoints.length = 0;
            for (let i = 0; i < 8; i++) {
                if (frustPoints[i].y > Y_bottom - EPS && frustPoints[i].y < Y_top + EPS) {
                    frustSegPoints.push(frustPoints[i]);
                }
            }
            let cornerCnt = frustSegPoints.length;

            inter_Z_top.length = inter_Z_bottom.length = 0;
            intersectLines(linesTop, inter_Z_top, Z_top, paddingBlocks);
            intersectLines(linesBottom, inter_Z_bottom, Z_bottom, paddingBlocks);


            inter_Z_top.sort(numberSort);
            inter_Z_bottom.sort(numberSort);
            inter_Z_top.push(Infinity);
            inter_Z_bottom.push(Infinity);

            const leftChunkZ = Math.floor(left / marginVec.z);
            const rightChunkZ = Math.ceil(right / marginVec.z);

            let i_top = 0, i_bottom = 0;
            for (let Z0 = leftChunkZ; Z0 < rightChunkZ; Z0++) {
                let rad = radByYZ[Y0 * depth + Z0 + dw];
                if (rad < 0) {
                    continue;
                }
                X_seg.left = Infinity;
                X_seg.right = -Infinity;
                const lf = Z0 * chunkSize.z - paddingBlocks;
                const rt = (Z0 + 1) * chunkSize.z + paddingBlocks;
                Z_seg.left = Math.max(Z_top.left, lf);
                Z_seg.right = Math.min(Z_top.right, rt);
                if (Z_seg.left <= Z_seg.right) {
                    i_top = scanLine(X_seg, linesTop, inter_Z_top, Z_seg, i_top);
                }
                Z_seg.left = Math.max(Z_bottom.left, lf);
                Z_seg.right = Math.min(Z_bottom.right, rt);
                if (Z_seg.left <= Z_seg.right) {
                    i_bottom = scanLine(X_seg, linesBottom, inter_Z_bottom, Z_seg, i_bottom);
                }
                if (cornerCnt > 0) {
                    for (let i = 0; i < cornerCnt; i++) {
                        if (frustSegPoints[i].z > lf - EPS && frustSegPoints[i].z < rt + EPS) {
                            X_seg.left = Math.min(X_seg.left, frustSegPoints[i].x);
                            X_seg.right = Math.max(X_seg.right, frustSegPoints[i].x);
                        }
                    }
                }
                if (X_seg.left > X_seg.right) {
                    continue;
                }
                let leftChunkX = Math.max(-rad, Math.floor(X_seg.left / chunkSize.x));
                let rightChunkX = Math.min(rad + 1, Math.ceil(X_seg.right / chunkSize.x));

                const yz = startByYZ[Y0 * depth + Z0 + dw];
                for (let X0 = leftChunkX; X0 < rightChunkX; X0++) {
                    cullIDs[indexByYZ[yz + X0 + rad]] = this.updateID;
                    //TODO: maybe process the chunk meshes inside
                }
            }
        }
    }
}
