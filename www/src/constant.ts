// Global light type
export enum LIGHT_TYPE {
    NO      = 0,
    SMOOTH  = 1,
    RTX     = 2,
}

// Global chunk geometry mode
export enum CHUNK_GEOMETRY_MODE {
    AUTO             = 0,
    ONE_PER_CHUNK    = 1,
    BIG_MULTIDRAW    = 2,
    BIG_NO_MULTIDRAW = 3,
}

export enum CHUNK_GEOMETRY_ALLOC {
    AUTO = 0,
    M_64 = 64,
    M_125 = 125,
    M_250 = 250,
    M_375 = 375,
    M_500 = 500,
    M_750 = 750,
    M_1000 = 1000,
}

export const FAST = false

export const INGAME_MAIN_WIDTH              = 772
export const INGAME_MAIN_HEIGHT             = 514
export const GAME_ONE_SECOND                = 72;
export const GAME_DAY_SECONDS               = 24000;
// If more time than this has passed since the last update, player.update() is skipped.
export const MAX_FPS_DELTA_PROCESSED        = 2000;
export const DRAW_HUD_INFO_DEFAULT          = false; // (fps, player, etc)
export const HUD_CONNECTION_WARNING_INTERVAL= 5000; // if there are no packets fpor this time, a warning appears
export const RAINDROP_NEW_INTERVAL          = 25;
export const DEFAULT_CLOUD_HEIGHT           = 230.1;
export const DEFAULT_MOB_TEXTURE_NAME       = 'base'
export const ONLINE_MAX_VISIBLE_IN_F3       = 7;
export const DROP_LIFE_TIME_SECONDS         = 60;
export const MAX_DIST_FOR_PICKUP            = 2.5;
export const PICKUP_OWN_DELAY_SECONDS       = 2;
export const NO_TICK_BLOCKS                 = false;
export const BODY_ROTATE_SPEED              = 7;
export const HEAD_MAX_ROTATE_ANGLE          = 45; // in degree

// Dirt and grass
export const GRASS_PALETTE_OFFSET           = Object.freeze({x : 128, y : 0}) // (in px) offset in mask_color.png for grass palette
export const DEFAULT_DIRT_PALETTE           = Object.freeze({x: 0, y : 256, w: 128, h : 128, noise_range: 10}) as DirtPalette // noise_range is mix dirt colors on every block with random value
export const DEFAULT_GRASS_PALETTE          = Object.freeze({x: 128, y : 256, w: 128, h : 128, noise_range: 0}) as DirtPalette
export const DIRT_PALETTE_SIZE              = 128
export const GRASS_COLOR_SHIFT_FACTOR       = 6

export const DEFAULT_TX_CNT                 = 64;
export const BBMODEL_TX_CNT                 = 96;
export const DEFAULT_TX_SIZE                = 32;
export const DEFAULT_ATLAS_SIZE             = DEFAULT_TX_CNT * DEFAULT_TX_SIZE;
export const BBMODEL_ATLAS_SIZE             = BBMODEL_TX_CNT * DEFAULT_TX_SIZE;
export const COVER_STYLE_SIDES              = Object.freeze(['up', 'down', 'south', 'north', 'west', 'east'])
export const NOT_SPAWNABLE_BUT_INHAND_BLOCKS= Object.freeze(['BEDROCK'])
export const ITEM_LABEL_MAX_LENGTH          = 19;
export const DEFAULT_STYLE_NAME             = 'cube'
export const DEFAULT_RENDER_DISTANCE        = 5
export const DEFAULT_LIGHT_TYPE_ID          = LIGHT_TYPE.SMOOTH

export const MAGIC_ROTATE_DIV               = 900;

// =========================== интерфейс инвентаря ============================

