import { BLOCK } from "./blocks.js";
import GeometryTerrain from "./geometry_terrain.js";
import { NORMALS, Helpers, Vector } from './helpers.js';
import { MobAnimation, MobModel } from "./mob_model.js";
import Particles_Block_Drop from "./particles/block_drop.js";
import { SceneNode } from "./SceneNode.js";

const {mat4, quat} = glMatrix;

const KEY_SLOT_MAP = {
    left: 'LeftArm',
    right: 'RightArm'
};

export class ModelSlot {
    constructor(name = '', parent = null) {
        /**
         * @type { SceneNode }
         */
        this.holder = new SceneNode(parent);
        this.holder.position.set(parent.pivot);

        this.id = -1;

        this.name = name;

        this.holder.updateMatrix();
    }
}

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
         * @type {Map<string, ModelSlot>}
         */
        this.slots = {};

        // for lazy state generation
        this.activeSlotsData = props.hands;
    }

    applyNetState(state) {
        super.applyNetState(state);

        this.changeSlots(state.hands);
    }

    changeSlots(data) {
        this.activeSlotsData = data;

        if (this.sceneTree && this.activeSlotsData) {
            for(const key in this.activeSlotsData) {
                this.changeSlotEntry(KEY_SLOT_MAP[key], this.activeSlotsData[key]);
            }
        }
    }

    changeSlotEntry(name, props) {
        if (!name || !props) {
            return;
        }

        let {
            id, scale = 0.3
        } = props;

        id = typeof id !== 'number' ? -1 : id;

        const slotLocation = this.sceneTree.findNode(name + 'ItemPlace');

        if (!slotLocation) {
            return;
        }

        const slot = (this.slots[name] || (this.slots[name] = new ModelSlot(name, slotLocation)));

        if (id == slot.id && slot.holder.terrainGeometry) {
            return;
        }

        if (slot.holder.terrainGeometry) {
            slot.holder.terrainGeometry.destroy();
            slot.holder.terrainGeometry = null;
        }

        slot.id = id;

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

        if (!item) {
            return;
        }
        
        slot.holder.terrainGeometry = item.buffer;
        slot.holder.material = item.material;

        const orient = name === 'LeftArm' ? -1 : 1;

        if (block.diagonal) {
            scale *= 1.2;

            quat.fromEuler(slot.holder.quat, 10 * orient, -70, 90 + 10 * orient);

        } else {
            quat.fromEuler(slot.holder.quat, 20, 0, -20);
        }

        slot.holder.scale.set([scale, scale, scale]);
        slot.holder.pivot.set([0, 0, scale / 2]);
        slot.holder.updateMatrix();
    }

    itsMe() {
        return this.username == Game.App.session.username;
    }

    postLoad(render, tree) {
        super.postLoad(tree);
        
        tree.scale.set([0.9, 0.9, 0.9]);
        
        if (this.nametag || !this.sceneTree) {
            return;
        }

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

        this.changeSlots(this.activeSlotsData);
    }

    update(render, camPos, delta) {
        super.update(render, camPos, delta);

        if (!this.isRenderable) {
            return;
        }

        if (!this.nametag) {
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
