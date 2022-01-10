import { Resources } from "./resources.js";
import { SceneNode } from "./SceneNode.js";
import * as ModelBuilder from "./modelBuilder.js";
import { Helpers, Vector } from "./helpers.js";
import { ChunkManager } from "./chunk_manager.js";
import { NetworkPhysicObject } from './network_physic_object.js';

const {mat4, vec3, quat} = glMatrix;

export class Traversable {
    constructor() {
        
        /**
         * @type {SceneNode}
         */
        this.sceneTree;

        /**
         * @type {boolean}
         */
        this.isRenderable;

        this.material;

        this.drawPos;
    }
}

export class Animable {
    constructor() {
        /**
         * @type {SceneNode}
         */
        this.sceneTree;
        this.aniframe = 0;
        this.pos;
        this.parts;
        this.animationScript;
    }
}

export class TraversableRenderer {
    /**
     * 
     * @param {SceneNode} node 
     * @param {SceneNode} parent 
     * @param {*} render 
     * @param {Traversable} traversable 
     * @returns 
     */
    traverse(node, parent = null, render, traversable) {
        if(!this.drawTraversed(node, parent, render, traversable)) {
            return false;
        }

        for(let next of node.children) {
            if (!this.traverse(next, node, render, traversable)) return false;
        }

        return true;
    }

    drawTraversed(node, parent, render, traversable) {

        if (!node.terrainGeometry) {
            return true;
        }

        render.renderBackend.drawMesh(
            node.terrainGeometry,
            node.material || traversable.material,
            traversable.drawPos,
            node.matrixWorld
        );

        return true;
    }

    /**
     * @param {} render
     * @param {Traversable} traversable 
     * @returns 
     */
    drawLayer(render, traversable) {
        if (!traversable || !traversable.sceneTree) {
            return;
        }

        if (!traversable.isRenderable) {
            return;
        }

        // Wait loading texture
        if(!traversable.material) {
            return;
        }

        this.traverse(traversable.sceneTree, null, render, traversable);
    }
}

export class Animator {
    prepare(animable) {

    }

    update(delta, camPos, animable) {
    }
}

export class MobAnimator extends Animator {
    prepare(animable) {
        const {
            sceneTree: tree,
            parts = {}
        } = animable;

        const legs = [];
        const heads = [];
        const arms = [];
        const wings = [];

        let leg;
        let arm;
        let head;
        let wing;

        for(let i = 0; i < 8; i ++) {
            leg = tree.findNode('leg' + i);
            leg && legs.push(leg);

            arm = tree.findNode('arm' + i);
            arm && arms.push(arm);

            wing = tree.findNode('wing' + i);
            wing && wings.push(wing);
        }

        // humanoid case
        leg = tree.findNode('LeftLeg');
        leg && legs.push(leg);

        // humanoid case
        leg = tree.findNode('RightLeg');
        leg && legs.push(leg);

        // humanoid case
        arm = tree.findNode('LeftArm');
        arm && arms.push(arm);

        // humanoid case
        arm = tree.findNode('RightArm');
        arm && arms.push(arm);
        
        head = tree.findNode('head') || tree.findNode('Head');

        parts['head'] = head ? [head] : [];
        parts['arm'] = arms;
        parts['leg'] = legs;
        parts['wing'] = wings;

        animable.parts = parts;
    }

    update(delta, camPos, animable) {
        if (!animable) {
            return;
        }

        if (!animable.parts) {
            this.prepare(animable);
        }

        if (!animable.parts) {
            return;
        }

        if (delta > 1000) {
            delta = 1000
        }

        let aniangle = 0;
        if(animable.moving || Math.abs(animable.aniframe) > 0.1) {
            animable.aniframe += (0.1 / 1000 * delta);
            if(animable.aniframe > Math.PI) {
                animable.aniframe  = -Math.PI;
            }

            aniangle = Math.PI / 4 * Math.sin(animable.aniframe);
            if(!animable.moving && Math.abs(aniangle) < 0.1) {
                animable.aniframe = 0;
            }
        }

        this.applyAnimation(delta, animable.aniframe, aniangle, camPos, animable);
    }

    applyAnimation(delta, aniframe, aniangle, camPos, animable) {
        const {
            animationScript, parts
        } = animable;

        if (!animationScript) {
            return;
        }

        for(const partKey in parts) {
            if (!animationScript[partKey]) {
                continue;
            }

            for(let i = 0; i < parts[partKey].length; i ++) {
                animationScript[partKey]({
                    part: parts[partKey][i],
                    index: i,
                    delta,
                    aniframe,
                    aniangle,
                    animable,
                    camPos
                });
            }
        }
    }
}

