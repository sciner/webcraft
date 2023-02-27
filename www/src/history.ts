import { unixTime, Vector, VectorCollector } from "./helpers.js"
import { ServerClient } from "./server_client.js"
import type { World } from "./world.js"

/**
 * TTL of blocks history records.
 * It's ok to have a very large value. There are not many values, so they won't slow
 * down the client or fill the memory.
 */
const TTL_SECONDS = 600

// these are unimportant
const DELETE_OLD_SUBSETS = 100
const DELETE_OLD_INTERVAL = 100

type BlockSnapshot = {
    id      : int
    unixTime: int
    block   : IBlockItem
    fluid   : int
}

type BlockHistory = {
    pos: Vector
    snapshots: BlockSnapshot[]
}

/** It remembers block changes made on a client, and can roll them back. */
export class WorldHistory {

    world: World
    historiesByPos = new VectorCollector<BlockHistory>()
    posById = new Map<int, Vector>()
    nextSnapshotId = 0
    nextGroupIndex = 0
    lastDeleteOld = -Infinity

    constructor(world: World) {
        this.world = world
    }

    /**
     * Rememebers the state of a block and fluid at the specified position.
     * @param {IVector} pos_ position of an existing block
     * @return snapshot id, that can be used to restore this snapshot
     */
    makeSnapshot(pos_: IVector): int {
        const pos = new Vector(pos_)
        const block = this.world.getBlock(pos)
        if (block.id < 0) {
            throw new Error('block.id < 0') // we don't expect it to happen
        }
        const snapshot: BlockSnapshot = {
            id      : this.nextSnapshotId,
            unixTime: unixTime(),
            block   : block.clonePOJO(),
            fluid   : block.fluid
        }
        this.nextSnapshotId = (this.nextSnapshotId + 1) & 0x7FFFFFFF
        const blockHistory = this.historiesByPos.getOrSet(pos, () => {
            return {
                pos: pos,
                snapshots: []
            }
        })
        blockHistory.snapshots.push(snapshot)
        this.posById.set(snapshot.id, blockHistory.pos)
        return snapshot.id
    }

    /** Restores a block and its fluid from its previously created snapshot. */
    rollback(snapshotId: int): void {
        const pos = this.posById.get(snapshotId)
        if (pos == null) {
            return // IDK how it's posible, but let's check it
        }
        const blockHistory = this.historiesByPos.get(pos)
        const snapshots = blockHistory.snapshots
        // find the snapshot y id
        let index = 0
        while (index < snapshots.length) {
            if (snapshots[index].id === snapshotId) {
                break
            }
        }
        if (index === snapshots.length) {
            return  // IKD how it's possible, but let's check it
        }

        const snapshot = snapshots[index]
        // also remove all previous snapshots - they are not needed anymore
        const removedSnapshots = snapshots.splice(0, index + 1)
        for(const removedSnapshot of removedSnapshots) {
            this.posById.delete(removedSnapshot.id)
        }

        if (snapshots.length) {
            // because the current change is rolled back, update the next snapshot to the current one
            snapshots[0].block = snapshot.block
            snapshots[0].fluid = snapshot.fluid
        } else {
            this.historiesByPos.delete(pos)
        }

        // revert the block to its snapshot
        const block = this.world.setBlockDirect(pos, snapshot.block, ServerClient.BLOCK_ACTION_REPLACE)
        if (block) { // if the block existed
            block.fluid = snapshot.fluid
        }
    }

    // Call it regularly to remove the old histories from memory
    deletOld(): void {
        if (performance.now() < this.lastDeleteOld + DELETE_OLD_INTERVAL) {
            return
        }
        this.lastDeleteOld = performance.now()
        const minUnixTime = unixTime() - TTL_SECONDS
        for(const blockHistory of this.historiesByPos.subsetOfValues(this.nextGroupIndex, DELETE_OLD_SUBSETS)) {
            // It's ok to have slow code here: there are few elements, and it's executed rarely
            while (blockHistory.snapshots.length && blockHistory.snapshots[0].unixTime < minUnixTime) {
                this.posById.delete(blockHistory.snapshots[0].id)
                blockHistory.snapshots.shift()
            }
            if (blockHistory.snapshots.length === 0) {
                this.historiesByPos.delete(blockHistory.pos)
            }
        }
        this.nextGroupIndex = (this.nextGroupIndex + 1) % DELETE_OLD_SUBSETS
    }
}