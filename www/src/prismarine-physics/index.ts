import {Mth, Vector} from "../helpers.js";
import { Effect } from "../block_type/effect.js";
import { AABB } from "./lib/aabb.js";
import {Resources} from "../resources.js";
import type {FakeBlock, TPrismarineOptions} from "./using.js";
import {FakeWorld, addDefaultPhysicsOptions} from "./using.js";
import {PHYSICS_ROTATION_DECIMALS, PLAYER_ZOOM} from "../constant.js";
import { TBlock } from "../typed_blocks3.js";
import type {IPlayerControls, IPlayerControlState} from "../control/player_control.js";
import type {Effects} from "../player.js";
import {FLUID_LEVEL_MASK, FLUID_TYPE_MASK, FLUID_WATER_ID} from "../fluid/FluidConst.js";
import type {World} from "../world.js";
import type {TDrivingConfig} from "../control/driving.js";

const BLOCK_NOT_EXISTS = -2;
const _ladder_check_tblock = new TBlock()
const tmpVectorCursor = new Vector()
const DX_DZ_FOUR_DIRECTIONS = [[0, 1], [-1, 0], [0, -1], [1, 0]]

function makeSupportFeature(mcData, features): (feature: string) => boolean {
    return feature => features.some(({ name, versions }) => name === feature && versions.includes(mcData.version.majorVersion))
}

type TPrismarineEffects = {
    effects?: Effects[]
}

type TLiquidInBB = {
    waterBlocks: FakeBlock[]
    lavaBlocks: FakeBlock[]
    submergedHeight: float
}

export class Physics {

    private readonly world              : FakeWorld
    private readonly block_manager      : typeof BLOCK

    // ================== options from old Physics function ===================

    private readonly supportFeature_velocityBlocksOnTop: boolean
    private readonly supportFeature_climbUsingJump: boolean
    private readonly blockSlipperiness  : (float | undefined)[] = []
    // Block ids
    private readonly slimeBlockId       : int | null
    private readonly soulsandId         : int
    private readonly honeyblockId       : int // 1.15+
    private readonly cobwebLikePassable : (float | undefined)[] = [] // for cobweb-like it's passable value
    private readonly ladderId           : int
    private readonly vineId             : int
    private readonly bubbleColumnId     : int
    private readonly iceIds             : int[]

    // =================== options from old physics object ====================
    
    private readonly scale              = PLAYER_ZOOM
    private readonly gravity            = 0.08 * this.scale // blocks/tick^2 https://minecraft.gamepedia.com/Entity#Motion_of_entities
    private readonly jumpSpeed         = 0.42 // вертикальная скорость прыжка, без учета scale
    // Flying
    private readonly flyinGravity       = 0.06
    private readonly flyingYSpeed       = Math.fround(0.42 / 2) * this.scale
    /* Old code:
    private readonly flyingInertiaMultiplyer = 1.5

    New code:
    these values are the same that have been computed when flying a player in a creative mode:
    DEFAULT_SLIPPERINES = 0.6
    <initail_initia> = DEFAULT_SLIPPERINES * 0.91
    flyingInertia = <initail_initia> * flyingInertiaMultiplyer
    flyingAcceleration = 0.1 * (0.1627714 / (<initail_initia> * <initail_initia> * <initail_initia>))
    */
    private readonly flyingInertia      = 0.819
    private readonly flyingAcceleration = 0.1
    //
    private readonly airdrag            = Math.fround(1 - 0.02) // actually (1 - drag)
    private readonly pitchSpeed         = 3.0
    private readonly sprintSpeed        = 1.3
    private readonly sneakSpeed         = 0.3
    private readonly swimDownDrag = {
        down: 0.05,
        maxDown: -0.5
    }
    private readonly negligeableVelocity = 0.003 // actually 0.005 for 1.8, but seems fine
    private readonly soulsandSpeed      = 0.4
    private readonly honeyblockSpeed    = 0.4
    private readonly honeyblockJumpSpeed = 0.4
    private readonly ladderMaxSpeed     = 0.15
    private readonly ladderClimbSpeed   = 0.2 * this.scale
    /**
     * What fraction of the speed remains in the next tick.
     * Physically it's more correct to call it not "inertia", but (1 - friction)
     */
    private readonly waterInertia       = 0.8
    private readonly lavaInertia        = 0.5
    private readonly liquidAcceleration = 0.02
    private readonly airborneInertia    = 0.91
    private readonly airborneAcceleration = 0.02
    private readonly outOfLiquidImpulse = 0.3
    private readonly autojumpCooldown   = 10 // ticks (0.5s)
    private readonly bubbleColumnSurfaceDrag = {
        down: 0.03,
        maxDown: -0.9,
        up: 0.1,
        maxUp: 1.8
    }
    private readonly bubbleColumnDrag = {
        down: 0.03,
        maxDown: -0.3,
        up: 0.06,
        maxUp: 0.7
    }
    private readonly slowFalling        = 0.125
    private readonly speedEffect        = 1.2
    private readonly slowEffect         = 0.85
    private readonly waterGravity       : number
    private readonly lavaGravity        : number

    // ========================= поворот при вождении =========================
    private readonly maxAngularSpeed    = 0.15  // радиан/тик
    private readonly angularAcceleration= 0.015 // радиан/тик^2
    private readonly angularInertia     = 0.85  // аналогично другим видам инерции - на нее умножается скорость в каждом тике
    private readonly minAngularSpeed    = 0.003 // радиан/тик. Если скорость меньшей этого значения, наступает полная остановка.

