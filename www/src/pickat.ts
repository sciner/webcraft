import { Vector } from "./helpers.js";
import {BLEND_MODES} from "./renders/BaseRenderer.js";
import GeometryTerrain from "./geometry_terrain.js";
import {Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import {Raycaster, RaycasterResult} from "./Raycaster.js";
import { MOUSE } from "./constant.js";
import {LineGeometry} from "./geom/line_geometry.js";
import {AABB} from "./core/AABB.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import type { Player } from "./player.js";
import type { World } from "./world.js";
import type { Renderer } from "./render.js";
import type { ChunkGrid } from "./core/ChunkGrid.js";
import type { ChunkManager } from "./chunk_manager.js";

const {mat4} = glMatrix;

const half = new Vector(0.5, 0.5, 0.5);

export interface ICmdPickatData extends IPickatEvent {
    actions ?           : any // POJO of WorldAction
    eye_pos ?           : IVector
    snapshotId ?        : int // id of the blocks history snapshot on the client that should be restored if this action afails on server
    changeExtraData ?   : boolean
    extra_data ?        : any
}

type PickAtOnTarget         = (e: IPickatEvent, times: float, number: int) => Promise<boolean>
type PickAtOnInteractEntity = (IPickatEvent) => void
type PickAtOnInteractFluid  = (IPickatEventPos) => boolean

export class PickAt {
    
    raycaster:          Raycaster
    chunk_addr:         Vector
    _temp_pos :         Vector = new Vector(0, 0, 0)
    world:              World
    render:             Renderer
    chunk_manager:      ChunkManager
    grid:               ChunkGrid
    targetDescription:  any = null
    visibleBlockHUD:    any = null
    onTarget:           PickAtOnTarget
    onInteractEntity:   PickAtOnInteractEntity
    onInteractFluid:    PickAtOnInteractFluid
    modelMatrix:        any
    empty_matrix:       any
    material_target:    any
    chunk:              any
    material_damage:    any

    target_block: {
        pos:        IPickatEventPos | Vector
        visible:    boolean
        geom:       LineGeometry
    }

    damage_block: {
        pos:        IPickatEventPos | Vector
        mesh:       any
        event?:     IPickatEvent
        frame:      number
        number:     number
        times:      number // количество миллисекунд, в течение которого на блок было воздействие
        prev_time:  any // точное время, когда в последний раз было воздействие на блок
        start:      any
    }

    private nextId = 0  // id of the next pickAt event, and the associated WorldAction

    constructor(world : World, render : Renderer, onTarget : PickAtOnTarget, onInteractEntity : PickAtOnInteractEntity, onInteractFluid : PickAtOnInteractFluid) {
        this.world              = world
        this.render             = render
        this.chunk_manager      = world.chunkManager
        this.grid               = world.chunkManager.grid
        this.onTarget           = onTarget // (block, target_event, elapsed_time) => {...};
        this.onInteractEntity   = onInteractEntity
        this.onInteractFluid    = onInteractFluid
        //
        this.target_block = {
            pos:                null,
            visible:            false,
            geom:               new LineGeometry()
        }
        //
        this.damage_block = {
            pos:        null,
            mesh:       null,
            event:      null,
            frame:      0,
            number:     0,
            times:      0, // количество миллисекунд, в течение которого на блок было воздействие
            prev_time:  null, // точное время, когда в последний раз было воздействие на блок
            start:      null
        }
        //
        const modelMatrix = this.modelMatrix = mat4.create();
        mat4.scale(modelMatrix, modelMatrix, [1.002, 1.002, 1.002]);
        //
        this.empty_matrix = mat4.create()
        this.raycaster = new Raycaster(this.world)
        this.target_block.geom.defColor = 0xFF000000
    }

    get(pos : IVector, callback : ((res: RaycasterResult | null) => void) | null = null,
        pickat_distance : number, view_vector?: IVector, ignore_transparent? : boolean, return_fluid? : boolean
    ): RaycasterResult | null {
        const render = this.render;
        pos = this._temp_pos.copyFrom(pos);
        // view_vector = null;
        const myPlayerModel = this.world.players.getMyself()
        if(view_vector) {
            return this.raycaster.get(pos, view_vector, pickat_distance, callback, ignore_transparent, return_fluid, myPlayerModel);
        }
        const m = mat4.invert(this.empty_matrix, render.viewMatrix);
        return this.raycaster.getFromView(pos, m, pickat_distance, callback, ignore_transparent, return_fluid, myPlayerModel);
    }

    // Used by other classes
    getTargetBlock(player : Player) {
        if (!player.game_mode.canBlockAction()) {
            return null;
        }
        // Get actual pick-at block
        const pos = this.get(player.getEyePos(), null, player.game_mode.getPickatDistance(), player.forward, true);
        return pos ? this.world.getBlock(new Vector(pos as any)) : null;
    }

    getNextId(): int    { return ++this.nextId }

    // setEvent...
    setEvent(player: Player, e_: {button_id: int, shiftKey: boolean}): void {
        const e = e_ as IPickatEvent
        e.id                = this.getNextId()
        e.start_time        = performance.now();
        e.destroyBlock      = e.button_id == MOUSE.BUTTON_LEFT;
        e.cloneBlock        = e.button_id == MOUSE.BUTTON_WHEEL;
        e.createBlock       = e.button_id == MOUSE.BUTTON_RIGHT;
        e.interactMobID     = null;
        e.interactPlayerID  = null;
        e.number            = 0;
        const damage_block  = this.damage_block;
        damage_block.event  = Object.assign(e, {number: 0});
        damage_block.start  = performance.now();
        this.updateDamageBlock();
        // Picking target
        /*if (player.pickAt && Qubatch.hud.active && player.game_mode.canBlockAction()) {
            player.pickAt.update(player.pos, player.game_mode.getPickatDistance());
        }*/
    }

    // setDamagePercent...
    setDamagePercent(pos, percent) {
        let damage_block = this.damage_block;
        let new_frame = Math.round(percent * 9);
        if(damage_block.frame != new_frame) {
            damage_block.frame = new_frame;
            if(damage_block.mesh) {
                damage_block.mesh.destroy();
                damage_block.mesh = this.createDamageBuffer(pos, BLOCK.calcTexture([14 + new_frame, 31]));
            }
        }
    }

    // updateDamageBlock...
    updateDamageBlock() {
        let target_block = this.target_block;
        if(target_block.visible) {
            let damage_block = this.damage_block;
            if(damage_block.mesh) {
                damage_block.mesh.destroy();
            }
            damage_block.pos        = target_block.pos;
            damage_block.number     = 0;
            damage_block.frame      = 0;
            damage_block.times      = 0;
            damage_block.prev_time  = null;
            damage_block.mesh       = this.createDamageBuffer(damage_block.pos, BLOCK.calcTexture([damage_block.frame, 15]));
        }
    }

    // update...
    update(pos: IVector, pickat_distance: number, view_vector: IVector): void {

        // Get actual pick-at block
        let bPos = this.get(pos, null, pickat_distance, view_vector, false);

        let target_block = this.target_block;
        let damage_block = this.damage_block;
        target_block.visible = !!bPos?.point && !bPos.mob && !bPos.player;

        this.updateTargetDescription(target_block.visible ? bPos : null);

        // Detect interact with fluid
        if (bPos?.fluidLeftTop && this.onInteractFluid(bPos.fluidLeftTop)) {
            return
        }

        if(bPos && bPos.point) {
            if(bPos.player || bPos.mob) {
                if(this.onInteractEntity instanceof Function) {
                    if(this.damage_block.event) {
                        this.damage_block.event.interactPlayerID = bPos?.player?.id;
                        this.damage_block.event.interactMobID = bPos?.mob?.id;
                        this.onInteractEntity(this.damage_block.event);
                        this.damage_block.event = null;
                    }
                }
                return;
            }
            damage_block.pos = bPos;
            // Check if pick-at block changed, or HUD info visibility changed
            let tbp = target_block.pos;
            const newVisibleBlockHUD = Qubatch.hud.isDrawingBlockInfo();
            if(!tbp || (tbp.x != bPos.x || tbp.y != bPos.y || tbp.z != bPos.z) ||
                this.visibleBlockHUD !== newVisibleBlockHUD
            ) {
                this.visibleBlockHUD = newVisibleBlockHUD;
                // 1. Target block
                target_block.pos = bPos;
                this.createTargetLines(bPos, target_block.geom);
                // 2. Damage block
                if(damage_block.event) {
                    damage_block.pos = bPos;
                    this.updateDamageBlock();
                }
            }
        } else {
            damage_block.prev_time = null;
        }
        this.checkTargets();
    }

    // checkTargets...
    async checkTargets() {
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        if(!target_block.visible) {
            return false;
        }
        if(!damage_block.event) {
            return false;
        }
        damage_block.number++;
        damage_block.event.number++;
        let pn = performance.now();
        if(damage_block.prev_time) {
            damage_block.times += pn - damage_block.prev_time;
        }
        damage_block.prev_time = pn;
        if(this.onTarget instanceof Function) {
            // полное копирование, во избежания модификации
            let event = {...damage_block.event};
            event.pos = {...damage_block.pos} as IPickatEventPos;
            event.pos.n = (event.pos.n as Vector).clone();
            event.pos.point = (event.pos.point as Vector).clone();
            if(await this.onTarget(event, damage_block.times / 1000, damage_block.number)) {
                this.updateDamageBlock();
                if(damage_block.mesh) {
                    damage_block.mesh.destroy();
                    damage_block.mesh = null;
                }
            }
        }
        return false;
    }

    // Draw meshes
    draw() {
        if(!Qubatch.hud.active) {
            return;
        }
        if(!this.material_target) {
            this.initMaterials();
        }
        let render = this.render;
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        // 1. Target block
        if(target_block.geom && target_block.visible) {
            target_block.geom.draw(render.renderBackend);
        }
        // 2. Damage block
        if(damage_block.mesh && damage_block.event && damage_block.event.destroyBlock && damage_block.frame > 0) {

            const matrix = mat4.create();
            let a_pos = half.add(this.damage_block.pos);

            // Light
            this.chunk_addr = this.grid.toChunkAddr(this.damage_block.pos);
            this.chunk = this.chunk_manager.getChunk(this.chunk_addr);
            if(this.chunk) {
                mat4.translate(matrix, matrix,
                    [
                        (a_pos.x - this.chunk.coord.x),
                        (a_pos.y - this.chunk.coord.y),
                        (a_pos.z - this.chunk.coord.z),
                    ]
                );
                a_pos = this.chunk.coord;
            }
            const light = this.chunk.getLightTexture(render.renderBackend);
            if(light) {
                this.material_damage.changeLighTex(light);
            }

            render.renderBackend.drawMesh(damage_block.mesh, this.material_damage, a_pos, matrix || this.modelMatrix);
        }
    }

    createTargetLines(pos, geom) {
        const lineWidth = 100 / Qubatch.render.HUD.height * 1.5 // .25

        const aabbConfig = {isLocal: true, lineWidth, colorBGRA: 0xFF000000};
        let vertices    = [];
        geom.clear();
        geom.pos.copyFrom(pos);
        // let pp = 0;
        // let flags       = 0, sideFlags = 0, upFlags = 0;
        let block       = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        let shapes      = BLOCK.getShapes(pos, block, this.world, false, false);
        let aabb = new AABB();
        for (let i = 0; i < shapes.length; i++) {
            aabb.set(...shapes[i]);
            geom.addAABB(aabb, aabbConfig);
        }
        return new GeometryTerrain(vertices);
    }

    // createTargetBuffer...
    createTargetBuffer(pos, c) {
        let vertices    = [];
        let pp = 0;
        let flags       = 0, sideFlags = 0, upFlags = 0;
        let block       = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        let shapes      = BLOCK.getShapes(pos, block, this.world, false, false);
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            let x1 = shape[0];
            let x2 = shape[3];
            let y1 = shape[1];
            let y2 = shape[4];
            let z1 = shape[2];
            let z2 = shape[5];
            let xw = x2 - x1; // ширина по оси X
            let yw = y2 - y1; // ширина по оси Y
            let zw = z2 - z1; // ширина по оси Z
            let x = -.5 + x1 + xw/2;
            let y_top = -.5 + y2;
            let y_bottom = -.5 + y1;
            let z = -.5 + z1 + zw/2;
            // Up; X,Z,Y
            vertices.push(x, z, y_top,
                xw, 0, 0,
                0, zw, 0,
                c[0], c[1], c[2], c[3],
                pp, flags | upFlags);
            // Bottom
            vertices.push(x, z, y_bottom,
                xw, 0, 0,
                0, -zw, 0,
                c[0], c[1], c[2], c[3],
                pp, flags);
            // South | Forward | z++ (XZY)
            vertices.push(x, z - zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, yw,
                c[0], c[1], c[2], -c[3],
                pp, flags | sideFlags);
            // North | Back | z--
            vertices.push(x, z + zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, -yw,
                c[0], c[1], -c[2], c[3],
                pp, flags | sideFlags);
            // West | Left | x--
            vertices.push(x - xw/2, z, y_bottom + yw/2,
                0, zw, 0,
                0, 0, -yw,
                c[0], c[1], -c[2], c[3],
                pp, flags | sideFlags);
            // East | Right | x++
            vertices.push(x + xw/2, z, y_bottom + yw/2,
                0, zw, 0,
                0, 0, yw,
                c[0], c[1], -c[2], c[3],
                pp, flags | sideFlags);
        }
        return new GeometryTerrain(vertices);
    }

    // for HUD
    updateTargetDescription(pos_: IVector | null) {
        if (!Qubatch.hud.isDrawingBlockInfo() || !pos_) {
            this.targetDescription =null;
            return;
        }
        const pos = Vector.vectorify(pos_);
        const block = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        if (block.id === BLOCK.DUMMY.id || block.id === BLOCK.AIR.id) {
            this.targetDescription = null;
            return;
        }
        this.targetDescription = {
            worldPos:   pos,
            posInChunk: pos.clone().subSelf(block.tb.dataChunk.pos),
            chunkAddr:  this.grid.toChunkAddr(pos),
            block:      block.clonePOJO(),
            material:   block.material,
            fluid:      block.fluid
        }
    }

    // createDamageBuffer...
    createDamageBuffer(pos, c) {
        return this.createTargetBuffer(pos, c);
    }

    // initMaterials
    initMaterials() {
        // Material (damage)
        this.material_damage = this.render.renderBackend.createMaterial({
            cullFace: true,
            opaque: false,
            blendMode: BLEND_MODES.MULTIPLY,
            shader: this.render.defaultShader,
        });
        // Material (target)
        this.material_target = this.material_damage.getSubMat(this.render.renderBackend.createTexture({
            source: Resources.pickat.target,
            minFilter: 'nearest',
            magFilter: 'nearest'
        }));
    }

    // Сбросить текущий прогресс разрушения/установки
    resetProgress() {
        const damage_block = this.damage_block;
        this.target_block.pos = new Vector(0, -Number.MAX_SAFE_INTEGER, 0);
        if(damage_block) {
            damage_block.times = 0;
            damage_block.event = null;
            if(damage_block.mesh) {
                damage_block.mesh.destroy();
                damage_block.mesh = null;
            }
        }
    }

}
