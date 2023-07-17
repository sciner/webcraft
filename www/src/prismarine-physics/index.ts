import {Mth, Vector} from "../helpers.js";
import { Effect } from "../block_type/effect.js";
import { AABB } from "./lib/aabb.js";
import type {TPrismarineOptions} from "./using.js";
import {addDefaultPhysicsOptions, PhysicsBlockAccessor, PhysicsBlock, LiquidBlock} from "./using.js";
import {PHYSICS_ROTATION_DECIMALS, PLAYER_ZOOM} from "../constant.js";
import type {IPlayerControls, IPlayerControlState} from "../control/player_control.js";
import type {Effects} from "../player.js";
import {FLUID_LEVEL_MASK, FLUID_TYPE_MASK, FLUID_WATER_ID} from "../fluid/FluidConst.js";
import type {World} from "../world.js";
import type {TDrivingConfig} from "../control/driving.js";
import type {TBlock} from "../typed_blocks3.js";

const BLOCK_NOT_EXISTS = -2;
const DX_DZ_FOUR_DIRECTIONS = [[0, 1], [-1, 0], [0, -1], [1, 0]]

type TPrismarineEffects = {
    effects?: Effects[]
}

type TLiquidInBB = {
    waterBlocks: LiquidBlock[]
    lavaBlocks: LiquidBlock[]
    submergedHeight: float
}

export class Physics {

    private readonly block_manager      : typeof BLOCK

    // ================== options from old Physics function ===================

    private readonly blockSlipperiness  : (float | undefined)[] = []
    // Block ids
    private readonly slimeBlockId       : int | null
    private readonly soulsandId         : int
    private readonly honeyblockId       : int // 1.15+
    private readonly cobwebLikePassable : (float | undefined)[] = [] // for cobweb-like it's passable value
    private readonly ladderIds          : int[]
    private readonly ladderLikeIds      : int[]
    private readonly bubbleColumnId     : int
    private readonly iceIds             : int[]
    private tinaLikePassable            : float
    private tinaId                      : int


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
    private readonly honeyblockJumpSpeed= 0.4
    private readonly ladderMaxSpeed     = 0.15
    private readonly ladderLikeSpeedMul = 0.65
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

    private repeated        : boolean   // true если симуляция повторная (на клиенте)
    private blockAccessor   : PhysicsBlockAccessor
    private tmpPlayerBB     = new AABB()
    private tmpWaterBB      = new AABB()
    private tmpLavaBB       = new AABB()
    private tmpLiquidBB     = new AABB()
    private tmpBB           = new AABB()
    private tmpBBgetLiquid  = new AABB()
    private tmpFlowVec      = new Vector()
    private tmpAccelerationVec = new Vector()
    private tmpDesiredSpeed = new Vector()
    private tmpTriedSpeed   = new Vector()
    private tmpFakeBlock    : PhysicsBlock
    private tmpFakeBlock2   : PhysicsBlock
    private tmpSurroundingBBs   : AABB[] = []

