import GeometryTerrain from "./geometry_terrain.js";

const {mat4, vec3, quat} = glMatrix;

export class SceneNode {
    constructor(parent = null) {
        /**
         * @type {SceneNode[]}
         */
        this.children = [];
        this.parent = parent;

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

        this.pivot = vec3.create();

        this.position = vec3.create();

        this.scale = vec3.set(vec3.create(), 1, 1, 1);

        this.quat = quat.create();

        this._parentMatrixId = -1;
        this._oldMatrixId = 0;
        this._oldMatrixWorldId = 0;

        this.matrixId = -1;
        this.matrixWorldId = -1;
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

        for (let child of this.children) {
            if (child.name === name) {
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

        if (this._oldMatrixId !== this.matrixWorldId || this._parentMatrixId !== this.parent.matrixWorldId) {
            mat4.multiply(this._matrixWorld, this.parent.matrixWorld, this.matrix);
        }

        this._oldMatrixWorldId = this.matrixWorldId;
        this._parentMatrixId = this.parent.matrixWorldId;

        return this._matrixWorld;
    }
}
