import glMatrix from "./../vendors/gl-matrix-3.3.min.js"

const {mat3} = glMatrix;

export const CubeSym = {
    ID: 0,
    ROT_Y: 1,
    ROT_Y2: 2,
    ROT_Y3: 3,
    ROT_Z: 4,
    ROT_Z2: 5,
    ROT_Z3: 6,
    ROT_X: 7,
    ROT_X2: 8,
    ROT_X3: 9,
    NEG_Y: 24,
    /**
     * generated
     */
    NEG_Z: 29,
    /**
     * generated
     */
    NEG_X: 32,
    matrices: [],
    _byScale: [0,0,0,0,0,0,0,0],
    _symCayley: [],
    _inv: [],

    fromScale(sx, sy, sz) {
        return CubeSym._byScale[((sx < 0) ? 1 : 0)
            + ((sy < 0) ? 2 : 0)
            + ((sz < 0) ? 4 : 0)];
    },
    add(symSecond, symFirst) {
        return CubeSym._symCayley[symSecond][symFirst];
    },
    sub(symSecond, symFirst) {
        return CubeSym._symCayley[symSecond][CubeSym._inv[symFirst]];
    },
    inv(sym) {
        return CubeSym._inv[sym];
    }
}

const tmp = new Float32Array(9);

function fill(startIndex, finishIndex, current) {
    const {matrices, _symCayley} = CubeSym;
    for (let i = startIndex; i < finishIndex; i++) {
        for (let j = 0; j < current; j++) {
            mat3.multiply(tmp, matrices[j], matrices[i]);
            let flag = false;
            for (let k=0;k<current; k++) {
                flag = true;
                for (let s=0;s<9;s++) {
                    if (matrices[k][s] !== tmp[s]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    _symCayley[j][i] = k;
                    break;
                }
            }
            if (!flag) {
                matrices[current].set(tmp, 0);
                _symCayley[j][i] = current++;
            }
        }
    }
    return current;
}

function fillRest() {
    const {matrices, _symCayley, _inv, _byScale} = CubeSym;
    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) {
            if (_symCayley[j][i] >=0) {
                continue;
            }
            mat3.multiply(tmp, matrices[j], matrices[i]);
            for (let k = 0; k < 48; k++) {
                let flag = true;
                for (let s = 0; s < 9; s++) {
                    if (matrices[k][s] !== tmp[s]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    _symCayley[j][i] = k;
                    break;
                }
            }
        }
    }

    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) {
            if (_symCayley[j][i] === 0) {
                _inv[i] = j;
                break;
            }
        }
    }

    for (let i = 0; i < 48; i++) {
        const mat = matrices[i];
        if (mat[0] !== 0 && mat[4] !== 0 && mat[8] !== 0) {
            const ind = (mat[0]<0?1:0) + (mat[4]<0?2:0) + (mat[8]<0?4:0);
            _byScale[ind] = i;
        }
    }
}

function init() {
    const {matrices, _symCayley, ROT_Y, ROT_Z, ROT_X, NEG_Y, NEG_Z, NEG_X} = CubeSym;
    for (let i = 0; i < 48; i++) {
        matrices[i] = new Float32Array(9);
        _symCayley[i] = [];
        for (let j=0;j<48;j++) {
            _symCayley[i].push(-1);
        }
    }
    let current = 0;
    // ID
    matrices[0][0] = 1;
    matrices[0][4] = 1;
    matrices[0][8] = 1;
    current++;
    matrices[ROT_Y][2] = -1;
    matrices[ROT_Y][4] = 1;
    matrices[ROT_Y][6] = 1;
    current++;
    mat3.multiply(matrices[current++], matrices[ROT_Y], matrices[ROT_Y]);
    mat3.multiply(matrices[current++], matrices[ROT_Y], matrices[ROT_Y+1]);
    matrices[ROT_Z][1] = -1;
    matrices[ROT_Z][3] = 1;
    matrices[ROT_Z][8] = 1;
    current++;
    mat3.multiply(matrices[current++], matrices[ROT_Z], matrices[ROT_Z]);
    mat3.multiply(matrices[current++], matrices[ROT_Z], matrices[ROT_Z+1]);
    matrices[ROT_X][0] = 1;
    matrices[ROT_X][5] = 1;
    matrices[ROT_X][7] = -1;
    current++;
    mat3.multiply(matrices[current++], matrices[ROT_X], matrices[ROT_X]);
    mat3.multiply(matrices[current++], matrices[ROT_X], matrices[ROT_X+1]);
    current = fill(0, 24, current);
    matrices[NEG_Y][0] = 1;
    matrices[NEG_Y][4] = -1;
    matrices[NEG_Y][8] = 1;
    current++;
    current = fill(24, 48, current);
    fillRest();
}

// let perf = Date.now();
init();
// perf = Date.now()-perf;
// console.log(`matrices generated for ${perf} ms`);