export const INVENTORY_SLOT_SIZE            = 36    // размер слота в пикселях
export const DRAW_SLOT_INDEX                = true;
export const BAG_LINE_COUNT                 = 9
export const CHEST_LINE_COUNT               = 7
// The maximum time for which the client don't send inventory changes (used only in chest windows so far)
export const MAX_DIRTY_INVENTORY_DURATION   = 5000

// ==================== индексы слотов и размер инвентаря =====================

export const HOTBAR_LENGTH_MIN              = 4
export const HOTBAR_LENGTH_MAX              = 12
export const BAG_LENGTH_MIN                 = 27
export const BAG_LENGTH_MAX                 = 72
export const BAG_MAX_INDEX                  = HOTBAR_LENGTH_MAX + BAG_LENGTH_MAX

// Player paperdoll slots
export const PAPERDOLL_MIN_INDEX            = 84  // индекс минимального слота на кукле персонажа (сейчас равен BAG_MAX_INDEX, но в будущем может отличаться)
export const PAPERDOLL_BACKPACK             = 84; // backpack
export const PAPERDOLL_TOOLBELT             = 85; // toolbelt
export const PAPERDOLL_BOOTS                = 86; // boots
export const PAPERDOLL_LEGGINGS             = 87; // legs
export const PAPERDOLL_CHESTPLATE           = 88; // body
export const PAPERDOLL_HELMET               = 89; // head
export const PAPERDOLL_MAX_INDEX            = 89  // индекс максимального слота на кукле персонажа
/** номера слотов, предметы в кторых могут увеличить размер инвентаря */
export const PAPERDOLL_CONTAINERS_SLOTS     = [PAPERDOLL_BACKPACK, PAPERDOLL_TOOLBELT]

export const INVENTORY_DRAG_SLOT_INDEX      = 99
export const INVENTORY_SLOT_COUNT           = 100

// ================================= сундуки ==================================

export const DEFAULT_CHEST_SLOT_COUNT       = 27;
// It's added to pickatDistance on the client.
// If a player is farther away, the chest window closes.
export const CHEST_INTERACTION_MARGIN_BLOCKS = 2;
// It's added to the value above on the server.
// If a player is farther away, the chest interaction is not accepted.
// A client is expected to close the window before that.
// It serves 2 purposes: against cheaters who try to interact over huge distance,
// and to have a margin of safety ehn checking one half of a double chest in sendChestToPlayers()
export const CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD = 2;

// ============================================================================

export const HAND_ANIMATION_SPEED           = 20;
export const RENDER_DEFAULT_ARM_HIT_PERIOD  = 200; // ms (player arm hit period)
export const MIN_BRIGHTNESS                 = 0.275;
export const PLAYER_MAX_DRAW_DISTANCE       = 256; // draw only nearest players
export const RENDER_EAT_FOOD_DURATION       = 1800;

export const BLOCK_GROUP_TAG = {
    ALL:        "#all",
    BLOCK:      "#block",
    BREWING:    "#brewing",
    COMBAT:     "#combat",
    DECORE:     "#decore",
    FOOD:       "#food",
    FURNITURE:  "#furniture",
    LIGHTNING:  "#lightning",
    MISC:       "#misc",
    PLANT:      "#plant",
    TOOLS:      "#tools",
}