    // ==================== специальная значения для лодки ====================
    private readonly floatDrag = {  // плавучесть, например, лодки
        up: 0.05,
        maxUp: 0.5,
        friction: 0.4
    }
    // Особые значения для лодки в воде. Не подогнано точно как в майне. См. https://minecraft.fandom.com/wiki/Boat#Speed
    private readonly boatLiquidAcceleration = 0.08
    private readonly boatLiquidInertia = 0.9
    // Особые значения для лодки на льду. Не подогнано точно как в майне.
    private readonly boatOtherIceAcceleration = 0.07
    private readonly boatBlueIceAcceleration = 0.12

    // ========================== temporary objects ===========================

    private tmpPlayerBB     = new AABB()
    private tmpWaterBB      = new AABB()
    private tmpLavaBB       = new AABB()
    private tmpLiquidBB     = new AABB()
    private tmpBB           = new AABB()
    private tmpBBgetLiquid  = new AABB()
    private tmpVector       = new Vector()
    private tmpFlowVec      = new Vector()
    private tmpAccelerationVec = new Vector()

    constructor(world: World) {
        const mcData        = FakeWorld.getMCData()
        this.world          = new FakeWorld(world)
        this.block_manager  = world.block_manager
        const bm            = this.block_manager

        // ================== options from old Physics function ===================

        const supportFeature = makeSupportFeature(mcData, Resources.physics.features)
        this.supportFeature_velocityBlocksOnTop = supportFeature('velocityBlocksOnTop')
        this.supportFeature_climbUsingJump =  supportFeature('climbUsingJump')

        // Block Slipperiness
        // https://www.mcpk.wiki/w/index.php?title=Slipperiness
        const blockSlipperiness = this.blockSlipperiness
        this.slimeBlockId = null // blocksByName.slime_block ? blocksByName.slime_block.id : blocksByName.slime.id
        // noinspection PointlessBooleanExpressionJS
        if (this.slimeBlockId) {
            blockSlipperiness[this.slimeBlockId] = 0.8
        }
        blockSlipperiness[bm.ICE.id] = 0.98
        blockSlipperiness[bm.PACKED_ICE.id] = 0.98
        if (bm.FROSTED_ICE) { // 1.9+
            blockSlipperiness[bm.FROSTED_ICE.id] = 0.98
        }
        if (bm.BLUE_ICE) { // 1.13+
            blockSlipperiness[bm.BLUE_ICE.id] = 0.989
        }

        // Block ids
        this.soulsandId     = bm.SOUL_SAND.id
        this.honeyblockId   = bm.HONEY_BLOCK?.id ?? BLOCK_NOT_EXISTS // 1.15+
        for (const block of [bm.COBWEB, bm.SWEET_BERRY_BUSH]) {
            this.cobwebLikePassable[block.id] = block.passable
        }
        this.ladderId       = bm.LADDER.id
        this.vineId         = bm.VINE.id
        this.bubbleColumnId = bm.BUBBLE_COLUMN?.id ?? BLOCK_NOT_EXISTS // 1.13+
        this.iceIds         = [bm.ICE, ...bm.bySuffix['_ICE']].map(mat => mat.id)

        // =================== options from old physics object ====================

        if (supportFeature('independentLiquidGravity')) {
            this.waterGravity   = 0.02
            this.lavaGravity    = 0.02
        } else if (supportFeature('proportionalLiquidGravity')) {
            this.waterGravity   = this.gravity / 16
            this.lavaGravity    = this.gravity / 4
        } else {
            this.waterGravity   = 0
            this.lavaGravity    = 0
        }
    }

    private getPlayerBB(entity: PrismarinePlayerState, pos: IVector, res: AABB): AABB {
        const options = entity.options
        const w = options.playerHalfWidth * this.scale
        return res.set(-w, 0, -w, w, options.playerHeight, w).translate(pos.x, pos.y, pos.z)
    }

    private setPositionToBB(entity: PrismarinePlayerState, bb: AABB): void {
        const pos = entity.pos
        const halfWidth = entity.options.playerHalfWidth * this.scale
        pos.x = bb.x_min + halfWidth
        pos.y = bb.y_min
        pos.z = bb.z_min + halfWidth
    }

