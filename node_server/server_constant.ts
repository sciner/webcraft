import { MAX_PACKET_LAG_SECONDS } from "@client/constant.js"

// ========================= network =============================

/** The server sends a command to each player at least once per this interval of time. */
export const SERVER_SEND_CMD_MAX_INTERVAL = 1000

// by how many blocks the client's pos may differ without needing correction
export const ACCEPTABLE_PLAYER_POS_ERROR = 0.01
export const ACCEPTABLE_PLAYER_VELOCITY_ERROR = 0.01

/**
 * Because the type of player control on a server and a client changes at different time, it may lead to position
 * desynchronization and visible corrections (e.g. a spectator started falling at a different time).
 * To avoid it, the server doesn't validate the client state for some ticks after the change.
 * It seems it should be bigger than MAX_CLIENT_STATE_INTERVAL.
 * TODO this is a potential exploit, make it more secure
 */
export const DONT_VALIDATE_AFTER_MODE_CHANGE_MS = 2000

/**
 * The server accepts client input of the lagging player that is not older than this value.
 * If the client input known to the server becomes older than this value, the server assumes that the player's input
 * at that time was empty, and simulates the physics with this input. If the client later sends this input later,
 * it'll be ignored. It's to prevent the client from delaying packets for too long, then "teleporting".
 */
export const SERVER_UNCERTAINTY_SECONDS = MAX_PACKET_LAG_SECONDS

// database

/**
 * If it's true, indicators are saved in DB in the old format, preserving backwards compatibility,
 * so the older code can open it.
 * If it's false, indicators are saved in the new, more effecient format.
 *
 * TODO change it to false after a few months.
 */
export const SAVE_BACKWARDS_COMPATIBLE_INDICATOTRS = true;

// world transaction

export let WORLD_TRANSACTION_PERIOD = 2000;  // the time (in ms) between world-saving transactions

// Max. chunks saved to world_modify_chunks per transaction
// Increasing this number allows them to unload faster.
export const WORLD_MODIFY_CHUNKS_PER_TRANSACTION = 10;

// Additional timeout after World Transaction and fluids write everything, before exiting the process.
// It's to allow any other async queries (not included in world transaction or fluids) to finish.
export const SHUTDOWN_ADDITIONAL_TIMEOUT = 1000

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

export const ITEM_MERGE_RADIUS  = 0.5; // set it negative to disable merging
// If it's true, the old items are deleted immediatly.
// Otherwise, they remain in DB and are deleted on next resart.
export const IMMEDIATELY_DELETE_OLD_DROP_ITEMS_FROM_DB = true;

// mobs

export const DEAD_MOB_TTL       = 1000;     // time between the mob is detected dead and unloaded
export const MOB_SAVE_PERIOD    = 10000;
export const MOB_SAVE_DISTANCE  = 4;     // force saving if travelled more than this number of blocks

// ============================= game mechanics ============================

export const PLAYER_EXHAUSTION_PER_BLOCK = 0.01
// if a player moves more than this distance from his original position, he wakes up or stands up from a chair
export const WAKEUP_MOVEMENT_DISTANCE = 1.0