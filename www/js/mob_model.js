import { Resources } from "./resources.js";
import { SceneNode } from "./SceneNode.js";
import * as ModelBuilder from "./modelBuilder.js";

const {mat4, vec3, quat} = glMatrix;

export class MobModel {

    constructor(props) {
        this.sceneTree                  = null;
        this.texture                    = null;
        this.material = null;

        this.moving_timeout             = null;
        this.texture                    = null;
        this.nametag                    = null;
        this.moving                     = false;
        this.aniframe                   = 0;
        this.height                     = 0;

        this.modelMatrix                = mat4.create();

        Object.assign(this, props);

        this.type = props.type;
        this.skin = props.skin;

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

        this.initialised = false;
    }

    lazyInit(render) {
        if (this.initialised) {
            return;
        }

        this.loadModel(render);
        this.initialised = true;
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

        const scale = 1;
        const modelMatrix = this.sceneTree.matrix;
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

        this.sceneTree.matrix = modelMatrix;

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
        this.lazyInit(render);
        this.update(camPos, delta);
        this.drawLayer(render, camPos, delta, {
            scale:          .25,
            material:       this.material,
            draw_nametag:   false
        });
    }

    /**
     *
     * @param {Renderer} render
     * @param {ImageBitmap | Image} image
     */
    loadTextures(render, image) {
        if (this.texture) {
            return;
        }

        this.texture = render.renderBackend.createTexture({
            source: image,
            minFilter: 'nearest',
            magFilter: 'nearest'
        });

        this.material =  render.defaultShader.materials.doubleface_transparent.getSubMat(this.texture)
    }

    // Loads the player head model into a vertex buffer for rendering.
    /**
     * 
     * @param {Renderer} render
     */
    loadModel(render) {
        if (this.sceneTree) {
            return;
        }

        if(this.type === 'player') {
            if (this.skin === 'base') {
                this.skin = '1';
                this.type = 'player:steve';
            } else {
                this.type = 'player:steve';

                if (!(this.skin in Resources.models[this.type].skins)) {
                    this.type = 'player:alex';
                }

                if (!(this.skin in Resources.models[this.type].skins)) {
                    this.type = 'player:steve';
                    this.skin = '1';
                }
            }
        }

        const asset = Resources.models[this.type.replace('mob_','')] || Resources.models['bee'];

        if (!asset) {
            console.log("Can't lokate model for:", this.type);
            return null;
        }

        if(asset.type === 'json') {
            this.sceneTree = ModelBuilder.fromJson(asset);
            this.skin = this.skin || asset.baseSkin;

            if(!(this.skin in asset.skins)) {
                console.warn("Can't locate skin: ", this.skin)
                this.skin = asset.baseSkin;
            }

            this.loadTextures(render, asset.skins[this.skin]);

            this.rightLegs.push(this.sceneTree.findNode('RightLeg'));

            this.leftLegs.push(this.sceneTree.findNode('LeftLeg'));

            this.rightLegs = this.rightLegs.filter(Boolean);
            this.leftLegs = this.leftLegs.filter(Boolean);
            
        
            this.head = this.sceneTree.findNode('Head');
        }

        return this.sceneTree;
    
    }

    drawTraversed(node, parent, {render, material}) {

        if (!node.terrainGeometry) {
            return true;
        }


        if (node.name !== 'body') {
            //return true;
        }

        render.renderBackend.drawMesh(node.terrainGeometry, node.material || material, this.pos, node.matrixWorld);

        return true;
    }

    // drawLayer
    drawLayer(render, camPos, delta, options) {
        const { material, scale } = options;

        // Wait loading texture
        if(!options.material) {
            return;
        }

        this.traverse(this.sceneTree, this.drawTraversed, null, {render, material});
    }

}