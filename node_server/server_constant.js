// world transaction

export let WORLD_TRANSACTION_PERIOD = 2000; // the time (in ms) between world-saving transactions

// Max. chunks saved to world_modify_chunks per transaction
// Increasing this number allows them to unload faster.
export const WORLD_MODIFY_CHUNKS_PER_TRANSACTION = 10;

// Additional timeout after World Transaction and fluids write everything, before exiting the process.
// It's to allow any other async queries (not included in world transaction or fluids) to finish.
export const SHUTDOWN_ADDITIONAL_TIMEOUT = 1000;

// chunks

// Changes are saved to world_modify_chunks if there are no new changes for this much time.
// It doesn't make sense to save world_modify_chunks if a chunk is still getting changed often. The changes will likely be owerwritten soon.
// Save it only when there were no changes for some time.
// Don't confuse it with WORLD_TRANSACTION_PERIOD: it's bigger, and only affects updating world_modify_chunks
export const STABLE_WORLD_MODIFY_CHUNKS_TTL = 60 * 1000;

// Similar to STABLE_WORLD_MODIFY_CHUNKS_TTL, but for chunkles changes
export const STABLE_WORLD_MODIFY_CHUNKLESS_TTL = 20 * 1000;

/**
 * How many times on average {@link DBWorldChunk.cleanupWorldModify} is called
 * per world transaction. It can be fractional.
 *
 * It's not const, so qubatch-single can increase it.
 */
export let CLEANUP_WORLD_MODIFY_PER_TRANSACTION = 0.5;

// items

export const ITEM_MERGE_RADIUS = 0.5; // set it negative to disable merging
// If it's true, the old items are deleted immediatly.
// Otherwise, they remain in DB and are deleted on next resart.
export const IMMEDIATELY_DELETE_OLD_DROP_ITEMS_FROM_DB = true;

// mobs

export const DEAD_MOB_TTL = 1000; // time between the mob is detected dead and unloaded
export const MOB_SAVE_PERIOD = 10000;
export const MOB_SAVE_DISTANCE = 4; // force saving if travelled more than this number of blocks
