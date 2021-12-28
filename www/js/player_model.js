import { BLOCK } from "./blocks.js";
import GeometryTerrain from "./geometry_terrain.js";
import { NORMALS, Helpers, Vector } from './helpers.js';
import { MobAnimation, MobModel } from "./mob_model.js";
import Particles_Block_Drop from "./particles/block_drop.js";
import { SceneNode } from "./SceneNode.js";

const {mat4, quat} = glMatrix;

export class PlayerAnimation extends MobAnimation {
    head({
        part, animable
    }) {
        let pitch = animable.pitch; 

        if(pitch < -0.5) { 
            pitch = -0.5; 
        } 

        if(pitch > 0.5) { 
            pitch = 0.5; 
        }

        quat.fromEuler(part.quat, -pitch * 90, 0, 0);

        part.updateMatrix();
    }
}
export class PlayerModel extends MobModel {

    constructor(props) {
        super({type: 'player', skin: '1', ...props});

        this.height = 1.7;

        /**
         * @type {HTMLCanvasElement}
         */
        this.textCanvas = null;
        this.textContext = null;

        this.username = props.username;

        this.head = null;

        this.animationScript = new PlayerAnimation();

        /**
         * @type {SceneNode}
         */
        this.handItem;

        this.handItemId = -1;
    }

    /**
     * Change item that placed in remove player arms (hands)
     * @param {number} id 
     * @param {boolean} left 
     * @returns 
     */
    changeHandItem (id = -1, left = true) {
        const armNode = this.sceneTree.findNode(left ? 'LeftArmItemPlace' : 'RightArmItemPlace');

        let scale = 0.3;

        if (!armNode) {
            return;
        }

        if (!this.handItem) {
            this.handItem = new SceneNode();
            this.handItem.position.set(armNode.pivot);

            this.handItem.updateMatrix();
        }

        if (id == this.handItemId && this.handItem.terrainGeometry) {
            return;
        }

        if (this.handItem.terrainGeometry) {
            this.handItem.terrainGeometry.destroy();
            this.handItem.terrainGeometry = null;
        }

        this.handItemId = id;

        if (id === -1) {
            return;
        }

        const block = BLOCK.BLOCK_BY_ID.get(id);

        if (!block.spawnable) {
            return;
        }

        let item;
        try {
            item = new Particles_Block_Drop(null, null, [block], Vector.ZERO);
        } catch(e) {
            console.log(e);
            //
        }

        if (item) {
            this.handItem.terrainGeometry = item.buffer;
            this.handItem.material = item.material;

            const orient = left ? -1 : 1;

            if (block.diagonal) {
                scale *= 1.2;

                quat.fromEuler(this.handItem.quat, -10 * orient, -30, -90 + 10 * orient);

            } else {
                quat.fromEuler(this.handItem.quat, -20 * orient, 0, -20);
            }

            this.handItem.scale.set([scale, scale, scale]);
            this.handItem.pivot.set([0, 0, scale / 2]);
            
            armNode.addChild(this.handItem);
        }
    }

    itsMe() {
        return this.username == Game.App.session.username;
    }

    lazyInit(render) {
        if (this.initialised) {
            return;
        }

        super.lazyInit(render);

        this.textCanvas                 = document.createElement('canvas');
        this.textCanvas.width           = 256;
        this.textCanvas.height          = 64;
        this.textCanvas.style.display   = 'none';
        // Create context used to draw name tags
        this.textContext                = this.textCanvas.getContext('2d');
        this.textContext.textAlign      = 'left';
        this.textContext.textBaseline   = 'top';
        this.textContext.font           = '24px Ubuntu';

        this.nametag = this.buildPlayerName(this.username, render);

        this.sceneTree.addChild(this.nametag);
        this.nametag.scale.set([0.005, 1, 0.005]);
        this.nametag.position[2] = 
            (this.sceneTree.findNode('Head') || this.sceneTree.findNode('head'))
            .pivot[2] + 0.5;
        
        this.nametag.updateMatrix();
    }

    postLoad(tree) {
        super.postLoad(tree);
        tree.scale.set([0.9, 0.9, 0.9]);

        this.changeHandItem(this.handItemId, false);
    }

    update(render, camPos, delta) {
        super.update(render, camPos, delta);

        if (!this.isRenderable) {
            return;
        }

        const angZ = 180 * (this.yaw + Math.PI/2 + Math.atan2(camPos.z - this.pos.z, camPos.x - this.pos.x)) / Math.PI;
        const angX = 0; // @todo
        
        quat.fromEuler(this.nametag.quat, angX, 0, angZ);
        this.nametag.updateMatrix();
    }
    // Returns the texture and vertex buffer for drawing the name
    // tag of the specified player over head.
    /**
     *
     * @param {string} username
     * @param render
     * @return {{texture: BaseTexture, model: GeometryTerrain}}
     */
    buildPlayerName(username, render) {
        username        = username.replace( /&lt;/g, "<" ).replace( /&gt;/g, ">" ).replace( /&quot;/, "\"" );
        let gl          = this.gl;
        let canvas      = this.textCanvas;
        let ctx         = this.textContext;
        let w           = ctx.measureText(username).width + 16;
        let h           = 45;
        // Draw text box
        ctx.fillStyle   = '#00000055';
        ctx.fillRect(0, 0, w, 45);
        ctx.fillStyle   = '#fff';
        ctx.font        = '24px Ubuntu';
        ctx.fillText(username, 10, 12);

        // abstraction
        const texture = render.renderBackend.createTexture({
            source: canvas,
        });

        // Create model
        let vertices = [
            -w/2, 0, h, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, h, 0, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, 0, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, 0, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2, 0, 0, w/256, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2, 0, h, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
        ];

        const node = new SceneNode();
        node.name = 'name_tag';
        node.terrainGeometry = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));
        node.material = render.defaultShader.materials.label.getSubMat(texture);

        return node;
    }

}
