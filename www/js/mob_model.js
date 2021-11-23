import { Resources } from "./resources.js";
import { SceneNode } from "./SceneNode.js";
import * as ModelBuilder from "./modelBuilder.js";
import { Helpers } from "./helpers.js";
import { getChunkAddr, getChunkWordCoord, getLocalChunkCoord } from "./chunk.js";
import { ChunkManager } from "./chunk_manager.js";

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

        Object.assign(this, props);

        this.type = props.type;
        this.skin = props.skin;

        /**
         * @type {SceneNode[]}
         */
        this.legs = [];

        /**
         * @type {SceneNode}
         */
        this.head = null;

        this.initialised = false;

        this.targetLook = 0;

        this.drawPos = {x: 0, y: 0, y: 0};

        this.lightTex = null;
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
    
    computeLocalPosAndLight(render) {                
        this.drawPos = getChunkWordCoord(this.pos.x, this.pos.y, this.pos.z, this.drawPos);

        const local = getLocalChunkCoord(this.pos.x, this.pos.y, this.pos.z);
        const addr = getChunkAddr(this.pos.x, this.pos.y, this.pos.z);

        const chunk = ChunkManager.instance.getChunk(addr);

        this.lightTex = chunk && chunk.getLightTexture(render.renderBackend);

        // блять, оси повернуты
        this.sceneTree.position.set([local.x, local.z, local.y]);

        // root
        quat.fromEuler(this.sceneTree.quat, 0, 0, 180 * (Math.PI - this.yaw) / Math.PI);
        this.sceneTree.updateMatrix();
    }

    update(render, camPos, delta) {

        if (delta > 1000) {
            delta = 1000
        }

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

        this.computeLocalPosAndLight(render);

        // legs
        for(let i = 0; i < this.legs.length; i ++) {
            const leg = this.legs[i];
            const x = i % 2;
            const y = i / 2 | 0;
            const sign = x ^ y ? 1 : -1;

            quat.identity(leg.quat);
            quat.rotateX(leg.quat, leg.quat, aniangle * sign);

            leg.updateMatrix();
        }

        if (this.head) {
            // head
            let angToCam = 0;
            
            if ( Helpers.distance(this.pos, camPos) < 5) {
                angToCam = this.yaw  -Math.PI/2  + Math.atan2(camPos.z - this.pos.z, camPos.x - this.pos.x);

                while(angToCam > Math.PI) angToCam -= Math.PI * 2;
                while(angToCam < -Math.PI) angToCam += Math.PI * 2;

                if (Math.abs(angToCam) >= Math.PI / 4) {
                    angToCam = 0;
                } 
            }

            if (Math.abs(angToCam - this.targetLook) > 0.05) {
                this.targetLook += Math.sign(angToCam - this.targetLook) * 0.05;
            }

            const angZ = 180 * this.targetLook / Math.PI;

            quat.fromEuler(this.head.quat, 0, 0, angZ);
            this.head.updateMatrix();
        }
    }

    // draw
    draw(render, camPos, delta) {
        this.lazyInit(render);
        this.update(render, camPos, delta);
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
            magFilter: 'nearest',
            shared: true
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

        const asset = Resources.models[this.type];

        if (!asset) {
            console.log("Can't lokate model for:", this.type);
            return null;
        }

        this.sceneTree = ModelBuilder.loadModel(asset);

        if (!this.sceneTree) {
            return null;
        }

        this.skin = this.skin || asset.baseSkin;

        if(!(this.skin in asset.skins)) {
            console.warn("Can't locate skin: ", this.skin)
            this.skin = asset.baseSkin;
        }

        this.loadTextures(render, asset.skins[this.skin]);
    

        return this.postLoad(this.sceneTree);    
    }

    /**
     * 
     * @param {SceneNode} tree 
     */
    postLoad(tree) {
        let leg;
        for(let i = 0; i < 8; i ++) {
            leg = tree.findNode('leg' + i);
            leg && this.legs.push(leg);
        }

        // humanoid case
        leg = tree.findNode('LeftLeg');
        leg && this.legs.push(leg);

        // humanoid case
        leg = tree.findNode('RightLeg');
        leg && this.legs.push(leg);
    
        this.head = tree.findNode('head') || tree.findNode('Head');
    }

    drawTraversed(node, parent, {render, material}) {

        if (!node.terrainGeometry) {
            return true;
        }

        material.lightTex = this.lightTex;
        render.renderBackend.drawMesh(
            node.terrainGeometry,
            node.material || material,
            this.drawPos,
            node.matrixWorld
        );

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