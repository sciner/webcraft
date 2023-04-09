import glMatrix from "../vendors/gl-matrix-3.3.min.js"

const {mat4, vec3, quat} = glMatrix;

export class SceneNode {
    [key: string]: any;
    constructor(parent = null) {
        /**
         * @type {SceneNode[]}
         */
        this.children = [];

        /**
         * @type {Float32Array}
         */
        this._matrix = mat4.create();

        /**
         * @type {Float32Array}
         */
        this._matrixWorld = mat4.create();

        this.name = '';

        this.source = null;
        this.terrainGeometry = null;
        this.material = null;

        this.pivot = vec3.create();

        this.position = vec3.create();

        this.scale = vec3.set(vec3.create(), 1, 1, 1);

        this.quat = quat.create();

        this._parentMatrixId = -1;
        this._oldMatrixId = -1;
        this._oldMatrixWorldId = -1;

        this.matrixId = 0;
        this.matrixWorldId = 0;

        if (parent) {
            parent.addChild(this);
        }
    }

    get buffer() {
        return this.terrainGeometry;
    }

    addChild(child) {
        if (child.parent === this) {
            return;
        }

        if (child.parent) {
            child.parent.removeChild(child);
        }

        child.updateMatrix();

        this.children.push(child);

        child.parent = this;
    }

    setVisible(val) {
        const setVisable = (children) => {
            for (const child of children) {
                child.visible = val
                child.updateMatrix()
                if (child.children) {
                    setVisable(child.children)
                }
            }
        }
        this.visible = val
        setVisable(this.children)
    }

    replaceChild(name, child) {
        const node = this.findNode(name)
        if (!node) {
            if (child) {
                child.parent = this
                this.children.push(child)
                return true
            }
            return false
        }
        const index = this.children.indexOf(node)
        if (index === -1) {
            return false
        }
        this.children.splice(index, 1)
        if (child) {
            child.parent = this
            this.children.push(child)
        }
        return true
    }

    removeChild(child) {
        const index = this.children.indexOf(child);

        if (index === -1) {
            return;
        }

        child.parent = null;
        child.updateMatrix();
        this.children.splice(index, 1);
    }

    findNode(name) {
        if (!name) {
            return null;
        }

        if (this.children.length === 0) {
            return null;
        }

        for (const child of this.children) {
            if (child.name.toLowerCase() === name.toLowerCase()) {
                return child;
            }

            const subNode = child.findNode(name);

            if (subNode) {
                return subNode;
            }
        }

        return null;
    }

    updateMatrix() {
        this.matrixId++;
        this.matrixWorldId++;
    }

    get matrix() {
        if (this._oldMatrixId !== this.matrixId) {
            mat4.fromRotationTranslationScaleOrigin(this._matrix, this.quat, this.position, this.scale, this.pivot);
        }

        this._oldMatrixId = this.matrixId;

        return this._matrix;
    }

    set matrix(matrix) {
        mat4.copy(this._matrix, matrix);
        mat4.getTranslation(this.position, matrix);
        mat4.getScaling(this.scale, matrix);
        mat4.getRotation(this.quat, matrix);

        this.matrixWorldId++;
    }

    get matrixWorld() {
        if (!this.parent) {
            return this.matrix;
        }

        const parentMatrix = this.parent.matrixWorld;

        if (this._oldMatrixId !== this.matrixWorldId || this._parentMatrixId !== this.parent.matrixWorldId) {
            mat4.multiply(this._matrixWorld, parentMatrix, this.matrix);

            // because we update matrix, change their ID to track in next child
            this.matrixWorldId ++;
        }

        this._oldMatrixWorldId = this.matrixWorldId;
        this._parentMatrixId = this.parent.matrixWorldId;

        return this._matrixWorld;
    }
}
