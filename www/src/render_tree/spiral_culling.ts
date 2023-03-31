import {FrustumProxy, Sphere} from "../frustum.js";
import {Vector} from "../helpers/vector.js";
import {NEIB_DX, NEIB_DY, NEIB_DZ} from "../chunk_const.js";

let tempVec = new Vector();

export class SpiralCulling27 {
    cornerSpheres: Sphere[] = null;
    margin = new Vector();
    chunkSize = new Vector();
    chunkCenter = new Vector();

    constructor() {
    }

    setParams(margin: IVector, chunkSize: IVector = this.chunkSize) {
        if (this.margin.equal(margin) && this.chunkSize.equal(chunkSize)) {
            return;
        }
        this.margin.copyFrom(margin);
        this.chunkSize.copyFrom(chunkSize);
        this.chunkCenter.copyFrom(chunkSize).divScalarSelf(2);

        const rad = Math.max(margin.x * chunkSize.x, margin.y * chunkSize.y, margin.z * chunkSize.z);
        const rad2 = rad / 8;
        const vecRad = new Vector(rad, rad, rad);
        const vecRad2 = new Vector(rad2, rad2, rad2);

        // corners
        const cs = this.cornerSpheres = [];
        for (let dir = 0; dir < 27; dir++) {
            const s1 = new Sphere(this.chunkCenter
                    .add(vecRad)
                    .multiplyVecSelf(new Vector(NEIB_DX[dir], NEIB_DY[dir], NEIB_DZ[dir])),
                rad
            );
            const s2 = new Sphere(this.chunkCenter
                    .add(vecRad2)
                    .multiplyVecSelf(new Vector(NEIB_DX[dir], NEIB_DY[dir], NEIB_DZ[dir])),
                rad2
            );
            cs.push(s1, s2);
        }
    }

    getMask27(chunkAddr: Vector, frustum: FrustumProxy) {
        let mask = 1 << 0;
        tempVec.copyFrom(chunkAddr).multiplyVecSelf(this.chunkSize).addSelf(this.chunkCenter);
        for (let i = 1; i < 27; i++) {
            if (frustum.intersectsObjSphere(tempVec, this.cornerSpheres[i * 2])
                || frustum.intersectsObjSphere(tempVec, this.cornerSpheres[i * 2 + 1])) {
                mask |= (1 << i);
            }
        }
        return mask;
    }
}