export class MobAnimation {
    head({
        part, index, delta, animable, camPos
    }) {
        let {
            yaw, pos, targetLook = 0
        } = animable;
 
        let angToCam = 0;
        
        if (Helpers.distance(pos, camPos) < 5) {
            angToCam = yaw  -Math.PI/2  + Math.atan2(camPos.z - pos.z, camPos.x - pos.x);

            while(angToCam > Math.PI) angToCam -= Math.PI * 2;
            while(angToCam < -Math.PI) angToCam += Math.PI * 2;

            if (Math.abs(angToCam) >= Math.PI / 4) {
                angToCam = 0;
            } 
        }

        if (Math.abs(angToCam - targetLook) > 0.05) {
            targetLook += Math.sign(angToCam - targetLook) * 0.05;
        }

        quat.fromEuler(part.quat, 0, 0, 180 * targetLook / Math.PI);
        part.updateMatrix();

        animable.targetLook = targetLook;
    }

    leg({
        part, index, aniangle, animable
    }) {
        const x = index % 2;
        const y = index / 2 | 0;
        const sign = x ^ y ? 1 : -1;

        quat.identity(part.quat);
        quat.rotateX(part.quat, part.quat, aniangle * sign);

        part.updateMatrix();
    }

    arm(opts) {
        opts.index += 2;
        return this.leg(opts);
    }

    wing({
        part, index, animable, delta
    }) {

        const deltaY = animable._prevPos.y - animable._pos.y;
        let p = part.frame = part.frame === undefined ? 0 : (part.frame + delta / 1000);

        const x = index % 2;
        const y = index / 2 | 0;
        const sign = (x ^ y ? 1 : -1);
        const isJump = +(Math.abs(deltaY) > 0.01);

        let anim = 0;

        if (isJump) {
            part.endFrame = part.frame + 30;
            anim = sign;
        }

        if (part.frame < part.endFrame) {
            anim = sign;
        }

        quat.fromEuler(
            part.quat,
            0,
            -anim * (Math.sin(p * Math.PI * 2 / 8) * 30 + 90),
            0,
        );

        part.updateMatrix();
    }
}

export class MobModel extends NetworkPhysicObject {

    constructor(props) {

        super(
            new Vector(0, 0, 0),
            new Vector(0, 0, 0)
        );

        this.sceneTree                  = null;
        this.texture                    = null;
        this.material = null;

        this.moving_timeout             = null;
        this.texture                    = null;
        this.nametag                    = null;
        this.aniframe                   = 0;
        this.height                     = 0;

        Object.assign(this, props);

        this.type = props.type;
        this.skin = props.skin_id || props.skin;

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

        this.posDirty = true;

        this.currentChunk = null;

        this.renderer = new TraversableRenderer();

        this.animator = new MobAnimator();

        this.animationScript = new MobAnimation();

    }

    get isRenderable() {
        return this.sceneTree && (
             this.currentChunk &&
             this.currentChunk.in_frustum || 
             !this.currentChunk);
    }

    lazyInit(render) {
        if (this.initialised) {
            return;
        }

        return this
            .loadModel(render)
            .then(()=>{
                this.initialised = true;
                this.postLoad(render, this.sceneTree);
            });
    }

    computeLocalPosAndLight(render) {
        if (!this.initialised) {
            return;
        }

        if (!this.sceneTree) {
            return;
        }

        const newChunk = ChunkManager.instance.getChunk(this.chunk_addr);

        this.lightTex = newChunk && newChunk.getLightTexture(render.renderBackend);
        
        if (this.material) {
            this.material.lightTex = this.lightTex;
        }

        
        // invalid state, chunk always should be presented
        if (!newChunk) {
            return;
        }

        this.currentChunk = newChunk;
        this.drawPos = newChunk.coord;

        // root rotation
        quat.fromEuler(this.sceneTree.quat, 0, 0, 180 * (Math.PI - this.yaw) / Math.PI);

        this.sceneTree.position.set([
            this.pos.x - this.drawPos.x,
            this.pos.z - this.drawPos.z,
            this.pos.y - this.drawPos.y,
        ]);

        this.sceneTree.updateMatrix();
    }

    update(render, camPos, delta) {
        super.update();

        this.computeLocalPosAndLight(render);

        if (!this.isRenderable) {
            return;
        }

        this.animator.update(delta, camPos, this);
    }

    // draw
    draw(render, camPos, delta) {
        this.lazyInit(render);
        this.update(render, camPos, delta);

        // run render
        this.renderer.drawLayer(render, this);
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
    async loadModel(render) {
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

        const asset = await Resources.getModelAsset(this.type);

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

        const image = await asset.getSkin(this.skin);

        this.loadTextures(render, image); 
    }

    /**
     * @param {Renderer} render
     * @param {SceneNode} tree 
     */
    postLoad(render, tree) {
        if (!tree) {
            return;
        }

        this.animator.prepare(this);
    }

}