    private getSurroundingBBs(queryBB: AABB): AABB[] {
        const world = this.world
        const surroundingBBs = []
        const cursor = new Vector(0, 0, 0)
        for (cursor.y = Math.floor(queryBB.y_min) - 1; cursor.y <= Math.floor(queryBB.y_max); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.z_min); cursor.z <= Math.floor(queryBB.z_max); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.x_min); cursor.x <= Math.floor(queryBB.x_max); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && block.id > 0) {
                        const blockPos = block.position
                        for (const shape of block.shapes) {
                            const blockBB = new AABB(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5])
                            blockBB.translate(blockPos.x, blockPos.y, blockPos.z)
                            surroundingBBs.push(blockBB)
                        }
                    }
                }
            }
        }
        return surroundingBBs
    }

    private moveEntity(entity: PrismarinePlayerState, dx: float, dy: float, dz: float): void {
        const world = this.world
        const options = entity.options
        const vel = entity.vel
        const pos = entity.pos
        let playerBB = this.getPlayerBB(entity, pos, this.tmpPlayerBB)
        const tmpBB = this.tmpBB

        if (entity.isInWeb) {
            dx *= entity.passable; // 0.25
            dy *= entity.passable / 5; // 0.05
            dz *= entity.passable; // 0.25
            vel.x = 0
            vel.y = 0
            vel.z = 0
            entity.isInWeb = false
        }

        let oldVelX = dx
        const oldVelY = dy
        let oldVelZ = dz

        if (entity.control.sneak && entity.onGround) {
            const step = 0.05

            // In the 3 loops bellow, y offset should be -1, but that doesnt reproduce vanilla behavior.
            for (; dx !== 0 && this.getSurroundingBBs(tmpBB.copyFrom(playerBB).translate(dx, 0, 0)).length === 0; oldVelX = dx) {
                if (dx < step && dx >= -step) dx = 0
                else if (dx > 0) dx -= step
                    else dx += step
            }

            for (; dz !== 0 && this.getSurroundingBBs(tmpBB.copyFrom(playerBB).translate(0, 0, dz)).length === 0; oldVelZ = dz) {
                if (dz < step && dz >= -step) dz = 0
                else if (dz > 0) dz -= step
                    else dz += step
            }

            while (dx !== 0 && dz !== 0 && this.getSurroundingBBs(tmpBB.copyFrom(playerBB).translate(dx, 0, dz)).length === 0) {
                if (dx < step && dx >= -step) dx = 0
                else if (dx > 0) dx -= step
                    else dx += step

                if (dz < step && dz >= -step) dz = 0
                else if (dz > 0) dz -= step
                else dz += step

                oldVelX = dx
                oldVelZ = dz
            }
        }

        const queryBB = playerBB.clone().extend(dx, dy, dz)
        const surroundingBBs = this.getSurroundingBBs(queryBB)
        const oldBB = playerBB.clone()

        for (const blockBB of surroundingBBs) {
            dy = blockBB.computeOffsetY(playerBB, dy)
        }
        playerBB.translate(0, dy, 0)

        for (const blockBB of surroundingBBs) {
            dx = blockBB.computeOffsetX(playerBB, dx)
        }
        playerBB.translate(dx, 0, 0)

        for (const blockBB of surroundingBBs) {
            dz = blockBB.computeOffsetZ(playerBB, dz)
        }
        playerBB.translate(0, 0, dz)

        // Step on block if height < stepHeight
        if (options.stepHeight * this.scale > 0 &&
            (entity.onGround || (dy !== oldVelY && oldVelY < 0)) &&
            (dx !== oldVelX || dz !== oldVelZ)) {
            const oldVelXCol = dx
            const oldVelYCol = dy
            const oldVelZCol = dz
            const oldBBCol = playerBB.clone()

            dy = options.stepHeight * this.scale
            const queryBB = oldBB.clone().extend(oldVelX, dy, oldVelZ)
            const surroundingBBs = this.getSurroundingBBs(queryBB)

            const BB1 = oldBB.clone().extend(dx, 0, dz)
            const BB2 = oldBB.clone()
            // the third case is used when we enter a 2-block-high tunnel where the floor rises slightly
            const BB3 = oldBB.clone().extend(oldVelX, 0, oldVelZ)

            let dy1 = dy
            let dy2 = dy
            let dy3 = dy
            for (const blockBB of surroundingBBs) {
                dy1 = blockBB.computeOffsetY(BB1, dy1)
                dy2 = blockBB.computeOffsetY(BB2, dy2)
                dy3 = blockBB.computeOffsetY(BB3, dy3)
            }
            BB1.copyFrom(oldBB).translate(0, dy1, 0)
            BB2.translate(0, dy2, 0)
            BB3.copyFrom(oldBB).translate(0, dy3, 0)

            let dx1 = oldVelX
            let dx2 = oldVelX
            let dx3 = oldVelX
            for (const blockBB of surroundingBBs) {
                dx1 = blockBB.computeOffsetX(BB1, dx1)
                dx2 = blockBB.computeOffsetX(BB2, dx2)
                dx3 = blockBB.computeOffsetX(BB3, dx3)
            }
            BB1.translate(dx1, 0, 0)
            BB2.translate(dx2, 0, 0)
            BB3.translate(dx3, 0, 0)

            let dz1 = oldVelZ
            let dz2 = oldVelZ
            let dz3 = oldVelZ
            for (const blockBB of surroundingBBs) {
                dz1 = blockBB.computeOffsetZ(BB1, dz1)
                dz2 = blockBB.computeOffsetZ(BB2, dz2)
                dz3 = blockBB.computeOffsetZ(BB3, dz3)
            }
            BB1.translate(0, 0, dz1)
            BB2.translate(0, 0, dz2)
            BB3.translate(0, 0, dz3)

            const norm1 = dx1 * dx1 + dz1 * dz1
            const norm2 = dx2 * dx2 + dz2 * dz2
            const norm3 = dx3 * dx3 + dz3 * dz3

            if (norm1 >= norm2 && norm1 >= norm3) {
                dx = dx1
                dy = -dy1
                dz = dz1
                playerBB = BB1
            } else if (norm2 >= norm1 && norm2 >= norm3) {
                dx = dx2
                dy = -dy2
                dz = dz2
                playerBB = BB2
            } else {
                dx = dx3
                dy = -dy3
                dz = dz3
                playerBB = BB3
            }

            for (const blockBB of surroundingBBs) {
                dy = blockBB.computeOffsetY(playerBB, dy)
            }
            playerBB.translate(0, dy, 0)

            if (oldVelXCol * oldVelXCol + oldVelZCol * oldVelZCol >= dx * dx + dz * dz) {
                dx = oldVelXCol
                dy = oldVelYCol
                dz = oldVelZCol
                playerBB = oldBBCol
            }
        }

        // Update flags
        this.setPositionToBB(entity, playerBB)
        entity.isCollidedHorizontally = dx !== oldVelX || dz !== oldVelZ
        entity.isCollidedVertically = dy !== oldVelY
        entity.onGround = entity.isCollidedVertically && oldVelY < 0

        const blockAtFeet = world.getBlock(pos.offset(0, -0.2, 0))

        if (dx !== oldVelX) vel.x = 0
        if (dz !== oldVelZ) vel.z = 0
        if (dy !== oldVelY) {
            if (blockAtFeet && blockAtFeet.id === this.slimeBlockId && !entity.control.sneak) {
                vel.y = -vel.y
            } else {
                vel.y = 0
            }
        }

        // Finally, apply block collisions (web, soulsand...)
        playerBB.contract(0.001, 0.001, 0.001)
        const cursor = new Vector(0, 0, 0)
        for (cursor.y = Math.floor(playerBB.y_min); cursor.y <= Math.floor(playerBB.y_max); cursor.y++) {
            for (cursor.z = Math.floor(playerBB.z_min); cursor.z <= Math.floor(playerBB.z_max); cursor.z++) {
                for (cursor.x = Math.floor(playerBB.x_min); cursor.x <= Math.floor(playerBB.x_max); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && block.id > 0) {
                        /*if (supportFeature('velocityBlocksOnCollision')) {
                            if (block.id === soulsandId) {
                                vel.x *= this.soulsandSpeed
                                vel.z *= this.soulsandSpeed
                            } else if (block.id === honeyblockId) {
                                vel.x *= this.honeyblockSpeed
                                vel.z *= this.honeyblockSpeed
                            }
                        }*/
                        const cobwebLikePassable = this.cobwebLikePassable[block.id]
                        if (cobwebLikePassable != null) {
                            entity.isInWeb = true
                            entity.passable = cobwebLikePassable
                        } else if (block.id === this.bubbleColumnId) {
                            // TODO: fast fix
                            const down = false; // !block.metadata
                            const aboveBlock = world.getBlock(cursor.offset(0, 1, 0))
                            const bubbleDrag = (aboveBlock && aboveBlock.id === 0 /* air */) ? this.bubbleColumnSurfaceDrag : this.bubbleColumnDrag
                            if (down) {
                                vel.y = Math.max(bubbleDrag.maxDown, vel.y - bubbleDrag.down)
                            } else {
                                vel.y = Math.min(bubbleDrag.maxUp, vel.y + bubbleDrag.up)
                            }
                        }
                    }
                }
            }
        }
        if (this.supportFeature_velocityBlocksOnTop) {
            const blockBelow = world.getBlock(entity.pos.floored().offset(0, -0.5, 0))
            if (blockBelow && blockBelow.id > 0) {
                if (blockBelow.id === this.soulsandId) {
                    vel.x *= this.soulsandSpeed
                    vel.z *= this.soulsandSpeed
                } else if (blockBelow.id === this.honeyblockId) {
                    vel.x *= this.honeyblockSpeed
                    vel.z *= this.honeyblockSpeed
                }
            }
        }
    }

    /**
     * @param strafe - см. forward
     * @param forward Поведение: при длине вектора (strafe, forward) <= 1, ускорение пропорционально и длине
     *   этого вектора, и {@param multiplier}. При дальнейшкм росте длины этого вектора, ускорение уже не растет.
     */
    private applyHeading(entity: PrismarinePlayerState, strafe: float, forward: float, multiplier: float): void {
        const length = Math.sqrt(strafe * strafe + forward * forward)
        if (length < 0.01) return

        const norm = multiplier / Math.max(length, 1)

        strafe *= norm * this.scale
        forward *= norm * this.scale

        const yaw = Math.PI - entity.yaw
        const sin = Math.sin(yaw)
        const cos = Math.cos(yaw)

        const vel = entity.vel
        vel.x += strafe * cos - forward * sin
        vel.z += forward * cos + strafe * sin
    }

    private isLadder(block: FakeBlock | null): boolean {
        return (block && (block.id === this.ladderId || block.id === this.vineId))
    }

    private isOnLadder(pos: Vector): boolean {
        const offset_value_y = .07
        const _pos = pos.offset(0, offset_value_y, 0).flooredSelf()
        const block = this.world.getBlock(_pos, _ladder_check_tblock)
        let resp = this.isLadder(block)
        // if block is opened trapdoor
        if(!resp && block?.tblock && block.tblock.material.tags.includes('trapdoor') && block.tblock.extra_data?.opened) {
            // check under block
            _pos.y--
            resp = this.isLadder(this.world.getBlock(_pos))
        }
        return resp
    }

    private doesNotCollide(entity: PrismarinePlayerState, pos: Vector): boolean {
        const pBB = this.getPlayerBB(entity, pos, this.tmpPlayerBB)
        return !this.getSurroundingBBs(pBB).some(x => pBB.intersect(x)) && this.getLiquidInBB(pBB) == null
    }

    private moveEntityWithHeading(entity: PrismarinePlayerState, strafe: number, forward: number): void {
        const options = entity.options
        const vel = entity.vel
        const pos = entity.pos

        let gravityMultiplier = (vel.y <= 0 && entity.slowFalling > 0) ? this.slowFalling : 1;
        if(entity.flying) {
            gravityMultiplier = 0;
        }

        if (!entity.isInWater && !entity.isInLava) {
            // Normal movement
            let acceleration    = options.airborneAcceleration ?? this.airborneAcceleration
            let inertia         = options.airborneInertia ?? this.airborneInertia

            if (entity.flying) {
                inertia         = this.flyingInertia
                acceleration    = this.flyingAcceleration
            } else if (entity.onGround) {
                const blockUnder = this.world.getBlock(pos.offset(0, -1, 0))
                if (blockUnder) {
                    inertia = (this.blockSlipperiness[blockUnder.id] || options.defaultSlipperiness) * 0.91
                    if (options.useBoatSpeed && this.iceIds.includes(blockUnder.id)) {
                        acceleration = blockUnder.id === this.block_manager.BLUE_ICE?.id
                            ? this.boatBlueIceAcceleration
                            : this.boatOtherIceAcceleration
                    } else {
                        acceleration = 0.1 * (0.1627714 / (inertia * inertia * inertia))
                    }
                }
            }

            if (entity.control.pitch) {
                acceleration *= this.pitchSpeed;
            }
            if (entity.control.sprint) {
                acceleration *= this.sprintSpeed;
            }
            const speed = getEffectLevel(Effect.SPEED, options.effects);
            if (speed > 0) {
                acceleration *= this.speedEffect * speed;
            }
            const slowness = getEffectLevel(Effect.SLOWNESS, options.effects);
            if (slowness > 0) {
                acceleration *= this.slowEffect / slowness;
            }

            this.applyHeading(entity, strafe, forward, acceleration)

            if (entity.isOnLadder) {
                vel.x = Mth.clampModule(vel.x, this.ladderMaxSpeed)
                vel.z = Mth.clampModule(vel.z, this.ladderMaxSpeed)
                vel.y = Math.max(vel.y, entity.control.sneak ? 0 : -this.ladderMaxSpeed)
            }

            this.moveEntity(entity, vel.x, vel.y, vel.z)

            if (entity.isOnLadder && (entity.isCollidedHorizontally ||
                (this.supportFeature_climbUsingJump && entity.control.jump))) {
                vel.y = this.ladderClimbSpeed // climb ladder
            }

            // Apply friction and gravity
            const levitation = getEffectLevel(Effect.LEVITIATION, options.effects);
            if (levitation > 0) {
                vel.y += (0.05 * levitation - vel.y) * 0.2;
            } else {
                if(entity.flying) {
                    vel.y -= (this.flyinGravity);
                    vel.y = Math.max(vel.y, 0);
                } else {
                    vel.y -= this.gravity * gravityMultiplier
                }
            }
            vel.y *= this.airdrag
            vel.x *= inertia
            vel.z *= inertia
        } else {
            // Water / Lava movement
            const lastY = pos.y
            let acceleration = this.liquidAcceleration
            const verticalInertia = entity.isInWater ? this.waterInertia : this.lavaInertia
            let horizontalInertia = verticalInertia

            if (options.useBoatSpeed) {
                horizontalInertia = this.boatLiquidInertia
                acceleration = this.boatLiquidAcceleration
            } else if (entity.isInWater) {
                let strider = Math.min(entity.depthStrider, 3)
                if (!entity.onGround) {
                    strider *= 0.5
                }
                if (strider > 0) {
                    horizontalInertia += (0.546 - horizontalInertia) * strider / 3
                    acceleration += (0.7 - acceleration) * strider / 3
                }

                if (entity.dolphinsGrace > 0) horizontalInertia = 0.96
            }

            this.applyHeading(entity, strafe, forward, acceleration)
            this.moveEntity(entity, vel.x, vel.y, vel.z)
            vel.y *= verticalInertia
            const liquidGravity = (entity.isInWater ? this.waterGravity : this.lavaGravity) * gravityMultiplier

            const floatSubmergedHeight = options.floatSubmergedHeight
            if (floatSubmergedHeight != null) {
                // Специальный режим плавучести.
                // Это не физически правильное моделирование плавучести. Цель - вернуть объект на уровень воды.
                const floatDrag = this.floatDrag
                const aboveEquilibrium = floatSubmergedHeight - entity.submergedHeight // насколько выше нужного уровня
                if (aboveEquilibrium > 0) {
                    // it's too high, it should fall down
                    const gravityPercent = entity.submergedHeight / floatSubmergedHeight
                    vel.y = Math.max(vel.y - liquidGravity * gravityPercent, -aboveEquilibrium)
                } else {
                    // it's too low, it should float up
                    vel.y = Math.min(floatDrag.maxUp, vel.y + floatDrag.up, -aboveEquilibrium)
                }
                // уменьшить скорость (усилить затузание колебаний) если возле поверзности воды
                const friction = Mth.lerp(entity.submergedHeight, floatDrag.friction, 0)
                vel.y *= (1 - friction)
            } else {
                vel.y -= liquidGravity
            }
            vel.x *= horizontalInertia
            vel.z *= horizontalInertia

            if (entity.isCollidedHorizontally && this.doesNotCollide(entity, pos.offset(vel.x, vel.y + 0.6 - pos.y + lastY, vel.z))) {
                vel.y = this.outOfLiquidImpulse // jump out of liquid
            }
        }
    }

    private isMaterialInBB(queryBB: AABB, type: int|int[]): boolean {
        const world = this.world
        const cursor = tmpVectorCursor
        for (cursor.y = Math.floor(queryBB.y_min); cursor.y <= Math.floor(queryBB.y_max); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.z_min); cursor.z <= Math.floor(queryBB.z_max); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.x_min); cursor.x <= Math.floor(queryBB.x_max); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && ((type as []).length ? (type as int[]).includes(block.id) : block.id === type)) {
                        return true
                    }
                }
            }
        }
        return false
    }

    /**
     * @returns the water level, from 0.0 to 1.0
     *  0 - no water
     *  1 - full of water
     */
    private getLiquidHeightPcent(block: FakeBlock): float {


        /* Old code:
        return (getRenderedDepth(block) + 1) / 9
        */


        const renderDepth = this.getRenderedDepth(block)
        return renderDepth < 0 ? 0 : (8 - renderDepth) / 8
    }

    private getFlow(block: FakeBlock, flow: Vector): void {
        flow.zero()
        const block_position = block.position
        const world = this.world
        const curlevel = this.getRenderedDepth(block)
        const tmpVec = this.tmpVector
        for (const [dx, dz] of DX_DZ_FOUR_DIRECTIONS) {
            const pos = tmpVec.copyFrom(block_position).translate(dx, 0, dz)
            const adjBlock = world.getBlock(pos)
            const adjLevel = this.getRenderedDepth(adjBlock)
            if (adjLevel < 0) { // if there is no water
                /*
                Old code, adjBlock.boundingBox doesn't exist:
                if (adjBlock && adjBlock.boundingBox !== 'empty') {
                */
                if (adjBlock) {
                    pos.y--
                    const adjLevel = this.getRenderedDepth(world.getBlock(pos))
                    if (adjLevel >= 0) {
                        const f = adjLevel - (curlevel - 8)
                        flow.x += dx * f
                        flow.z += dz * f
                    }
                }
            } else {
                const f = adjLevel - curlevel
                flow.x += dx * f
                flow.z += dz * f
            }
        }

        const fluidLevel = block.fluid & FLUID_LEVEL_MASK
        if (fluidLevel >= 8) {
            for (const [dx, dz] of DX_DZ_FOUR_DIRECTIONS) {
                const pos = tmpVec.copyFrom(block_position).translate(dx, 0, dz)
                const adjBlock = world.getBlock(pos)
                pos.y++
                const adjUpBlock = world.getBlock(pos)
                /*
                Old code, adjBlock.boundingBox doesn't exist; normalize() is immutable
                if ((adjBlock && adjBlock.boundingBox !== 'empty') || (adjUpBlock && adjUpBlock.boundingBox !== 'empty')) {
                    flow.normalize().translate(0, -6, 0)
                }
                */
                if (adjBlock || adjUpBlock) {
                    flow.normalizeSelf().translate(0, -6, 0)
                }
            }
        }

        flow.normalizeSelf()
    }

    /**
     * @return
     *  -1 block doesn't have water
     *  0 - block is full of water
     *  1 - 7/8 of block is filled with water
     *  ...
     *  7 - 1/8 of block is filled with water
     */
    private getRenderedDepth(block: FakeBlock): float {
        const fluid = block?.fluid
        if (!fluid) {
            return -1
        }
        const fluidLevel = fluid & FLUID_LEVEL_MASK
        return fluidLevel >= 8 ? 0 : fluidLevel
    }

    private getLiquidInBB(bb: AABB, waterBB?: AABB, lavaBB?: AABB): TLiquidInBB | null {
        const world = this.world
        let res: TLiquidInBB | null = null
        const cursor = tmpVectorCursor
        for (cursor.y = Math.floor(bb.y_min); cursor.y <= Math.floor(bb.y_max); cursor.y++) {
            for (cursor.z = Math.floor(bb.z_min); cursor.z <= Math.floor(bb.z_max); cursor.z++) {
                for (cursor.x = Math.floor(bb.x_min); cursor.x <= Math.floor(bb.x_max); cursor.x++) {
                    const block = world.getBlock(cursor)
                    /* Old code: waterlogged doesn't exist
                    if (block && block.material && (block.material.is_water || waterLike.has(block.id) || block.getProperties().waterlogged)) {
                        const waterLevel = cursor.y + 1 - getLiquidHeightPcent(block)
                    */
                    let level = this.getLiquidHeightPcent(block)
                    if (level) {
                        level += cursor.y
                        const isWater = (block.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID
                        let liquidBB = bb

                        // if specific (smaller) BBs are given for water and lava
                        if (waterBB) {
                            liquidBB = isWater ? waterBB : lavaBB
                            const blockBB = this.tmpBBgetLiquid.set(cursor.x, cursor.y, cursor.z,
                                cursor.x + 1, level, cursor.z + 1)
                            if (!liquidBB.intersect(blockBB)) {
                                continue
                            }
                        }

                        const submergedHeight = level - liquidBB.y_min
                        if (submergedHeight > 0) {
                            res ??= {
                                waterBlocks: [],
                                lavaBlocks: [],
                                submergedHeight: 0
                            }
                            const resBlocks = isWater ? res.waterBlocks : res.lavaBlocks
                            resBlocks.push(block)
                            res.submergedHeight = Math.max(res.submergedHeight, submergedHeight)
                        }
                    }
                }
            }
        }
        return res
    }

    private applyCurrent(liquidInBB: TLiquidInBB, vel: Vector): void  {
        const flow = this.tmpFlowVec
        const acceleration = this.tmpAccelerationVec.zero()
        for (const block of liquidInBB.waterBlocks) {
            this.getFlow(block, flow)
            acceleration.addSelf(flow)
        }
        for (const block of liquidInBB.lavaBlocks) {
            this.getFlow(block, flow)
            acceleration.addSelf(flow)
        }
        const len = acceleration.norm()
        if (len > 0) {
            const k = 0.014 / len
            vel.x += acceleration.x * k
            vel.y += acceleration.y * k
            vel.z += acceleration.z * k
        }
    }

    simulatePlayer(entity: PrismarinePlayerState): void {
        const options = entity.options
        const vel = entity.vel
        const pos = entity.pos
        const control = entity.control

        entity.isOnLadder = this.isOnLadder(pos);

        const playerBB = this.getPlayerBB(entity, pos, this.tmpPlayerBB)
        // the union of water and lava BBs
        const liquidBB = this.tmpLiquidBB.copyFrom(playerBB).contract(0.001, 0.4, 0.001)
        const waterBB = this.tmpWaterBB.copyFrom(playerBB).contract(0.001, 0.401, 0.001)
        const lavaBB = this.tmpLavaBB.copyFrom(playerBB).contract(0.1, 0.4, 0.1)

        const liquidInBB = this.getLiquidInBB(liquidBB, waterBB, lavaBB)
        if (liquidInBB) {
            this.applyCurrent(liquidInBB, vel)
            entity.isInWater = liquidInBB.waterBlocks.length != 0
            entity.isInLava = liquidInBB.lavaBlocks.length != 0
            entity.submergedHeight = liquidInBB.submergedHeight
        } else {
            entity.isInWater = entity.isInLava = false
        }

        if(entity.onGround) {
            entity.flying = false;
        }

        // Reset velocity component if it falls under the threshold
        if (Math.abs(vel.x) < this.negligeableVelocity) vel.x = 0
        if (Math.abs(vel.y) < this.negligeableVelocity) vel.y = 0
        if (Math.abs(vel.z) < this.negligeableVelocity) vel.z = 0

        // Handle inputs
        if (control.jump || entity.jumpQueued) {
            if (entity.jumpTicks > 0) entity.jumpTicks--
            if (entity.isInWater || entity.isInLava) {
                if (!control.sneak) {
                    // @fixed Без этого фикса игрок не может выбраться из воды на берег
                    vel.y += 0.09 // 0.04
                }
            } else if (entity.onGround && entity.jumpTicks === 0) {
                const jumpSpeed = options.jumpSpeed ?? this.jumpSpeed
                if (jumpSpeed) {
                    vel.y = Math.fround(jumpSpeed * this.scale)
                    if(this.honeyblockId != BLOCK_NOT_EXISTS) {
                        const blockBelow = this.world.getBlock(entity.pos.floored().offset(0, -0.5, 0))
                        vel.y *= ((blockBelow && blockBelow.id === this.honeyblockId) ? this.honeyblockJumpSpeed : 1);
                    }
                    const jumpBoost = getEffectLevel(Effect.JUMP_BOOST, entity.options.effects);
                    if (jumpBoost > 0) {
                        vel.y += 0.1 * jumpBoost
                    }
                    if (control.sprint) {
                        // @fixed Без этого фикса игрок притормаживает при беге с прыжками
                        const yaw = Math.PI - entity.yaw;
                        vel.x += Math.sin(yaw) * (0.2 * this.scale)
                        vel.z -= Math.cos(yaw) * (0.2 * this.scale)
                    }
                    entity.jumpTicks = this.autojumpCooldown
                }
            } else if(entity.flying) {
                if(!control.sneak) {
                    vel.y = this.flyingYSpeed;
                }
            }
        } else {
            entity.jumpTicks = 0 // reset autojump cooldown
        }
        entity.jumpQueued = false

        // Booleans are subtracted as numbers. It works in JS, but considered an error in TS
        let strafe = (control.left as any - (control.right as any)) * 0.98
        let forward = (control.back as any - (control.forward as any)) * 0.98

        // Если поворот стрелками, то вместо движения в бок выполнять поворот
        const driving = entity.driving
        if (driving?.useAngularSpeed) {
            const acceleration  = driving.angularAcceleration ?? this.angularAcceleration
            const inertia       = driving.angularInertia ?? this.angularInertia
            entity.angularVelocity = Mth.clampModule(
                (entity.angularVelocity ?? 0) * inertia - strafe * acceleration,
                driving.maxAngularSpeed ?? this.maxAngularSpeed
            )
            entity.angularVelocity = Mth.round(entity.angularVelocity, PHYSICS_ROTATION_DECIMALS)
            // полная остановка если скорость слишком маленькая
            if (!strafe && Math.abs(entity.angularVelocity) < this.minAngularSpeed) {
                entity.angularVelocity = 0
            }
            entity.yaw = Mth.radians_to_0_2PI_range(entity.yaw + entity.angularVelocity)
            entity.yaw = Mth.round(entity.yaw, PHYSICS_ROTATION_DECIMALS)
            strafe = 0
        } else {
            entity.angularVelocity = null
        }

        strafe *= options.baseSpeed
        forward *= options.baseSpeed

        if (control.sneak) {
            if(entity.flying) {
                if(!control.jump) {
                    vel.y = -this.flyingYSpeed;
                }
            } else if (entity.isInWater || entity.isInLava) {
                const sdd = this.swimDownDrag;
                if (!control.jump && vel.y > sdd.maxDown) {
                    vel.y = Math.max(vel.y - sdd.down, sdd.maxDown);
                }
            } else {
                strafe *= this.sneakSpeed
                forward *= this.sneakSpeed
            }
        }

        this.moveEntityWithHeading(entity, strafe, forward)

        entity.sneak = control.sneak && entity.onGround
    }
}