export const UI_THEME = {
    base_font: {
        color: '#5bc4da',
        family: 'UbuntuMono-Regular',
        size: 14
    },
    second_text_color: '#ffffffbb',
    label_text_color: '#ffffff33',
    window_padding: 10,
    slot_margin: 5,
    window_slot_size: 39,
    button: {
        font: {
            size: 14,
            color: '#ffffff'
        },
        background: {
            color: '#5bc4da44'
        }
    },
    // chat
    chat: {
        // main text
        text: {
            font: {
                color: '#5bc4da',
                size: 40
            }
        },
        //
        nicknames: {
            font: {
                color: '#8ff3ff',
                size: 60
            }
        }
    },
    // tabs control
    tabs: {
        // active tab
        active: {
            font: {
                color: '#feaa25',
                size: 60
            }
        },
        // inactive tab
        inactive: {
            font: {
                color: '#5bc4da',
                font_size: 60
            }
        }
    },
    // search input
    search: {
        // filled
        filled: {
            font: {
                color: '#5bc4da',
                size: 48
            }
        },
        // empty
        empty: {
            font: {
                color: '#293f51',
                font_size: 60
            }
        }
    },
    // quests
    quest: {
        // main quest
        main: {
            font: {
                color: '#feaa25',
                size: 40
            }
        },
        completed: {
            font: {
                color: '#4ffc88',
                size: 32
            }
        },
        incomplete: {
            font: {
                color: '#a6a6a6',
                size: 32
            }
        },
        //
        others: {
            font: {
                color: '#8ff3ff',
                size: 60
            }
        }
    },
    paginator: {
        font: {
            color: '#3a576f',
            size: 36
        }
    },
    popup: {
        title: {
            font: {
                color: '#feaa25',
                size: 16
            }
        },
        text: {
            font: {
                color: '#5bc4da',
                size: 12
            }
        }
    }
}

export enum LEAVES_TYPE {
    NO = 0,
    NORMAL = 1,
    BEAUTIFUL = 2,
}

/** Подмножество названий типов мобов. Это не все типы. */
export enum MOB_TYPE {
    AXOLOTL     = 'mob/axolotl',
    BEE         = 'mob/bee',
    CHICKEN     = 'mob/chicken',
    CREEPER     = 'mob/creeper',
    COW         = 'mob/cow',
    DEER        = 'mob/deer',
    FOX         = 'mob/fox',
    GOAT        = 'mob/goat',
    HORSE       = 'mob/horse',
    HUMANOID    = 'mob/humanoid',
    OCELOT      = 'mob/ocelot',
    PANDA       = 'mob/panda',
    PIG         = 'mob/pig',
    SHEEP       = 'mob/sheep',
    SKELETON    = 'mob/skeleton',
    SNOWBALL    = 'mob/snowball',
    SNOW_GOLEM  = 'mob/snow_golem',
    ZOMBIE      = 'mob/zombie',
    BOAT        = 'transport/boat',
    RAFT        = 'transport/raft'
}

export enum DAYLIGHT_VALUE {
    NONE = 0,
    FULL = 15,
}

export enum TREASURE_SOURCE {
    TREASURE_ROOM = 'treasure_room',
    CAVE_MINES = 'cave_mines',
    BUILDING = 'building'
}

export enum BLOCK_FLAG {
    SOLID                           = 0x1 | 0,
    REMOVE_ONAIR_BLOCKS_IN_CLUSTER  = 0x2 | 0, // these blocks must be removed over structures and buildings
    BIOME                           = 0x4 | 0,
    COLOR                           = 0x8 | 0,
    AO_INVISIBLE                    = 0x10 | 0,
    SPAWN_EGG                       = 0x20 | 0,
    STONE                           = 0x40 | 0,
    FLUID                           = 0x80 | 0,
    OPAQUE_FOR_NATURAL_SLAB         = 0x100 | 0,
    NOT_CREATABLE                   = 0x200 | 0,
    IS_DIRT                         = 0x400 | 0,
    TICKING                         = 0x800 | 0,
    RANDOM_TICKER                   = 0x1000 | 0,
    LAYERING_MOVE_TO_DOWN           = 0x2000 | 0,
}

export enum WORKER_MESSAGE {
    // chunk
    CHUNK_WORKER_INIT = 'init',
    // light
    LIGHT_WORKER_INIT = 'init',
    LIGHT_WORKER_INIT_WORLD = 'initWorld',
    // sound
    SOUND_WORKER_INIT = 'init',
    SOUND_WORKER_PLAYER_POS = 'player_pos',
    SOUND_WORKER_FLOWING_DIFF = 'flowing_diff',
}

// ======================== Network options =========================

