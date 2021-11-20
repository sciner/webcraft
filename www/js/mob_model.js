import { NORMALS, Helpers } from './helpers.js';
import { Resources } from "./resources.js";
import { SceneNode } from "./SceneNode.js";
import * as ModelBuilder from "./modelBuilder.js";

const {mat4, vec3, quat} = glMatrix;

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
                            this.matPlayer = render.defaultShader.materials.regular.getSubMat(texture1);
                            this.matPlayer2 = render.defaultShader.materials.transparent.getSubMat(texture2);
                        })
                });
            });

    }

    // Loads the player head model into a vertex buffer for rendering.
    loadPlayerHeadModel() {
        const node = Resources.models['json'];// Resources.models[this.type.replace('mob_','')] || Resources.models['70'];

        this.gltfAsset = ModelBuilder.fromJson(node);

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