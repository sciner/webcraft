import type {FrustumProxy} from "../frustum.js";
import type {SpiralGrid} from "../helpers/spiral_generator.js";
import {Vector} from "../helpers/vector.js";

let lines = [];
for (let i = 0; i < 12; i++) {
    lines.push(0);
}

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
        tempVec;

        let Z_left = -marginVec.z;
        for (let Y0 = -marginVec.y; Y0 <= marginVec.y; Y0++) {
            let Y_bottom = Y0 * chunkSize.y - paddingBlocks;
            let Y_top = (Y0 + 1) * chunkSize.y + paddingBlocks;

            for (let i = 0; i < 6; i++) {

            }
        }
    }
}
