package Struct

import (
	"time"
)

const (
	BLOCK_CHEST      int   = 54
	GAME_ONE_SECOND  int64 = 72
	GAME_DAY_SECONDS int64 = 24000

	// команды
	CMD_MSG_HELLO              int = 1
	CMD_PING                   int = 3
	CMD_PONG                   int = 4
	CMD_ERROR                  int = 7   // какая-то ошибка (ИСХ)
	CMD_DATA                   int = 200 // custom string data
	CMD_IS_TYPING              int = 201 //
	CMD_CONNECT                int = 34  // в мир вошел новый игрок
	CMD_BLOCK_DESTROY          int = 35
	CMD_BLOCK_SET              int = 36
	CMD_CHUNK_ADD              int = 37
	CMD_CHUNK_REMOVE           int = 38
	CMD_CHUNK_LOADED           int = 39
	CMD_CHAT_SEND_MESSAGE      int = 40 // Клиент прислал сообщение
	CMD_PLAYER_JOIN            int = 41 // Информирование клиента о том, что другой игрок вошел в игру
	CMD_PLAYER_LEAVE           int = 42 // Информирование клиента о том, что другой игрок покинул игру
	CMD_PLAYER_STATE           int = 43
	CMD_CREATE_ENTITY          int = 44 // Клиент хочет создать сущность
	CMD_LOAD_CHEST             int = 45 // Клиент запросил содержимое сундука
	CMD_CHEST_CONTENT          int = 46 // Отправка клиенту содержимого сундука
	CMD_SET_CHEST_SLOT_ITEM    int = 47 // Получены новые данные о содержимом слоте сундука
	CMD_WORLD_STATE            int = 60 // состояние мира
	CMD_CONNECTED              int = 62
	CMD_CHANGE_POS_SPAWN       int = 63
	CMD_TELEPORT_REQUEST       int = 64
	CMD_TELEPORT               int = 65
	CMD_SAVE_INVENTORY         int = 66
	CMD_NEARBY_MODIFIED_CHUNKS int = 67 // Чанки, находящиеся рядом с игроком, у которых есть модификаторы

	ERROR_INVALID_SESSION    int = 401
	ERROR_ROOM_ACCESS_DENIED int = 20

	SERVICE_MESSAGE_TYPE_TEXT     int = -1
	SERVICE_MESSAGE_TYPE_LOADMORE int = -2

	PREVIOUS_MAX_LIMIT int = 30
	USER_SYSTEM_ID         = -1
	USER_SYSTEM_TOKEN      = "eff43583a4cc76a020c898bacc7cbe2d"

	ROOM_UPDATE_INFO_TITLE    int = 1
	ROOM_UPDATE_INFO_READONLY int = 2

	CHAT_MESSAGE_STATUS_NEW       int = 1
	CHAT_MESSAGE_STATUS_SENT      int = 2
	CHAT_MESSAGE_STATUS_DELIVERED int = 3
	CHAT_MESSAGE_STATUS_READ      int = 4
)

