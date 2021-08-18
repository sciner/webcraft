package Struct

const (
	BLOCK_CHEST int = 54

	// команды
	COMMAND_MSG_HELLO          int = 1
	COMMAND_PING               int = 3
	COMMAND_PONG               int = 4
	COMMAND_ERROR              int = 7   // какая-то ошибка (ИСХ)
	COMMAND_DATA               int = 200 // custom string data
	COMMAND_IS_TYPING          int = 201 //
	COMMAND_CONNECT            int = 34  // в мир вошел новый игрок
	CLIENT_BLOCK_DESTROY       int = 35
	CLIENT_BLOCK_SET           int = 36
	EVENT_CHUNK_ADD            int = 37
	EVENT_CHUNK_REMOVE         int = 38
	EVENT_CHUNK_LOADED         int = 39
	EVENT_CHAT_SEND_MESSAGE    int = 40 // Клиент прислал сообщение
	CLIENT_PLAYER_JOIN         int = 41 // Информирование клиента о том, что другой игрок вошел в игру
	CLIENT_PLAYER_LEAVE        int = 42 // Информирование клиента о том, что другой игрок покинул игру
	EVENT_PLAYER_STATE         int = 43
	CLIENT_CREATE_ENTITY       int = 44 // Клиент хочет создать сущность
	CLIENT_LOAD_CHEST          int = 45 // Клиент запросил содержимое сундука
	COMMAND_CHEST              int = 46 // Отправка клиенту содержимого сундука
	CLIENT_SET_CHEST_SLOT_ITEM int = 47 // Получены новые данные о содержимом слоте сундука

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
		X float32 `json:"x"`
		Y float32 `json:"y"`
		Z float32 `json:"z"`
	}
	BlockItem struct {
		ID       int      `json:"id"`
		Power    float32  `json:"power"`
		Rotate   Vector3f `json:"rotate"`
		Count    int      `json:"count"`
		EntityID string   `json:"entity_id"`
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
		ID   string `json:"id"`
		Seed string `json:"seed"`
	}
	// CmdChunkState
	CmdChunkState struct {
		Pos        Vector3              `json:"pos"`
		ModifyList map[string]BlockItem `json:"modify_list"`
	}
	///////////////////////////////////////////////////////
	ParamChestSetSlotItem struct {
		EntityID  string    `json:"entity_id"`
		SlotIndex int       `json:"slot_index"`
		Item      BlockItem `json:"item"`
	}
	ParamPlayerState struct {
		Nickname string    `json:"nickname"`
		ID       string    `json:"id"`
		Angles   []float32 `json:"angles"`
		Pos      Vector3f  `json:"pos"`
		Ping     int       `json:"ping"`
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
		ID       string    `json:"id"`
		Nickname string    `json:"nickname"`
		Skin     string    `json:"skin"`
		Angles   []float32 `json:"angles"`
		Pos      Vector3f  `json:"pos"`
	}
	ParamPlayerLeave struct {
		ID string `json:"id"`
	}
	ParamChunkRemove struct {
		Pos Vector3 `json:"pos"`
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
)
