import { pushSym } from "../core/CubeSym.js";

/**
 * 
 * @param {*} vertices 
 * @param {*} x Start position X
 * @param {*} y Start position Y
 * @param {*} z Start position Z
 * @param {*} c 
 * @param {*} lm 
 * @param {*} x_dir 
 * @param {*} rot 
 * @param {*} xp 
 * @param {*} yp 
 * @param {*} zp 
 * @param {*} flags 
 * @param {*} sym 
 * @param {*} dx
 * @param {*} dy
 * @param {*} dz
 */
 export function pushPlanedGeom (
    vertices,
    x, y, z, 
    c, 
    lm,
    x_dir, rot,
    xp, yp, zp,
    flags,
    sym = 0,
    dx = 0, dy = 0, dz = 0,
    ignore_back_side
) {
    [z, y]   = [y, z];
    [zp, yp] = [yp, zp];
    [dz, dy] = [dy, dz];
    
    xp          = xp ? xp : 1;
    yp          = yp ? yp : 1;
    zp          = zp ? zp : 1;
    flags       = flags || 0;

    x += 0.5 * xp;
    y += 0.5 * yp;
    z += 0.5 * zp;

    // because we have rotation, we should create xp and yp as diagonal
    if (rot) {
        xp /= 1.41;
        yp /= 1.41;
    }

    if (x_dir) {
        if(rot) {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    xp, yp, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    xp, 0, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    } else {
        if(rot) {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    -xp, -yp, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            if(!ignore_back_side) {
                pushSym(vertices, sym,
                    x, y, z,
                    dx, dy, dz,
                    0, yp, 0,
                    0, 0, -zp,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
            }
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                0, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    }

}

export function pushPlanedGeomCorrect (
    vertices,
    x, y, z, 
    c, 
    lm,
    x_dir, rot,
    xp, yp, zp,
    flags,
    sym = 0,
    dx = 0, dy = 0, dz = 0
) {
    [z, y]   = [y, z];
    [zp, yp] = [yp, zp];
    [dz, dy] = [dy, dz];
    
    xp          = xp ? xp : 1;
    yp          = yp ? yp : 1;
    zp          = zp ? zp : 1;
    flags       = flags || 0;

    x += 0.5;
    y += 0.5;
    z += 0.5;

    // because we have rotation, we should create xp and yp as diagonal
    if (rot) {
        xp /= 1.41;
        yp /= 1.41;
    }

    if (x_dir) {
        if(rot) {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    } else {
        if(rot) {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                -xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        } else {
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                0, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            pushSym(vertices, sym,
                x, y, z,
                dx, dy, dz,
                0, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags);
        }
    }

}

// push_plane
export default class style {

    static getRegInfo() {
        return {
            styles: ['plane'],
            func: this.func
        };
    }

    static func(vertices, x, y, z, c, lm, x_dir, rot, xp, yp, zp, flags, ignore_back_side) {
        return pushPlanedGeom(
            vertices,
            x, y, z,
            c, lm,
            x_dir, rot,
            xp, yp, zp,
            flags, 0, 0, 0, 0,
            ignore_back_side
        );
    }

}