function getEnchantmentLevel(mcData, enchantmentName, enchantments) {
    const enchantmentDescriptor = mcData.enchantmentsByName[enchantmentName]
    if (!enchantmentDescriptor) {
        return 0
    }

    for (const enchInfo of enchantments) {
        if (typeof enchInfo.id === 'string') {
            if (enchInfo.id.includes(enchantmentName)) {
                return enchInfo.lvl
            }
        } else if (enchInfo.id === enchantmentDescriptor.id) {
            return enchInfo.lvl
        }
    }
    return 0
}

function getStatusEffectNamesForVersion(supportFeature) {
    if (supportFeature('effectNamesAreRegistryNames')) {
        return {
            jumpBoostEffectName: 'jump_boost',
            speedEffectName: 'speed',
            slownessEffectName: 'slowness',
            dolphinsGraceEffectName: 'dolphins_grace',
            slowFallingEffectName: 'slow_falling',
            levitationEffectName: 'levitation'
        }
    } else {
        return {
            jumpBoostEffectName: 'JumpBoost',
            speedEffectName: 'Speed',
            slownessEffectName: 'Slowness',
            dolphinsGraceEffectName: 'DolphinsGrace',
            slowFallingEffectName: 'SlowFalling',
            levitationEffectName: 'Levitation'
        }
    }
}

