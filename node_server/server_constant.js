// world transaction

export const WORLD_TRANSACTION_PERIOD   = 3000;  // the normal time (in ms) betwen world-saving transactions
export const WORLD_TRANSACTION_MAX_DIRTY_BLOCKS = 10000; // if there are more dirty blocks than this, world world transaction starts immediately

// chunks

// How long changes to world_modify_chunks can remain unsaved.
// Don't confuse it with WORLD_TRANSACTION_PERIOD: it's bigger, and only affects updating world_modify_chunks
export const WORLD_MODIFY_CHUNKS_TTL    = 60 * 1000;

/**
 * How many times on average {@link DBWorldChunk.deleteOldWorldModify} is called
 * per world transaction. It can be fractional.
 */
export const CLEAR_WORLD_MODIFY_PER_TRANSACTION = 0.5;

// items

export const ITEM_MERGE_RADIUS  = 0.5; // set it negative to disable merging
// If it's true, the old items are deleted immediatly.
// Otherwise, they remain in DB and are deleted on next resart.
export const IMMEDIATELY_DELETE_OLD_DROP_ITEMS_FROM_DB = true;

// mobs

export const DEAD_MOB_TTL       = 1000;     // time between the mob is detected dead and unloaded
export const MOB_SAVE_PERIOD    = 10000;
export const MOB_SAVE_DISTANCE  = 4;     // force saving if travelled more than this number of blocks