type (

	///////////////////////////////////////////////////////
	Vector3 struct {
		X int `json:"x"`
		Y int `json:"y"`
		Z int `json:"z"`
	}
	Vector3f struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		Z float64 `json:"z"`
	}
	BlockItem struct {
		ID        int                    `json:"id"`
		Power     float32                `json:"power"`
		Rotate    Vector3f               `json:"rotate"`
		Count     int                    `json:"count,omitempty"`
		EntityID  string                 `json:"entity_id,omitempty"`
		ExtraData map[string]interface{} `json:"extra_data,omitempty"`
	}
	///////////////////////////////////////////////////////
	// Command ...
	Command struct {
		Name int
		Data interface{}
		ID   *string
	}
	// CmdConnect
	CmdConnect struct {
		WorldGUID string `json:"world_guid"`
	}
	// CmdChunkState
	CmdChunkState struct {
		Pos        Vector3              `json:"pos"`
		ModifyList map[string]BlockItem `json:"modify_list,omitempty"`
	}
	///////////////////////////////////////////////////////
	ParamChestSetSlotItem struct {
		EntityID  string    `json:"entity_id"`
		SlotIndex int       `json:"slot_index"`
		Item      BlockItem `json:"item"`
	}
	ParamPlayerState struct {
		Nickname        string   `json:"nickname"`
		ID              string   `json:"id"`
		Pos             Vector3f `json:"pos"`
		Rotate          Vector3f `json:"rotate"`
		Ping            int      `json:"ping"`
		ChunkRenderDist int      `json:"chunk_render_dist"`
	}
	PlayerInventoryCurrent struct {
		Index int64 `json:"index"`
	}
	PlayerInventory struct {
		Items   []*BlockItem            `json:"items"`
		Current *PlayerInventoryCurrent `json:"current"`
	}
	PlayerState struct {
		Brightness float32          `json:"brightness"`
		PosSpawn   *Vector3f        `json:"pos_spawn"`
		Pos        *Vector3f        `json:"pos"`
		Rotate     *Vector3f        `json:"rotate"`
		Flying     bool             `json:"flying"`
		Inventory  *PlayerInventory `json:"inventory"`
		World      *WorldProperties `json:"world"`
	}
	/*
		ParamCreateEntity struct {
			Pos  Vector3   `json:"pos"`
			Item BlockItem `json:"item"`
		}*/
	ParamBlockSet struct {
		Pos  Vector3   `json:"pos"`
		Item BlockItem `json:"item"`
	}
	ParamLoadChest struct {
		EntityID string `json:"entity_id"`
	}
	ParamChunkAdd struct {
		Pos Vector3 `json:"pos"`
	}
	ParamChatSendMessage struct {
		Nickname string `json:"nickname"`
		Text     string `json:"text"`
	}
	ParamPlayerJoin struct {
		ID       string   `json:"id"`
		Nickname string   `json:"nickname"`
		Skin     string   `json:"skin"`
		Pos      Vector3f `json:"pos"`
		Rotate   Vector3f `json:"rotate"`
	}
	ParamPlayerLeave struct {
		ID string `json:"id"`
	}
	ParamChunkRemove struct {
		Pos Vector3 `json:"pos"`
	}
	WorldState struct {
		// 1 игровая секунда = 72 реальных
		// В 1 игровом дне 24000 игровых секунд
		Age      int64 `json:"age"`       // Возраст мира с момента его создания в игровых днях
		AgeShift int64 `json:"age_shift"` // Смещение времени в игровых секундах
		DayTime  int64 `json:"day_time"`  // Текущее время в игровых секундах (0 ... 23999)
	}
	WorldProperties struct {
		ID        int64                  `json:"id"`
		UserID    int64                  `json:"user_id"`
		Dt        time.Time              `json:"dt"`
		GUID      string                 `json:"guid"`
		Title     string                 `json:"title"`
		Seed      string                 `json:"seed"`
		Generator map[string]interface{} `json:"generator"`
		PosSpawn  *Vector3f              `json:"pos_spawn"`
	}
	// JSONResponse ...
	JSONResponse struct {
		Name int         `json:"event"`
		Data interface{} `json:"data"`
		ID   *string     `json:"id"`
	}
	// JSONResponseRAW ...
	JSONResponseRAW struct {
		Raw string `json:"raw"`
	}
	// ApiJSONResponse ...
	ApiJSONResponse struct {
		Result interface{} `json:"result"`
		/*
				Status string `json:"status"`
				Message string `json:"message"`
			    Data interface{} `json:"data"`
		*/
	}
	// ApiJSONResponseError ...
	ApiJSONResponseError struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	// CmdError ...
	CmdError struct {
		Code int    `json:"code"`
		Text string `json:"text"`
	}
	// UserSession ...
	UserSession struct {
		UserID    int64  `json:"user_id"`
		UserGUID  string `json:"user_guid"`
		Username  string `json:"username"`
		SessionID string `json:"session_id"`
	}
	ParamPosSpawn struct {
		Pos Vector3f `json:"pos"`
	}
	// Запрос от клиента на перемещение к указанному месту или координате
	ParamTeleportRequest struct {
		PlaceID string    `json:"place_id"`
		Pos     *Vector3f `json:"pos"`
	}
	// Исходящая от сервера команда для клиента, о перемещении
	ParamTeleport struct {
		PlaceID string    `json:"place_id"`
		Pos     *Vector3f `json:"pos"`
	}
	SessionError struct{}
)

func (m *SessionError) Error() string {
	return "error_invalid_session"
}

// Vector3.Equal
func (this *Vector3) Equal(vec Vector3) bool {
	return this.X == vec.X && this.Y == vec.Y && this.Z == vec.Z
}