// If we receive packets older than this, terminate the connection
export const MAX_PACKET_LAG_SECONDS         = 60
// If another host sent a packet that's marked as ahead of this host's time,
// it's accepted only if the difference doesn't exceed this value. TODO decrease this value when we have synchronized clocks
export const MAX_PACKET_AHEAD_OF_TIME_MS    = 10000
export const MAX_CLIENT_STATE_INTERVAL      = 500 // the maximum interval between a client sends CMD_PLAYER_STATE

// ======================== Physics options =========================

export const PHYSICS_POS_DECIMALS           = 4
export const PHYSICS_VELOCITY_DECIMALS      = 4
export const PHYSICS_ROTATION_DECIMALS      = 4 // It's applied to the input before physics calculations
export const PHYSICS_INTERVAL_MS            = 50
// The maximum number of physics ticks simulated at once. If we need to simulated more, the simulation its skipped.
export const PHYSICS_MAX_TICKS_PROCESSED    = 10 * 1000 / PHYSICS_INTERVAL_MS | 0
export const DEBUG_LOG_PLAYER_CONTROL       = false // log moderately detailed debug info about the player controls
export const DEBUG_LOG_PLAYER_CONTROL_DETAIL= false // log very detailed debug info about the player controls

// ========================= Sound options =========================

export const DEFAULT_SOUND_MAX_DIST         = 16

// The default value of the music volume seting, from 0 to 100. It should be be chosen taking into account Sounds.VOLUME_MAP.music
export const DEFAULT_MUSIC_VOLUME           = 20
export const CLIENT_MUSIC_ROOT              = './media/music/'
export const MUSIC_FADE_DURATION            = 1500
export const MUSIC_INITIAL_PAUSE_SECONDS    = 75
export const MUSIC_PAUSE_SECONDS            = 300

// Volumetric sound types. See also: VolumetricSound.SOUNDS
export const VOLUMETRIC_SOUND_TYPES         = 2
export const VOLUMETRIC_SOUND_TYPE_WATER    = 0
export const VOLUMETRIC_SOUND_TYPE_LAVA     = 1

/**
 * Distant sounds are presented as volume of all sounds coming from a horizontal sector.
 * i-th secotor (from 0 to (2^SECTORS_BITS - 1)) contains all sound sources whose angle is closest to
 *   i * 2 * PI / (2^SECTORS_BITS)
 */
export const VOLUMETRIC_SOUND_SECTOR_BITS = 5 // the minimum correct value is 2, but the minimum sane value is 4
// derived sectors constants
export const VOLUMETRIC_SOUND_SECTORS = 1 << VOLUMETRIC_SOUND_SECTOR_BITS
export const VOLUMETRIC_SOUND_SECTOR_INDEX_MASK = VOLUMETRIC_SOUND_SECTORS - 1
export const VOLUMETRIC_SOUND_ANGLE_TO_SECTOR = VOLUMETRIC_SOUND_SECTORS / (2 * Math.PI)

// The same meaning as refDistance in pannerAttr() with 'inverse' model.
// The larger it is, the less saound falls off with the distance.
export const VOLUMETRIC_SOUND_REF_DISTANCE     = 2

export const VOLUMETRIC_SOUND_MAX_DISTANCE     = 40

// The maximum time before changes to sound blocks are used to calculate the updated sound.
export const VOLUMETRIC_SOUND_DIRTY_BLOCKS_TTL = 50

// The maximum movement of the player that can be made withour re-calculating the sound summary
export const VOLUMETRIC_SOUND_SUMMARY_VALID_DISTANCE = 1.4

// temporal smoothing of the sound worker results
export const VOLUMETRIC_SOUND_MAX_VOLUME_CHANGE_PER_SECOND = 2.0
export const VOLUMETRIC_SOUND_MAX_STEREO_CHANGE_PER_SECOND = 2.0

