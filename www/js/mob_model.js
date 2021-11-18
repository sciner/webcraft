import GeometryTerrain from "./geometry_terrain.js";
import {NORMALS, Helpers} from './helpers.js';
import {Resources} from "./resources.js";

const {mat4, vec3, quat} = glMatrix;

class SceneNode {
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


        this.position = vec3.create(0,0,0,0);

        this.scale = vec3.create(1, 1, 1);

        this.quat = quat.create(0,0,0,1);

        this._parentMatrixId = -1;
        this._oldMatrixId = 0;
        this._oldMatrixWorldId = 0;

        this.matrixId = -1;
        this.matrixWorldId = -1;
    }

    findNode(name) {
        if (!name) {
            return null;
        }

        if (this.children.length === 0) {
            return null;
        }

        for(let child of this.children) {
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
        this.matrixId ++;
        this.matrixWorldId ++;
    }

    get matrix() {
        if (this._oldMatrixId !== this.matrixId) {
            mat4.fromRotationTranslationScale(this._matrix, this.quat, this.position, this.scale);
        }

        this._oldMatrixId = this.matrixId;

        return this._matrix;
    }

    set matrix(matrix) {
        mat4.copy(this._matrix, matrix);
        mat4.getTranslation(this.position, matrix);
        mat4.getScaling(this.scale, matrix);
        mat4.getRotation(this.quat, matrix);

        this.matrixWorldId ++;
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

    static fromGltfNode(gltf) {
        const node = new SceneNode();

        node.source = gltf;
        node.matrix = gltf.matrix;
        node.name = gltf.name;

        if (node.name.indexOf('.') > -1) {
            node.name = node.name.split('.')[0];
        }

        for(const child of gltf.children) {
            const childNode = SceneNode.fromGltfNode(child);
            childNode.parent = node;

            node.children.push(childNode);
        }

        let geom = gltf.terrainGeometry;
        if (gltf.mesh && gltf.mesh.interlivedData && !geom) {
            geom = gltf.terrainGeometry =  new GeometryTerrain(GeometryTerrain.convertFrom12(gltf.mesh.interlivedData))
        }

        node.terrainGeometry = geom;

        return node;
    }
}
export class MobModel {

    constructor(props) {

        this.type = props.type;
        this.gltfAsset                  = null;
        this.texPlayer                  = null;
        this.texPlayer2                 = null;

        this.matPlayer = null;
        this.matPlayer2 = null;

        this.moving_timeout             = null;
        this.texture                    = null;
        this.nametag                    = null;
        this.moving                     = true;
        this.aniframe                   = 0;
        this.height                     = 0;

        this.modelMatrix                = mat4.create();

        this.skin = {
            file: '/media/skins/16.png'
        };

        Object.assign(this, props);

        /**
         * @type {SceneNode[]}
         */
        this.rightLegs = [];
        /**
         * @type {SceneNode[]}
         */
        this.leftLegs = [];
        /**
         * @type {SceneNode}
         */
        this.head = null;
    }

    traverse(node, cb, parent = null, args = {}) {
        if(!cb.call(this, node, parent, args)) {
            return false;
        }

        for(let next of node.children) {
            if (!this.traverse(next, cb, node, args)) return false;
        }

        return true;
    }

    update(camPos, delta) {

        if (delta > 1000) {
            delta = 1000
        }

        const scale = 0.25;
        const modelMatrix = this.gltfAsset.matrix;
        const z_minus   = (this.height * scale - this.height);

        let aniangle = 0;
        if(this.moving || Math.abs(this.aniframe) > 0.1) {
            this.aniframe += (0.1 / 1000 * delta);
            if(this.aniframe > Math.PI) {
                this.aniframe  = -Math.PI;
            }
            aniangle = Math.PI / 4 * Math.sin(this.aniframe);
            if(!this.moving && Math.abs(aniangle) < 0.1) {
                this.aniframe = 0;
            }
        }

        // Draw head
        let pitch = this.pitch;

        if(pitch < -0.5) {
            pitch = -0.5;
        }

        if(pitch > 0.5) {
            pitch = 0.5;
        }
 
        // Draw head
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, [0, 0, this.height * scale - z_minus]);
        mat4.scale(modelMatrix, modelMatrix, [scale, scale, scale]);
        mat4.rotateZ(modelMatrix, modelMatrix, Math.PI - this.yaw);
        mat4.rotateX(modelMatrix, modelMatrix, -pitch);

        this.gltfAsset.matrix = modelMatrix;

        for(let i = 0; i < this.leftLegs.length; i ++) {
            const rl = this.rightLegs[i];
            const ll = this.leftLegs[i];
            const sign = i % 2 ? 1 : -1;

            quat.identity(rl.quat);
            quat.rotateX(rl.quat, rl.quat, aniangle * sign);
         
            quat.identity(ll.quat);
            quat.rotateX(ll.quat, ll.quat, -aniangle * sign);

            rl.updateMatrix();
            ll.updateMatrix();
        }
    }

    // draw
    draw(render, camPos, delta) {
        if (!this.gltfAsset) {
            this.loadMesh(render);
        }

        this.update(camPos, delta);
        this.drawLayer(render, camPos, delta, {
            scale:          .25,
            material:       this.matPlayer,
            draw_nametag:   false
        });
        /*
        this.drawLayer(render, camPos, delta, {
            scale:          1.05,
            material:       this.matPlayer2,
            draw_nametag:   true
        });
        */
    }

    // loadMesh...
    /**
     *
     * @param {Renderer} render
     */
    loadMesh(render) {
        this.loadPlayerHeadModel(render);
        this.loadTextures(render);
    }

    /**
     *
     * @param {Renderer} render
     */
    loadTextures(render) {
        if (this.texPlayer && this.texPlayer2) {
            return;
        }

        Resources
            .loadImage(this.skin.file, false)
            .then(image1 => {
                Helpers.createSkinLayer2(null, image1, (file) => {
                    Resources
                        .loadImage(URL.createObjectURL(file), false)
                        .then(image2 => {
                            const texture1 = render.renderBackend.createTexture({
                                source: image1,
                                minFilter: 'nearest',
                                magFilter: 'nearest'
                            });
                            const texture2 = render.renderBackend.createTexture({
                                source: image2,
                                minFilter: 'nearest',
                                magFilter: 'nearest'
                            });
                            this.texPlayer =  texture1;
                            this.texPlayer2 = texture2;
                            this.matPlayer = render.defaultShader.materials.doubleface.getSubMat(texture1);
                            this.matPlayer2 = render.defaultShader.materials.doubleface_transparent.getSubMat(texture2);
                        })
                });
            });

    }

    // Loads the player head model into a vertex buffer for rendering.
    loadPlayerHeadModel() {
        const node = Resources.models[this.type.replace('mob_','')] || Resources.models['70'];

        this.gltfAsset = SceneNode.fromGltfNode(node);

        for(let i = 0; i < 8; i ++) {
            const rl = this.gltfAsset.findNode('leg_r' + i);
            if (rl) this.rightLegs.push(rl);

            const ll = this.gltfAsset.findNode('leg_l' + i);
            if (ll) this.leftLegs.push(ll);
        }

        this.head = this.gltfAsset.findNode('head');

        return this.gltfAsset;
    }

    drawTraversed(node, parent, {render, material}) {

        if (!node.terrainGeometry) {
            return true;
        }


        if (node.name !== 'body') {
            //return true;
        }

        render.renderBackend.drawMesh(node.terrainGeometry, material, this.pos, node.matrixWorld);

        return true;
    }

    // drawLayer
    drawLayer(render, camPos, delta, options) {
        const {material, scale} = options;

        // Load mesh
        if(!this.gltfAsset) {
            this.loadMesh(render);
        }

        // Wait loading texture
        if(!options.material) {
            return;
        }

        this.traverse(this.gltfAsset, this.drawTraversed, null, {render, material});
    }

}