// возвращает уровень эффекта
function getEffectLevel(val: int, effects?: TPrismarineEffects): int {
    if (!effects?.effects) {
        return 0;
    }
    for (const effect of effects.effects) {
        if (effect.id == val) {
            return effect.level;
        }
    }
    return 0;
}

export type TPrismarinePlayerStatePOJO = Dict

export class PrismarinePlayerState implements IPlayerControlState {
    options     : TPrismarineOptions
    driving ?   : TDrivingConfig    // Если задано - то это общий физический объект, контролируемый водителем
    pos         : Vector
    vel         : Vector
    angularVelocity : float | null = null // Угловая скорость. Используется при езде если поворот стрелками.
    yaw         = 0
    flying      = false
    onGround    = false
    isInWater   = false
    isInLava    = false
    sneak       = false
    /** If isInWater or isInLava, it shows the height of the part of the bounding box that is below the surface */
    submergedHeight?: float
    isInWeb     = false
    isOnLadder  = false
    isCollidedHorizontally  = false
    isCollidedVertically    = false
    jumpTicks   = 0
    jumpQueued  = false
    control     : IPlayerControls
    dolphinsGrace: number;
    slowFalling: number;
    depthStrider: float;
    passable?: float

    constructor(pos: Vector, options: TPrismarineOptions, control: IPlayerControls, driving?: TDrivingConfig) {

        // Input / Outputs
        this.pos                    = pos.clone()
        this.vel                    = new Vector(0, 0, 0)

        // Input only (not modified)
        this.control                = control

        this.options = options
        addDefaultPhysicsOptions(options)

        this.driving = driving
        this.angularVelocity = driving?.useAngularSpeed ? 0 : null

        this.dolphinsGrace          = 0
        this.slowFalling            = 0
        /*
        // armour enchantments
        const boots = bot.inventory.slots[8]
        if (boots && boots.nbt) {
        const simplifiedNbt = nbt.simplify(boots.nbt)
        const enchantments = simplifiedNbt.Enchantments ?? simplifiedNbt.ench ?? []
        this.depthStrider = getEnchantmentLevel(mcData, 'depth_strider', enchantments)
        } else {
        this.depthStrider = 0
        }*/
        this.depthStrider = 0;
    }