/**
 * When the spund source is at a different height than the player, the absolute difference
 * of their horizontal coordinates affect stereo separation less. It's more physically accurate.
 * But in the game, it sounds better if this effect is less pronounced. The value is from 0 to 1.
 * 0 - Y is ignored (e.g. if a block is 20 blcoks below, and 2 blocks to the left, it'll sound
 * only in the left ear), 1 - fully affects (e.g. the previous block will sound almost the same in both ears).
 */
export const VOLUMETRIC_SOUND_HEIGHT_AFFECTS_STEREO = 0.5

/**
 * From 0.1 to 1. It makes area of the sound compressed in Y direction, and makes the
 * volume to fall of faster in Y direction. It's helps resuce underground noises.
 */
export const VOLUMETRIC_SOUND_ELLIPSOID_Y_RADIUS = 0.5

// ========================= Player options =========================

// player
export const PLAYER_ZOOM                    = 1;
export const PLAYER_HEIGHT                  = 1.7 * PLAYER_ZOOM;
export const PLAYER_WIDTH                   = 0.7 * PLAYER_ZOOM;
export const PLAYER_PHYSICS_HALF_WIDTH      = 0.3 * PLAYER_ZOOM; // default playerHalfWidth was 0.3 in prismarine
export const SNEAK_MINUS_Y_MUL              = 0.2 * PLAYER_ZOOM; // decrease player height to this percent value
export const PLAYER_DIAMETER                = 0.7;
export const PLAYER_RADIUS                  = PLAYER_DIAMETER / 2;
export const MOB_EYE_HEIGHT_PERCENT         = 1 - 1/16;
export const THIRD_PERSON_CAMERA_DISTANCE   = 5 * PLAYER_ZOOM;

export const SPECTATOR_SPEED_MUL            = 1 * PLAYER_ZOOM;

// portal
export const PORTAL_USE_INTERVAL            = 5000; // ms
export const PORTAL_SIZE                    = {width: 4, height: 5};
export const MAX_PORTAL_SEARCH_DIST         = 128;
export const MAX_CHUNK_Y_DIFF_FOR_PORTAL    = 3;

// World types
export const WORLD_TYPE_NORMAL              = 1;
export const WORLD_TYPE_BUILDING_SCHEMAS    = 2;

// attack
export const ATTACK_COOLDOWN                = 500

export const MOUSE = {
    DOWN: 1,
    UP: 2,
    MOVE: 3,
    CLICK: 4,
    WHEEL: 5,
    BUTTON_LEFT: 1,
    BUTTON_WHEEL: 2,
    BUTTON_RIGHT: 3
};

export const KEY = {
    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    ESC: 27,
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    ARROW_LEFT: 37,
    ARROW_UP: 38,
    ARROW_RIGHT: 39,
    ARROW_DOWN: 40,
    DEL: 46,
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    G: 71,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    V: 86,
    W: 87,
    Z: 90,
    WIN: 91,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    SLASH: 191,
};

export const CLIENT_SKIN_ROOT = './media/models/player_skins/';

export const SKIN_RIGHTS_DEFAULT = 0;
export const SKIN_RIGHTS_FREE = 1;
export const SKIN_RIGHTS_UPLOADED = 2;

export const PLAYER_SKIN_TYPES = {
    0: 'player:steve',
    1: 'player:alex',
    2: 'bbmodel',
};

export enum PLAYER_STATUS {
    DEAD         = 0,
    /**
     * A player with this status is alive, but doesn't move or interact with the world
     * until some necessary data is loaded (e.g. the chunks around them to choose a safe spawn point).
     * When the data is loaded, a new physics session is started for its controls.
     */
    WAITING_DATA = 1,
    /**
     * A player with status has (ServerPlayer.wait_portal != null) and can't move.
     * When the data is loaded, a new physics session is started for its controls.
     */
    WAITING_PORTAL  = 2,
    ALIVE           = 3,
    DELETED         = 4
}