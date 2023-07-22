import { MAX_PACKET_LAG_SECONDS } from "@client/constant.js"

/**
 * Если true, клиент может при входе в мир сказать что он бот, и сразу использовать режим наблюдателя не будучи админом.
 * TODO отключить в релизе
 */
export const SPECTATOR_BOTS_ENABLED = true

export const WORLD_TTL_SECONDS = 60     // Сколько остается в памяти мир без игроков в котором все важное сохранено

// =================================== сеть ===================================

/** The server sends a command to each player at least once per this interval of time. */
export const SERVER_SEND_CMD_MAX_INTERVAL = 1000

// TODO удалить эту настройку вместе со альтернативным кодом
export const COMMANDS_IN_ACTIONS_QUEUE = true

// ================================ управление ================================

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

// ================================= вождние ==================================

/**
 * Если моб-учстник движения отсутсвует на сервере (может не загружен из-за тормозов, или нарушилась целостность
 * данных из-за бага), но числится в вождении - через сколько секунд его выкидывать из вождения.
 */
export const DRIVING_ABSENT_MOB_TTL_SECONDS = 30

/**
 * Если игрок-учстник движения отсутсвует на сервере (вышел из игры), но числится в вождении, он будет из него удален,
 * если транспортное средство сместится более чем на это расстояние от того места, где он участник был последний раз.
 */
export const DRIVING_ABSENT_PLAYER_DISTANCE = 20

/** Через сколько секунд после временного исчезновения из игры игрока-водителя начинает работать ИИ моба. */
export const DRIVING_ABSENT_PLAYER_MOB_BRAIN_DELAY_SECONDS = 10

// ==================================== БД ====================================

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
export const MOB_WITHOUT_CHUNK_TTL_SECONDS = 60 // если моб без чанка дольше этого времени, он забывается

// ============================= game mechanics ============================

export const PLAYER_EXHAUSTION_PER_BLOCK = 0.01
// if a player moves more than this distance from his original position, he wakes up or stands up from a chair
export const WAKEUP_MOVEMENT_DISTANCE = 1.0
export const SIMULATE_PLAYER_PHYSICS = true

// velocity for deliberate item throws, blocks/phys.tick
export const THROW_ITEM_VELOCITY                = 0.35
export const THROW_ITEM_ADD_VERTICAL_VELOCITY   = 0.3

// velocity for when items are dropped by a player (e.g., there is not enough space), blocks/phys.tick
export const DROP_ITEM_HORIZONTAL_VELOCITY      = 0.15
export const DROP_ITEM_VERTICAL_VELOCITY        = 0.35