    constructor(world: World) {
        this.block_manager  = world.block_manager
        const bm            = this.block_manager
        this.blockAccessor  = new PhysicsBlockAccessor(world)
        this.tmpFakeBlock   = new PhysicsBlock(bm)
        this.tmpFakeBlock2  = new PhysicsBlock(bm)

        // ================== options from old Physics function ===================

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
        if (bm.GREEN_ALGAE) { 
            this.tinaLikePassable = bm.GREEN_ALGAE.passable
        }

        // Block ids
        this.tinaId         = bm.GREEN_ALGAE.id
        this.soulsandId     = bm.SOUL_SAND.id
        this.honeyblockId   = bm.HONEY_BLOCK?.id ?? BLOCK_NOT_EXISTS // 1.15+
        for (const block of [bm.COBWEB, bm.SWEET_BERRY_BUSH]) {
            this.cobwebLikePassable[block.id] = block.passable
        }
        this.ladderIds      = [bm.LADDER, bm.ROPE_LADDER].map(mat => mat.id)
        this.ladderLikeIds  = [bm.VINE].map(mat => mat.id)
        this.bubbleColumnId = bm.BUBBLE_COLUMN?.id ?? BLOCK_NOT_EXISTS // 1.13+
        this.iceIds         = [bm.ICE, ...bm.bySuffix['_ICE']].map(mat => mat.id)

        // =================== options from old physics object ====================

        // код для случая supportFeature('proportionalLiquidGravity')
        this.waterGravity   = this.gravity / 16
        this.lavaGravity    = this.gravity / 4
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

    /**
     * Возвращает AABB _возможных_ препятствий.
     * Не анализирует форму блоков (реальный размер блоков может быть меньше и они не пересекаются).
     * Результат действительне до повторного вызова - повторно использует один и тот же массив.
     * @param extendDown - дополнительное число проверяемых блоков под {@link queryBB}
     */
    private getSurroundingBBs(queryBB: AABB, extendDown: int = 1, findFirst?: boolean): AABB[] {
        const surroundingBBs = this.tmpSurroundingBBs
        surroundingBBs.length = 0
        let acc = this.blockAccessor
        for (let y = Math.floor(queryBB.y_min) - extendDown; y <= Math.floor(queryBB.y_max); y++) { // если findFirst == true, начинать с y  быстрее
            acc.y = y
            for (let z = Math.floor(queryBB.z_min); z <= Math.floor(queryBB.z_max); z++) {
                acc.z = z
                for (let x = Math.floor(queryBB.x_min); x <= Math.floor(queryBB.x_max); x++) {
                    acc.x = x
                    acc.getObstacleAABBs(surroundingBBs)
                    if (findFirst && surroundingBBs.length) {
                        return surroundingBBs
                    }
                }
            }
        }
        return surroundingBBs
    }

    private moveEntity(entity: PrismarinePlayerState, dx: float, dy: float, dz: float): void {

        function canStep(dx: int, dz: int): boolean {
            tmpBB.copyFrom(playerBB).translate(dx, 0, dz)
            // настроить AABB чтобы он пересекал только слой высотой 0.4 непосредственно под ногами: 1) быстрее
            // 2) нельзя спрыгнуть с полублоков, но можно спрыгуть с блоков неполной высоты.
            tmpBB.y_max = tmpBB.y_min - 0.001
            tmpBB.y_min -= 0.4
            if (entity.control.sneak) {
                // не разрешать спускаться даже с полублоков
                return that.getSurroundingBBs(tmpBB, 0, false).some(aabb => aabb.intersect(tmpBB))
            }
            // это повтор выполнения. Главное - не упасть в пропасть. Можно падать максимум на 1.5 блока вниз. Быстрая, грубая проверка.
            return that.getSurroundingBBs(tmpBB, 1, true).length !== 0
        }

        const that = this
        const {options, vel, pos} = entity
        let playerBB = this.getPlayerBB(entity, pos, this.tmpPlayerBB)
        const tmpBB = this.tmpBB
        const acc = this.blockAccessor

        if (entity.isInWeb) {
            dx *= entity.passable; // 0.25
            dy *= entity.passable / 5; // 0.05
            dz *= entity.passable; // 0.25
            vel.zero()
            entity.isInWeb = false
        } else if (entity.isInTina) {
            dx *= entity.passable;
            dy *= entity.passable;
            dz *= entity.passable;
            vel.zero()
            entity.isInTina = false
        }

        // не допустить падения с блока
        // Очень медленно (куча лишних вычислений AABB), но редко выполняется - можно не оптимизировать.
        if (entity.onGround && (entity.control.sneak || this.repeated)) {
            const step = 0.05

            // In the 3 loops bellow, y offset should be -1, but that doesnt reproduce vanilla behavior.
            while (dx !== 0 && !canStep(dx, 0)) {
                if (dx < step && dx >= -step) dx = 0
                else if (dx > 0) dx -= step
                    else dx += step
            }

            while (dz !== 0 && !canStep(0, dz)) {
                if (dz < step && dz >= -step) dz = 0
                else if (dz > 0) dz -= step
                    else dz += step
            }

            while (dx !== 0 && dz !== 0 && !canStep(dx, dz)) {
                if (dx < step && dx >= -step) dx = 0
                else if (dx > 0) dx -= step
                    else dx += step

                if (dz < step && dz >= -step) dz = 0
                else if (dz > 0) dz -= step
                else dz += step
            }
        }

        const oldVelX = dx
        const oldVelY = dy
        const oldVelZ = dz

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
            (dx !== oldVelX || dz !== oldVelZ) &&
            !entity.control.sneak
        ) {
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

        const blockAtFeet = acc.setOffsetFloor(pos, 0, -0.2, 0).getBlock()

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
        for (let y = Math.floor(playerBB.y_min); y <= Math.floor(playerBB.y_max); y++) {
            acc.y = y
            for (let z = Math.floor(playerBB.z_min); z <= Math.floor(playerBB.z_max); z++) {
                acc.z = z
                for (let x = Math.floor(playerBB.x_min); x <= Math.floor(playerBB.x_max); x++) {
                    acc.x = x
                    const block = acc.getBlock()
                    if (block && block.id > 0) {
                        const cobwebLikePassable = this.cobwebLikePassable[block.id]
                        if (block.id == this.tinaId && (y + .0625) > playerBB.y_min) {
                            // блок тины
                            entity.isInTina = true
                            entity.passable = this.tinaLikePassable
                        } else if (cobwebLikePassable != null) {
                            entity.isInWeb = true
                            entity.passable = cobwebLikePassable
                        } else if (block.id === this.bubbleColumnId) {
                            // TODO: fast fix
                            const down = false; // !block.metadata
                            acc.y = y + 1
                            const bubbleDrag = acc.block.id === 0 ? this.bubbleColumnSurfaceDrag : this.bubbleColumnDrag
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
        // код для случая supportFeature('velocityBlocksOnTop')
        const blockBelow = acc.setOffsetFloor(entity.pos, 0, -0.5, 0).getBlock()
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

    /**
     * Добавляет к X и Z скорости в желаемом направлении.
     * @param strafe - см. forward
     * @param forward Поведение: при длине вектора (strafe, forward) <= 1, ускорение пропорционально и длине
     *   этого вектора, и {@param multiplier}. При дальнейшкм росте длины этого вектора, ускорение уже не растет.
     */
    private applyHeading(vel: Vector, yaw: float, strafe: float, forward: float, multiplier: float): void {
        const lengthSqr = strafe * strafe + forward * forward
        if (lengthSqr < 0.01 * 0.01) return
        const length = Math.sqrt(lengthSqr)

        const norm = this.scale * multiplier / Math.max(length, 1)

        strafe *= norm
        forward *= norm

        yaw = Math.PI - yaw
        const sin = Math.sin(yaw)
        const cos = Math.cos(yaw)

        vel.x += strafe * cos - forward * sin
        vel.z += forward * cos + strafe * sin
    }

    private isOnLadder(pos: Vector): float {
        const acc = this.blockAccessor
        const offset_value_y = .07
        const block = acc.setOffsetFloor(pos, 0, offset_value_y, 0).block
        const id = block.id
        if (id > 0) {
            const l1 = this.ladderIds
            const l2 = this.ladderLikeIds
                if (l1.includes(id)) {
                return 1
            } else if (l2.includes(id)) {
                return this.ladderLikeSpeedMul
            }
            // if block is opened trapdoor
            if(block.material.tags.includes('trapdoor') && block.extra_data?.opened) {
                // check under block
                acc.y--
                if (l1.includes(acc.block.id)) {
                    return 1
                } else if (l2.includes(acc.block.id)) {
                    return this.ladderLikeSpeedMul
                }
            }
        }
        return 0
    }

    private moveEntityWithHeading(entity: PrismarinePlayerState, strafe: number, forward: number): void {
        const acc = this.blockAccessor
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
                const blockUnderId = acc.setOffsetFloor(pos, 0, -1, 0).block.id
                if (blockUnderId) {
                    inertia = (this.blockSlipperiness[blockUnderId] || options.defaultSlipperiness) * 0.91
                    if (options.useBoatSpeed && this.iceIds.includes(blockUnderId)) {
                        acceleration = blockUnderId === this.block_manager.BLUE_ICE?.id
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

            this.applyHeading(entity.vel, entity.yaw, strafe, forward, acceleration)

            if (entity.isOnLadder != 0) {
                const ladder_speed = this.ladderMaxSpeed * entity.isOnLadder
                vel.x = Mth.clampModule(vel.x, ladder_speed)
                vel.z = Mth.clampModule(vel.z, ladder_speed)
                vel.y = Math.max(vel.y, entity.control.sneak ? 0 : -ladder_speed)
            }

            this.moveEntity(entity, vel.x, vel.y, vel.z)

            // считаем включенным supportFeature('climbUsingJump') - учитываем entity.control.jump
            if ((entity.isOnLadder != 0) && (entity.isCollidedHorizontally || entity.control.jump)) {
                vel.y = this.ladderClimbSpeed * entity.isOnLadder // climb ladder
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
                // Сделать скорость при беге (быстром плавании) чуть больше. Это не как в майне - просто чтобы был хоть какой-то эффект
                if (entity.control.sprint) {
                    acceleration *= this.sprintSpeed
                }

                if (entity.dolphinsGrace > 0) horizontalInertia = 0.96
            }

            // изменить скорость в воде - до движения, иначе из-за negligeableVelocity она потом может обнулиться
            const liquidGravity = (entity.isInWater ? this.waterGravity : this.lavaGravity) * gravityMultiplier
            const floatSubmergedHeight = options.floatSubmergedHeight
            if (floatSubmergedHeight != null) {
                // Специальный режим плавучести.
                // Это не физически правильное моделирование плавучести. Цель - вернуть объект на уровень воды.
                const floatDrag = this.floatDrag
                const aboveEquilibrium = floatSubmergedHeight - entity.submergedHeight // насколько выше нужного уровня
                if (aboveEquilibrium > 0) {
                    // it's too high, it should fall down
                    const gravityPercent = 1 - entity.submergedHeight / floatSubmergedHeight
                    vel.y = Math.max(vel.y - this.gravity * gravityPercent, -aboveEquilibrium)
                } else {
                    // it's too low, it should float up
                    if (vel.y !== this.outOfLiquidImpulse) { // сохранить импульс выпрыгивания из воды, чтобы могли выбраться
                        vel.y = Math.min(floatDrag.maxUp, vel.y + floatDrag.up, -aboveEquilibrium)
                    }
                }
                // уменьшить скорость (усилить затузание колебаний) если возле поверхности воды
                const friction = Mth.lerp(entity.submergedHeight, floatDrag.friction, 0)
                vel.y *= (1 - friction)
            } else {
                vel.y -= liquidGravity
            }

            const desiredSpeed = this.tmpDesiredSpeed.zero()    // скорость которую хочет сам игрок (без учета течения)
            this.applyHeading(desiredSpeed, entity.yaw, strafe, forward, acceleration)
            vel.addSelf(desiredSpeed)
            const triedSpeed = this.tmpTriedSpeed.copyFrom(vel) // скорость до уменьшения в результате коллизий
            this.moveEntity(entity, vel.x, vel.y, vel.z)
            vel.y *= verticalInertia
            vel.x *= horizontalInertia
            vel.z *= horizontalInertia

            // если уперся в препятствие, и сам хочет двигаться примерно в том же направлении
            if (entity.isCollidedHorizontally &&
                (desiredSpeed.x || desiredSpeed.z) && (triedSpeed.x || triedSpeed.z) &&
                Math.abs(Mth.radians_to_minus_PI_PI_range(triedSpeed.getYaw() - desiredSpeed.getYaw())) < Mth.PI_DIV2
            ) {
                // код бывший в функции doesNotCollide(). Перенесен сюда чтобы было ясно видно где вызвается getSurroundingBBs()
                const liquidImpulseTestY = vel.y + 0.6 - pos.y + lastY + (options.floatSubmergedHeight ?? 0)
                const posBB = pos.offset(vel.x, liquidImpulseTestY, vel.z)
                const pBB = this.getPlayerBB(entity, posBB, this.tmpPlayerBB)
                const desNotCollide = !this.getSurroundingBBs(pBB).some(x => pBB.intersect(x))
                    && this.getLiquidInBB(pBB, null, null, true) == null

                if (desNotCollide) {
                    vel.y = this.outOfLiquidImpulse // jump out of liquid
                }
            }
        }
    }

    /**
     * @returns the water level, from 0.0 to 1.0
     *  0 - no water
     *  1 - full of water
     */
    private getLiquidHeightPcent(block: LiquidBlock): float {

        /* Old code:
        return (getRenderedDepth(block) + 1) / 9
        */

        const renderDepth = this.getRenderedDepth(block)
        return renderDepth < 0 ? 0 : (8 - renderDepth) / 8
    }

    private getFlow(block: LiquidBlock, flow: Vector): void {

        function isSolidForFluid(block: IBlockMaterial): boolean {
            return block.is_solid || block.is_solid_for_fluid
        }

        const acc = this.blockAccessor
        let emptyNeighbours = 0
        flow.zero()
        const block_position = block.position
        const curDepth = this.getRenderedDepth(block)
        for (const [dx, dz] of DX_DZ_FOUR_DIRECTIONS) {
            const adjBlock = acc.setOffsetFloor(block_position, dx, 0, dz).getBlock(this.tmpFakeBlock)
            let neighbourDepth = this.getRenderedDepth(acc.block) // модифицированная глубина воды в двух соседних блоках, если туда может протечь
            if (neighbourDepth < 0) { // если нет воды в соседнем блоке
                const adjIsSolid = adjBlock && isSolidForFluid(adjBlock.material)
                if (!adjIsSolid) {
                    emptyNeighbours++
                }
                acc.y-- // смотрим на блок под соседним
                const adjDownBlock = acc.block
                if (isSolidForFluid(adjDownBlock.material)) { // если в блок под соседним не может протечь вода
                    if (adjIsSolid) {
                        continue // и в соседний тоже не может протечь - никуда не течет
                    }
                    // Верх блока под соседним - "дно", в соседний может протечь вода.
                    // Считаем как будто там есть воды немножко.
                    neighbourDepth = 7
                } else { // в блок под соседним может протечь вода
                    let adjDownDepth = this.getRenderedDepth(adjDownBlock)
                    if (adjDownDepth < 0) {
                        adjDownDepth = 7 // воды нет, но мы уже проверили что может протечь - будем считать что немного есть
                    } else if (adjDownDepth === 0 && adjIsSolid) {
                        // Блок под соседним полон, и в соседний не может протечь.
                        // Это типичная ситуация возле некоторых берегов, например, ледника.
                        continue
                    }
                    neighbourDepth = adjDownDepth + 8
                }
            }
            const f = neighbourDepth - curDepth
            flow.x += dx * f
            flow.z += dz * f
        }

        if ((block.fluid & FLUID_LEVEL_MASK) >= 8) { // если вода в текущем блоке "стекла сверху"
            // если мы находимся на краю отвесной стены воды - добавить поток вниз. Чем больше пустых соседей, тем сильней.
            flow.y -= emptyNeighbours * 6
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
    private getRenderedDepth(block: LiquidBlock | TBlock | null): float {
        const fluid = block?.fluid
        if (!fluid) {
            return -1
        }
        const fluidLevel = fluid & FLUID_LEVEL_MASK
        return fluidLevel >= 8 ? 0 : fluidLevel
    }

    private getLiquidInBB(bb: AABB, waterBB?: AABB | null, lavaBB?: AABB | null, findFirst?: boolean): TLiquidInBB | null {
        let res: TLiquidInBB | null = null
        const acc = this.blockAccessor
        for (let y = Math.floor(bb.y_min); y <= Math.floor(bb.y_max); y++) { // если findFirst == true, начинать с y  быстрее
            acc.y = y
            for (let z = Math.floor(bb.z_min); z <= Math.floor(bb.z_max); z++) {
                acc.z = z
                for (let x = Math.floor(bb.x_min); x <= Math.floor(bb.x_max); x++) {
                    acc.x = x
                    const block = acc.getLiquidBlock()
                    if (!block) {
                        continue
                    }
                    let level = this.getLiquidHeightPcent(block)
                    if (level) {
                        level += y
                        const isWater = (block.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID
                        let liquidBB = bb

                        // if specific (smaller) BBs are given for water and lava
                        if (waterBB) {
                            liquidBB = isWater ? waterBB : lavaBB
                            const blockBB = this.tmpBBgetLiquid.set(x, y, z, x + 1, level, z + 1)
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
                            if (findFirst) {
                                return res
                            }
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

    /**
     * @return координаты блоков, на которых реально стоит игрок (с учетом формы блоков).
     * Нельзя вызывать из {@link simulatePlayer} (т.к. очищает пулы). Этот метод - только для внешнего АПИ).
     */
    getUnderLegs(entity: PrismarinePlayerState): Vector[] {
        const result: Vector[] = []
        this.blockAccessor.reset(entity.pos)
        const queryBB = this.getPlayerBB(entity, entity.pos, this.tmpPlayerBB)
        queryBB.y_max = queryBB.y_min -= 0.001 // получить только блоки, пересекающие узкий слой под ногами
        const surroundingBBs = this.getSurroundingBBs(queryBB, 0)
        for(const aabb of surroundingBBs) {
            if (aabb.intersect(queryBB)) {
                const pos = aabb.center.floored()
                // если передыдущий AABB не относился к тому же блоку
                if (result.length === 0 || !result[result.length - 1].equal(pos)) {
                    result.push(pos)
                }
            }
        }
        return result
    }

    /**
     * @param repeated - true если это повтор симляции.
     */
    simulatePlayer(entity: PrismarinePlayerState, repeated = false): void {
        const {vel, pos, control, options} = entity
        const acc = this.blockAccessor.reset(pos)

        this.repeated = repeated

        entity.isOnLadder = this.isOnLadder(pos);

        const playerBB = this.getPlayerBB(entity, pos, this.tmpPlayerBB)
        // Старый режим призмарина: сжимать по Y на 0.4 для жидкости и лавы, на 0.401 для воды (наверное как в майне для игроков)
        // Новый режим: для плавучих не сжимаем, для остальных сжимаем менее чем на половину размера (см.код в contract).
        const contractLiquidY = options.floatSubmergedHeight != null ? 0 : 0.4
        const liquidBB = this.tmpLiquidBB.copyFrom(playerBB).contract(0.001, contractLiquidY, 0.001) // the union of water and lava BBs
        const waterBB = this.tmpWaterBB.copyFrom(playerBB).contract(0.001, contractLiquidY + 0.01, 0.001)
        const lavaBB = this.tmpLavaBB.copyFrom(playerBB).contract(0.1, contractLiquidY, 0.1)

        const liquidInBB = this.getLiquidInBB(liquidBB, waterBB, lavaBB)
        if (liquidInBB) {
            this.applyCurrent(liquidInBB, vel)
            entity.isInWater = liquidInBB.waterBlocks.length != 0
            entity.isInLava = liquidInBB.lavaBlocks.length != 0
            entity.submergedHeight = liquidInBB.submergedHeight
            // Из-за манипуляций с AABB, значение submergedHeight неточное. waterBB имеет наименьщею высоту.
            entity._submergedPercent = Math.min(1, liquidInBB.submergedHeight / waterBB.height)
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
            if (entity.isInTina) {
                if (!control.sneak && options.floatSubmergedHeight == null) {
                    // @fixed Без этого фикса игрок не может выбраться из тины на берег
                    vel.y += 0.05 // 0.07
                }
            } else if (entity.isInWater || entity.isInLava) {
                if (!control.sneak && options.floatSubmergedHeight == null) {
                    // @fixed Без этого фикса игрок не может выбраться из воды на берег
                    vel.y += 0.09 // 0.04
                }
            } else if (entity.onGround && entity.jumpTicks === 0) {
                const jumpSpeed = options.jumpSpeed ?? this.jumpSpeed
                if (jumpSpeed) {
                    vel.y = Math.fround(jumpSpeed * this.scale)
                    if(this.honeyblockId != BLOCK_NOT_EXISTS) {
                        const blockBelow = acc.setOffsetFloor(entity.pos, 0, -0.5, 0).getBlock()
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
                if (!control.jump && vel.y > sdd.maxDown && options.floatSubmergedHeight == null) {
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
    vel         : Vector = new Vector(0, 0, 0)
    angularVelocity : float | null = null // Угловая скорость. Используется при езде если поворот стрелками.
    yaw         = 0
    flying      = false
    onGround    = false
    isInWater   = false
    isInLava    = false
    sneak       = false
    /** If isInWater or isInLava, it shows the height of the part of the bounding box that is below the surface */
    submergedHeight?: float
    /**
     * Часть от целого, погруженная в жидкость (важно: не от полной высоты объекта, а от фиктивного "сжатого" AABB)
     * Если не в жидкости - не определено. В АПИ использовать {@link submergedPercent}
     */
    _submergedPercent?: float
    isInWeb     = false
    isInTina    = false
    isOnLadder  = 0
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

    get isInLiquid(): boolean { return this.isInWater || this.isInLava }

    get submergedPercent(): float {
        return this.isInWater || this.isInLava ? this._submergedPercent : 0
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