    /**
     * Копирует некоторые динамически меняющиеся поля из другого состояния.
     * Не копирует: {@link yaw}, {@link pos} - их нужно обработать отдельно (потому что
     * в режиме вождения может требовться не просто копирование).
     */
    copyAdditionalDynamicFieldsFrom(other: PrismarinePlayerState): void {
        this.vel.copyFrom(other.vel)
        this.flying     = other.flying
        this.onGround   = other.onGround
        this.isInWater  = other.isInWater
        this.isInLava   = other.isInLava
    }

    copyControlsFrom(other: PrismarinePlayerState): void {
        Object.assign(this.control, other.control)
    }

    // TODO уточнить семантику - что именно экспортируется
    exportPOJO(): TPrismarinePlayerStatePOJO {
        const data: TPrismarinePlayerStatePOJO = {
            pos: this.pos.clone(),
            vel: this.vel.clone(),
            yaw: this.yaw,
            flying: this.flying,
            sneak: this.sneak
        }
        if (this.angularVelocity != null) {
            data.angularVelocity = this.angularVelocity
        }
        return data
    }

    importPOJO(data: TPrismarinePlayerStatePOJO): void {
        this.pos.copyFrom(data.pos)
        this.vel.copyFrom(data.vel)
        this.yaw = data.yaw
        this.flying = data.flying ?? false
        this.sneak = data.sneak ?? false
        this.angularVelocity = data.angularVelocity ?? null
    }
}