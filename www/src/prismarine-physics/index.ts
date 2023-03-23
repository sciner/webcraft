import { Vec3, Vector } from "../helpers.js";
import { Effect } from "../block_type/effect.js";
import { AABB } from "./lib/aabb.js";
import {Resources} from "../resources.js";
import {DEFAULT_SLIPPERINESS} from "./using.js";
import { PLAYER_HEIGHT, PLAYER_ZOOM } from "../constant.js";
import { TBlock } from "../typed_blocks3.js";
import type {IPlayerControlState} from "../control/player_control.js";

const BLOCK_NOT_EXISTS = -2;
const _ladder_check_tblock = new TBlock()

function makeSupportFeature(mcData, features) {
    return feature => features.some(({ name, versions }) => name === feature && versions.includes(mcData.version.majorVersion))
}

class math {
    static clamp(min, x, max) {
        return Math.max(min, Math.min(x, max))
    }
}

export function Physics(mcData, fake_world, options) {

    const supportFeature = makeSupportFeature(mcData, Resources.physics.features);

    const blocksByName = mcData.blocksByName

    // Block Slipperiness
    // https://www.mcpk.wiki/w/index.php?title=Slipperiness
    const blockSlipperiness = {}
    const slimeBlockId = 99999; // blocksByName.slime_block ? blocksByName.slime_block.id : blocksByName.slime.id
    blockSlipperiness[slimeBlockId] = 0.8
    blockSlipperiness[blocksByName.ice.id] = 0.98
    blockSlipperiness[blocksByName.packed_ice.id] = 0.98
    if (blocksByName.frosted_ice) { // 1.9+
        blockSlipperiness[blocksByName.frosted_ice.id] = 0.98
    }
    if (blocksByName.blue_ice) { // 1.13+
        blockSlipperiness[blocksByName.blue_ice.id] = 0.989
    }

    // Block ids
    const soulsandId    = blocksByName.soul_sand.id
    const honeyblockId  = blocksByName.honey_block ? blocksByName.honey_block.id : BLOCK_NOT_EXISTS // 1.15+
    const cobwebLike    = new Map();
    for(let block of blocksByName.cobweb) {
        cobwebLike.set(block.id, block.passable);
    }
    // const waterId       = blocksByName.water.id
    const lavaId        = blocksByName.lava
    const ladderId      = blocksByName.ladder.id
    const vineId        = blocksByName.vine.id
    const waterLike     = new Set()
    if (blocksByName.seagrass) waterLike.add(blocksByName.seagrass.id) // 1.13+
    if (blocksByName.tall_seagrass) waterLike.add(blocksByName.tall_seagrass.id) // 1.13+
    if (blocksByName.kelp) waterLike.add(blocksByName.kelp.id) // 1.13+
    const bubblecolumnId = blocksByName.bubble_column ? blocksByName.bubble_column.id : BLOCK_NOT_EXISTS // 1.13+
    if (blocksByName.bubble_column) waterLike.add(bubblecolumnId)

    const scale = PLAYER_ZOOM;

    const physics = {
        scale: scale,
        gravity: 0.08 * scale, // blocks/tick^2 https://minecraft.gamepedia.com/Entity#Motion_of_entities
        // Flying
        flyinGravity: 0.06,
        flyingYSpeed: Math.fround(0.42 / 2) * scale,
        flyingInertiaMultiplyer: 1.5,
        //
        airdrag: Math.fround(1 - 0.02), // actually (1 - drag)
        yawSpeed: 3.0,
        pitchSpeed: 3.0,
        sprintSpeed: 1.3,
        sneakSpeed: 0.3,
        swimDownDrag: {
            down: 0.05,
            maxDown: -0.5
        },
        stepHeight: typeof options.stepHeight === 'undefined' ? 0.65 : options.stepHeight, // how much height can the bot step on without jump
        negligeableVelocity: 0.003, // actually 0.005 for 1.8, but seems fine
        soulsandSpeed: 0.4,
        honeyblockSpeed: 0.4,
        honeyblockJumpSpeed: 0.4,
        ladderMaxSpeed: 0.15,
        ladderClimbSpeed: 0.2 * scale,
        playerHalfWidth: typeof options.playerHalfWidth === 'undefined' ? 0.3 : options.playerHalfWidth,
        playerHeight: typeof options.playerHeight === 'undefined' ? PLAYER_HEIGHT : options.playerHeight,
        waterInertia: 0.8,
        lavaInertia: 0.5,
        liquidAcceleration: 0.02,
        airborneInertia: 0.91,
        airborneAcceleration: 0.02,
        defaultSlipperiness: typeof options.defaultSlipperiness === 'undefined' ? DEFAULT_SLIPPERINESS : options.defaultSlipperiness,
        outOfLiquidImpulse: 0.3,
        autojumpCooldown: 10, // ticks (0.5s)
        bubbleColumnSurfaceDrag: {
            down: 0.03,
            maxDown: -0.9,
            up: 0.1,
            maxUp: 1.8
        },
        bubbleColumnDrag: {
            down: 0.03,
            maxDown: -0.3,
            up: 0.06,
            maxUp: 0.7
        },
        slowFalling: 0.125,
        speedEffect: 1.2,
        slowEffect: 0.85,
        waterGravity: 0,
        lavaGravity: 0
    }

    if (supportFeature('independentLiquidGravity')) {
        physics.waterGravity = 0.02
        physics.lavaGravity = 0.02
    } else if (supportFeature('proportionalLiquidGravity')) {
        physics.waterGravity = physics.gravity / 16
        physics.lavaGravity = physics.gravity / 4
    }

    function getPlayerBB (pos) {
        const w = physics.playerHalfWidth * physics.scale
        return new AABB(-w, 0, -w, w, physics.playerHeight, w).offset(pos.x, pos.y, pos.z)
    }

    function setPositionToBB(bb, pos) {
        pos.x = bb.minX + physics.playerHalfWidth * physics.scale
        pos.y = bb.minY
        pos.z = bb.minZ + physics.playerHalfWidth * physics.scale
    }

    function getSurroundingBBs(world, queryBB) {
        const surroundingBBs = []
        const cursor = new Vec3(0, 0, 0)
        for (cursor.y = Math.floor(queryBB.minY) - 1; cursor.y <= Math.floor(queryBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && block.id > 0) {
                        const blockPos = block.position
                        for (const shape of block.shapes) {
                            const blockBB = new AABB(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5])
                            blockBB.offset(blockPos.x, blockPos.y, blockPos.z)
                            surroundingBBs.push(blockBB)
                        }
                    }
                }
            }
        }
        return surroundingBBs
    }

    // (physics as any).adjustPositionHeight = (pos) => {
    //     const playerBB = getPlayerBB(pos)
    //     const queryBB = playerBB.clone().extend(0, -1, 0)
    //     const surroundingBBs = getSurroundingBBs(world, queryBB)

    //     let dy = -1
    //     for (const blockBB of surroundingBBs) {
    //         dy = blockBB.computeOffsetY(playerBB, dy)
    //     }
    //     pos.y += dy
    // }

    function moveEntity(entity, world, dx, dy, dz) {
        const vel = entity.vel
        const pos = entity.pos

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
            for (; dx !== 0 && getSurroundingBBs(world, getPlayerBB(pos).offset(dx, 0, 0)).length === 0; oldVelX = dx) {
                if (dx < step && dx >= -step) dx = 0
                else if (dx > 0) dx -= step
                    else dx += step
            }

            for (; dz !== 0 && getSurroundingBBs(world, getPlayerBB(pos).offset(0, 0, dz)).length === 0; oldVelZ = dz) {
                if (dz < step && dz >= -step) dz = 0
                else if (dz > 0) dz -= step
                    else dz += step
            }

            while (dx !== 0 && dz !== 0 && getSurroundingBBs(world, getPlayerBB(pos).offset(dx, 0, dz)).length === 0) {
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

        let playerBB = getPlayerBB(pos)
        const queryBB = playerBB.clone().extend(dx, dy, dz)
        const surroundingBBs = getSurroundingBBs(world, queryBB)
        const oldBB = playerBB.clone()

        for (const blockBB of surroundingBBs) {
            dy = blockBB.computeOffsetY(playerBB, dy)
        }
        playerBB.offset(0, dy, 0)

        for (const blockBB of surroundingBBs) {
            dx = blockBB.computeOffsetX(playerBB, dx)
        }
        playerBB.offset(dx, 0, 0)

        for (const blockBB of surroundingBBs) {
            dz = blockBB.computeOffsetZ(playerBB, dz)
        }
        playerBB.offset(0, 0, dz)

        // Step on block if height < stepHeight
        if (physics.stepHeight * physics.scale > 0 &&
            (entity.onGround || (dy !== oldVelY && oldVelY < 0)) &&
            (dx !== oldVelX || dz !== oldVelZ)) {
            const oldVelXCol = dx
            const oldVelYCol = dy
            const oldVelZCol = dz
            const oldBBCol = playerBB.clone()

            dy = physics.stepHeight * physics.scale
            const queryBB = oldBB.clone().extend(oldVelX, dy, oldVelZ)
            const surroundingBBs = getSurroundingBBs(world, queryBB)

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
            BB1.copyFrom(oldBB).offset(0, dy1, 0)
            BB2.offset(0, dy2, 0)
            BB3.copyFrom(oldBB).offset(0, dy3, 0)

            let dx1 = oldVelX
            let dx2 = oldVelX
            let dx3 = oldVelX
            for (const blockBB of surroundingBBs) {
                dx1 = blockBB.computeOffsetX(BB1, dx1)
                dx2 = blockBB.computeOffsetX(BB2, dx2)
                dx3 = blockBB.computeOffsetX(BB3, dx3)
            }
            BB1.offset(dx1, 0, 0)
            BB2.offset(dx2, 0, 0)
            BB3.offset(dx3, 0, 0)

            let dz1 = oldVelZ
            let dz2 = oldVelZ
            let dz3 = oldVelZ
            for (const blockBB of surroundingBBs) {
                dz1 = blockBB.computeOffsetZ(BB1, dz1)
                dz2 = blockBB.computeOffsetZ(BB2, dz2)
                dz3 = blockBB.computeOffsetZ(BB3, dz3)
            }
            BB1.offset(0, 0, dz1)
            BB2.offset(0, 0, dz2)
            BB3.offset(0, 0, dz3)

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
            playerBB.offset(0, dy, 0)

            if (oldVelXCol * oldVelXCol + oldVelZCol * oldVelZCol >= dx * dx + dz * dz) {
                dx = oldVelXCol
                dy = oldVelYCol
                dz = oldVelZCol
                playerBB = oldBBCol
            }
        }

        // Update flags
        setPositionToBB(playerBB, pos)
        entity.isCollidedHorizontally = dx !== oldVelX || dz !== oldVelZ
        entity.isCollidedVertically = dy !== oldVelY
        entity.onGround = entity.isCollidedVertically && oldVelY < 0

        const blockAtFeet = world.getBlock(pos.offset(0, -0.2, 0))

        if (dx !== oldVelX) vel.x = 0
        if (dz !== oldVelZ) vel.z = 0
        if (dy !== oldVelY) {
            if (blockAtFeet && blockAtFeet.type === slimeBlockId && !entity.control.sneak) {
                vel.y = -vel.y
            } else {
                vel.y = 0
            }
        }

        // Finally, apply block collisions (web, soulsand...)
        playerBB.contract(0.001, 0.001, 0.001)
        const cursor = new Vec3(0, 0, 0)
        for (cursor.y = Math.floor(playerBB.minY); cursor.y <= Math.floor(playerBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(playerBB.minZ); cursor.z <= Math.floor(playerBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(playerBB.minX); cursor.x <= Math.floor(playerBB.maxX); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && block.id > 0) {
                        /*if (supportFeature('velocityBlocksOnCollision')) {
                            if (block.type === soulsandId) {
                                vel.x *= physics.soulsandSpeed
                                vel.z *= physics.soulsandSpeed
                            } else if (block.type === honeyblockId) {
                                vel.x *= physics.honeyblockSpeed
                                vel.z *= physics.honeyblockSpeed
                            }
                        }*/
                        if (cobwebLike.has(block.type)) {
                            entity.isInWeb = true
                            entity.passable = cobwebLike.get(block.type)
                        } else if (block.type === bubblecolumnId) {
                            // TODO: fast fix
                            const down = false; // !block.metadata
                            const aboveBlock = world.getBlock(cursor.offset(0, 1, 0))
                            const bubbleDrag = (aboveBlock && aboveBlock.type === 0 /* air */) ? physics.bubbleColumnSurfaceDrag : physics.bubbleColumnDrag
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
        if (supportFeature('velocityBlocksOnTop')) {
            const blockBelow = world.getBlock(entity.pos.floored().offset(0, -0.5, 0))
            if (blockBelow && blockBelow.id > 0) {
                if (blockBelow.type === soulsandId) {
                    vel.x *= physics.soulsandSpeed
                    vel.z *= physics.soulsandSpeed
                } else if (blockBelow.type === honeyblockId) {
                    vel.x *= physics.honeyblockSpeed
                    vel.z *= physics.honeyblockSpeed
                }
            }
        }
    }

    function applyHeading(entity, strafe, forward, multiplier) {
        let speed = Math.sqrt(strafe * strafe + forward * forward)
        if (speed < 0.01) return new Vec3(0, 0, 0)

        speed = multiplier / Math.max(speed, 1)

        strafe *= speed * physics.scale
        forward *= speed * physics.scale

        const yaw = Math.PI - entity.yaw
        const sin = Math.sin(yaw)
        const cos = Math.cos(yaw)

        const vel = entity.vel
        vel.x += strafe * cos - forward * sin
        vel.z += forward * cos + strafe * sin
    }

    function isLadder(block) {
        return (block && (block.type === ladderId || block.type === vineId))
    }

    /**
     * @param {*} world
     * @param {Vector} pos
     * @returns
     */
    function isOnLadder(world, pos) {
        const offset_value_y = .07
        const _pos = pos.offset(0, offset_value_y, 0).flooredSelf()
        const block = world.getBlock(_pos, _ladder_check_tblock)
        let resp = isLadder(block)
        // if block is opened trapdoor
        if(!resp && block.tblock && block.tblock.material.tags.includes('trapdoor') && block.tblock.extra_data?.opened) {
            // check under block
            _pos.y--
            resp = isLadder(world.getBlock(_pos))
        }
        return resp
    }

    function doesNotCollide(world, pos) {
        const pBB = getPlayerBB(pos)
        return !getSurroundingBBs(world, pBB).some(x => pBB.intersects(x)) && getWaterInBB(world, pBB).length === 0
    }

    function moveEntityWithHeading(entity, world, strafe, forward) {
        const vel = entity.vel
        const pos = entity.pos

        let gravityMultiplier = (vel.y <= 0 && entity.slowFalling > 0) ? physics.slowFalling : 1;
        if(entity.flying) {
            gravityMultiplier = 0;
        }

        if (!entity.isInWater && !entity.isInLava) {
            // Normal movement
            let acceleration = physics.airborneAcceleration
            let inertia = physics.airborneInertia
            const blockUnder = world.getBlock(pos.offset(0, -1, 0))
            // @fix Если проверять землю, то если бежать, то в прыжке сильно падает скорость
            // if (entity.onGround && blockUnder) {
            if (blockUnder) {
                inertia = (blockSlipperiness[blockUnder.type] || physics.defaultSlipperiness) * 0.91
                acceleration = 0.1 * (0.1627714 / (inertia * inertia * inertia))
            }
            if (entity.control.pitch) {
                acceleration *= physics.pitchSpeed;
            }
            if (entity.control.sprint) {
                acceleration *= physics.sprintSpeed;
            }
            const speed = getEffectLevel(Effect.SPEED, entity.effects);
            if (speed > 0) {
                acceleration *= physics.speedEffect * speed;
            }
            const slowness = getEffectLevel(Effect.SLOWNESS, entity.effects);
            if (slowness > 0) {
                acceleration *= physics.slowEffect / slowness;
            }

            applyHeading(entity, strafe, forward, acceleration)

            if (entity.isOnLadder) {
                vel.x = math.clamp(-physics.ladderMaxSpeed, vel.x, physics.ladderMaxSpeed)
                vel.z = math.clamp(-physics.ladderMaxSpeed, vel.z, physics.ladderMaxSpeed)
                vel.y = Math.max(vel.y, entity.control.sneak ? 0 : -physics.ladderMaxSpeed)
            }

            moveEntity(entity, world, vel.x, vel.y, vel.z)

            if (entity.isOnLadder && (entity.isCollidedHorizontally ||
                (supportFeature('climbUsingJump') && entity.control.jump))) {
                vel.y = physics.ladderClimbSpeed // climb ladder
            }

            // Apply friction and gravity
            const levitation = getEffectLevel(Effect.LEVITIATION, entity.effects);
            if (levitation > 0) {
                vel.y += (0.05 * levitation - vel.y) * 0.2;
            } else {
                if(entity.flying) {
                    vel.y -= (physics.flyinGravity);
                    vel.y = Math.max(vel.y, 0);
                    inertia *= physics.flyingInertiaMultiplyer;
                } else {
                    vel.y -= physics.gravity * gravityMultiplier
                }
            }
            vel.y *= physics.airdrag
            vel.x *= inertia
            vel.z *= inertia
        } else {
            // Water / Lava movement
            const lastY = pos.y
            let acceleration = physics.liquidAcceleration
            const inertia = entity.isInWater ? physics.waterInertia : physics.lavaInertia
            let horizontalInertia = inertia

            if (entity.isInWater) {
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

            applyHeading(entity, strafe, forward, acceleration)
            moveEntity(entity, world, vel.x, vel.y, vel.z)
            vel.y *= inertia
            vel.y -= (entity.isInWater ? physics.waterGravity : physics.lavaGravity) * gravityMultiplier
            vel.x *= horizontalInertia
            vel.z *= horizontalInertia

            if (entity.isCollidedHorizontally && doesNotCollide(world, pos.offset(vel.x, vel.y + 0.6 - pos.y + lastY, vel.z))) {
                vel.y = physics.outOfLiquidImpulse // jump out of liquid
            }
        }
    }

    function isMaterialInBB(world, queryBB, type) {
        const cursor = new Vec3(0, 0, 0)
        for (cursor.y = Math.floor(queryBB.minY); cursor.y <= Math.floor(queryBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && (Array.isArray(type) ? type.indexOf(block.type) >= 0 : block.type === type)) return true
                }
            }
        }
        return false
    }

    function getLiquidHeightPcent(block) {
        return (getRenderedDepth(block) + 1) / 9
    }

    function getRenderedDepth(block) {
        if (!block) return -1
        if (waterLike.has(block.type)) return 0
        if (block.getProperties().waterlogged) return 0
        if (!block.material.is_water) return -1
        const meta = block.metadata
        return meta >= 8 ? 0 : meta
    }

    function getFlow(world, block) {
        const curlevel = getRenderedDepth(block)
        const flow = new Vec3(0, 0, 0)
        for (const [dx, dz] of [[0, 1], [-1, 0], [0, -1], [1, 0]]) {
            const adjBlock = world.getBlock(block.position.offset(dx, 0, dz))
            const adjLevel = getRenderedDepth(adjBlock)
            if (adjLevel < 0) {
                if (adjBlock && adjBlock.boundingBox !== 'empty') {
                    const adjLevel = getRenderedDepth(world.getBlock(block.position.offset(dx, -1, dz)))
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

        if (block.metadata >= 8) {
            for (const [dx, dz] of [[0, 1], [-1, 0], [0, -1], [1, 0]]) {
                const adjBlock = world.getBlock(block.position.offset(dx, 0, dz))
                const adjUpBlock = world.getBlock(block.position.offset(dx, 1, dz))
                if ((adjBlock && adjBlock.boundingBox !== 'empty') || (adjUpBlock && adjUpBlock.boundingBox !== 'empty')) {
                    flow.normalize().translate(0, -6, 0)
                }
            }
        }

        return flow.normalize()
    }

    function getWaterInBB(world, bb) {
        const waterBlocks = []
        const cursor = new Vec3(0, 0, 0)
        for (cursor.y = Math.floor(bb.minY); cursor.y <= Math.floor(bb.maxY); cursor.y++) {
            for (cursor.z = Math.floor(bb.minZ); cursor.z <= Math.floor(bb.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(bb.minX); cursor.x <= Math.floor(bb.maxX); cursor.x++) {
                    const block = world.getBlock(cursor)
                    if (block && block.material && (block.material.is_water || waterLike.has(block.type) || block.getProperties().waterlogged)) {
                        const waterLevel = cursor.y + 1 - getLiquidHeightPcent(block)
                        if (Math.ceil(bb.maxY) >= waterLevel) waterBlocks.push(block)
                    }
                }
            }
        }
        return waterBlocks
    }

    function isInWaterApplyCurrent(world, bb, vel) {
        const acceleration = new Vec3(0, 0, 0)
        const waterBlocks = getWaterInBB(world, bb)
        const isInWater = waterBlocks.length > 0
        for (const block of waterBlocks) {
            const flow = getFlow(world, block)
            acceleration.add(flow)
        }
        const len = acceleration.norm()
        if (len > 0) {
            vel.x += acceleration.x / len * 0.014
            vel.y += acceleration.y / len * 0.014
            vel.z += acceleration.z / len * 0.014
        }
        return isInWater
    }

    (physics as any).simulatePlayer = function(entity: PlayerState, world): PlayerState {
        const vel = entity.vel
        const pos = entity.pos

        const waterBB = getPlayerBB(pos).contract(0.001, 0.401, 0.001)
        const lavaBB = getPlayerBB(pos).contract(0.1, 0.4, 0.1)

        entity.isOnLadder = isOnLadder(world, pos);
        entity.isInWater = isInWaterApplyCurrent(world, waterBB, vel)
        entity.isInLava = isMaterialInBB(world, lavaBB, lavaId)
        if(entity.onGround) {
            entity.flying = false;
        }

        // Reset velocity component if it falls under the threshold
        if (Math.abs(vel.x) < physics.negligeableVelocity) vel.x = 0
        if (Math.abs(vel.y) < physics.negligeableVelocity) vel.y = 0
        if (Math.abs(vel.z) < physics.negligeableVelocity) vel.z = 0

        // Handle inputs
        if (entity.control.jump || entity.jumpQueued) {
            if (entity.jumpTicks > 0) entity.jumpTicks--
            if (entity.isInWater || entity.isInLava) {
                if (!entity.control.sneak) {
                    // @fixed Без этого фикса игрок не может выбраться из воды на берег
                    vel.y += 0.09 // 0.04
                }
            } else if (entity.onGround && entity.jumpTicks === 0) {
                vel.y = Math.fround(0.42 * physics.scale)
                if(honeyblockId != BLOCK_NOT_EXISTS) {
                    const blockBelow = world.getBlock(entity.pos.floored().offset(0, -0.5, 0))
                    vel.y *= ((blockBelow && blockBelow.type === honeyblockId) ? physics.honeyblockJumpSpeed : 1);
                }
                const jumpBoost = getEffectLevel(Effect.JUMP_BOOST, entity.effects);
                if (jumpBoost > 0) {
                    vel.y += 0.1 * jumpBoost
                }
                if (entity.control.sprint) {
                    // @fixed Без этого фикса игрок притормаживает при беге с прыжками
                    const yaw = Math.PI - entity.yaw;
                    vel.x += Math.sin(yaw) * (0.2 * physics.scale)
                    vel.z -= Math.cos(yaw) * (0.2 * physics.scale)
                }
                entity.jumpTicks = physics.autojumpCooldown
            } else if(entity.flying) {
                if(!entity.control.sneak) {
                    vel.y = physics.flyingYSpeed;
                }
            }
        } else {
            entity.jumpTicks = 0 // reset autojump cooldown
        }
        entity.jumpQueued = false

        let strafe = (entity.control.left - entity.control.right) * 0.98
        let forward = (entity.control.back - entity.control.forward) * 0.98

        strafe *= entity.base_speed;
        forward *= entity.base_speed;

        if (entity.control.sneak) {
            if(entity.flying) {
                if(!entity.control.jump) {
                    vel.y = -physics.flyingYSpeed;
                }
            } else if (entity.isInWater || entity.isInLava) {
                const sdd = physics.swimDownDrag;
                if (!entity.control.jump && vel.y > sdd.maxDown) {
                    vel.y = Math.max(vel.y - sdd.down, sdd.maxDown);
                }
            } else {
                strafe *= physics.sneakSpeed
                forward *= physics.sneakSpeed
            }
        }

        moveEntityWithHeading(entity, world, strafe, forward)

        return entity
    }

    return physics
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
function getEffectLevel(val, effects) {
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

export class PlayerState implements IPlayerControlState {
    pos: any;
    vel: any;
    flying: boolean;
    onGround: any;
    isInWater: any;
    isInLava: any;
    isInWeb: any;
    isOnLadder: any;
    isCollidedHorizontally: any;
    isCollidedVertically: any;
    jumpTicks: any;
    jumpQueued: any;
    yaw: any;
    control: any;
    effects: any;
    base_speed: number;
    dolphinsGrace: number;
    slowFalling: number;
    depthStrider: number;

    constructor(bot, control, mcData, features, base_speed) {
        // const mcData = require('minecraft-data')(bot.version)
        // const nbt = require('prismarine-nbt')
        const supportFeature        = makeSupportFeature(mcData, features);

        // Input / Outputs
        this.pos                    = bot.entity.position.clone()
        this.vel                    = bot.entity.velocity.clone()
        this.flying                 = false;
        this.onGround               = bot.entity.onGround
        this.isInWater              = bot.entity.isInWater
        this.isInLava               = bot.entity.isInLava
        this.isInWeb                = bot.entity.isInWeb
        this.isOnLadder             = bot.entity.isOnLadder
        this.isCollidedHorizontally = bot.entity.isCollidedHorizontally
        this.isCollidedVertically   = bot.entity.isCollidedVertically
        this.jumpTicks              = bot.jumpTicks
        this.jumpQueued             = bot.jumpQueued

        // Input only (not modified)
        this.yaw                    = bot.entity.yaw
        this.control                = control

        // effects
        this.effects               = bot.entity.effects;
        // Базовая скорость (1 для игрока, для мобов меньше или наоборот больше)
        this.base_speed             = typeof base_speed == 'number' ? base_speed : 1;

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

    apply(bot) {
        bot.entity.position                 = this.pos
        bot.entity.velocity                 = this.vel
        bot.entity.onGround                 = this.onGround
        bot.entity.isInWater                = this.isInWater
        bot.entity.isInLava                 = this.isInLava
        bot.entity.isInWeb                  = this.isInWeb
        bot.entity.isOnLadder               = this.isOnLadder
        bot.entity.isCollidedHorizontally   = this.isCollidedHorizontally
        bot.entity.isCollidedVertically     = this.isCollidedVertically
        bot.jumpTicks                       = this.jumpTicks
        bot.jumpQueued                      = this.jumpQueued
    }

}