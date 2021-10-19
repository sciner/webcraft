package Type

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"time"

	"madcraft.io/madcraft/Struct"
)

const (
	CHUNK_SIZE_X int = 16
	CHUNK_SIZE_Y int = 32
	CHUNK_SIZE_Z int = 16
)

type (
	World struct {
		Properties  *Struct.WorldProperties
		Mu          *sync.Mutex          // чтобы избежать коллизий
		Connections map[string]*UserConn // Registered connections.
		Chunks      map[Struct.Vector3]*Chunk
		Entities    *EntityManager
		CreateTime  time.Time // Время создания, time.Now()
		Directory   string
		State       *Struct.WorldState
		Db          *WorldDatabase
		DBGame      *GameDatabase
		Chat        *Chat
	}
)

func (this *World) Load(guid string) {
	this.Properties = &Struct.WorldProperties{
		GUID: guid,
	}
	this.Directory = this.GetDir()
	this.CreateTime = this.getDirectoryCTime(this.Directory)
	this.State = &Struct.WorldState{}
	this.Db = GetWorldDatabase(this.Directory + "/world.sqlite")
	//
	this.Chat = &Chat{
		World: this,
		Db:    this.Db,
	}
	//
	world_properties, err := this.Db.GetWorld(guid, this.DBGame) // DBGame
	if err != nil {
		log.Printf("ERROR10 LOAD WORLD: %v", err)
		return
	}
	this.Properties = world_properties
	//
	this.Entities.Load(this)
}

func (this *World) updateWorldState() {
	currentTime := time.Now()
	// возраст в реальных секундах
	diff_sec := currentTime.Sub(this.CreateTime).Seconds()
	// один игровой день в реальных секундах
	game_day_in_real_seconds := float64(86400 / Struct.GAME_ONE_SECOND) // 1200
	// возраст в игровых днях
	age := diff_sec / game_day_in_real_seconds // например 215.23
	// возраст в ЦЕЛЫХ игровых днях
	this.State.Age = int64(math.Floor(age)) // например 215
	// количество игровых секунд прошедших в текущем игровом дне
	this.State.DayTime = int64((age - float64(this.State.Age)) * float64(Struct.GAME_DAY_SECONDS))
}

// OnPlayer...
func (this *World) OnPlayer(conn *UserConn) {
	// 1. Add new connection
	if val, ok := this.Connections[conn.ID]; ok {
		log.Printf("OnPlayer delete existing conn: %s", conn.ID)
		val.Close()
		delete(this.Connections, conn.ID)
	}
	log.Printf("OnPlayer add conn: %s", conn.ID)
	this.Connections[conn.ID] = conn
	// 2. Insert to DB if new player
	user_id, player_state, err := this.Db.RegisterUser(this.Connections[conn.ID], this.Properties.PosSpawn, true)
	if err != nil || user_id == 0 {
		log.Println("ERROR14: User not registered")
		return
	}
	// 3.
	conn.PosSpawn = *player_state.PosSpawn
	// 4. Send about all other players
	for _, c := range this.Connections {
		if c.ID != conn.ID {
			params := &Struct.ParamPlayerJoin{
				ID:       c.ID,
				Skin:     c.Skin,
				Nickname: c.Session.Username,
				Pos:      c.Pos,
				Rotate:   c.Rotate,
			}
			packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_JOIN, Data: params, ID: nil}
			packets := []Struct.JSONResponse{packet}
			conn.WriteJSON(packets)
		}
	}
	// 5.
	params := &Struct.ParamPlayerJoin{
		ID:       conn.ID,
		Skin:     conn.Skin,
		Nickname: conn.Session.Username,
		Pos:      *player_state.Pos,
		Rotate:   *player_state.Rotate,
	}
	packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_JOIN, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	// this.SendAll(packets, []string{conn.ID})
	this.SendAll(packets, []string{})
	// 6. Write to chat about new player
	this.SendSystemChatMessage(conn.Session.Username+" подключился", []string{conn.ID})
	// 7. Send World State for new player
	cons := make(map[string]*UserConn, 0)
	cons[conn.ID] = conn
	this.SendWorldState(cons)
	player_state.World = this.Properties
	this.SendPlayerState(conn, player_state)
}

// SendPlayerState
func (this *World) SendPlayerState(conn *UserConn, player_state *Struct.PlayerState) {
	packet := Struct.JSONResponse{Name: Struct.CMD_CONNECTED, Data: player_state, ID: nil}
	packets := []Struct.JSONResponse{packet}
	conn.WriteJSON(packets)
}

// Send World State
func (this *World) SendWorldState(connections map[string]*UserConn) {
	this.updateWorldState()
	packet3 := Struct.JSONResponse{Name: Struct.CMD_WORLD_STATE, Data: this.State, ID: nil}
	packets3 := []Struct.JSONResponse{packet3}
	if len(connections) > 0 {
		this.SendSelected(packets3, connections, []string{})
	} else {
		this.SendAll(packets3, []string{})
	}
}

// SendSystemChatMessage...
func (this *World) SendSystemChatMessage(message string, except_conn_id_list []string) {
	chatMessage := &Struct.ParamChatSendMessage{
		Nickname: "<SERVER>",
		Text:     message,
	}
	packet2 := Struct.JSONResponse{Name: Struct.CMD_CHAT_SEND_MESSAGE, Data: chatMessage, ID: nil}
	packets2 := []Struct.JSONResponse{packet2}
	this.SendAll(packets2, except_conn_id_list)
}

//
func (this *World) GetChunkAddr(pos Struct.Vector3) Struct.Vector3 {
	v := Struct.Vector3{
		X: int(math.Floor(float64(pos.X) / float64(CHUNK_SIZE_X))),
		Y: int(math.Floor(float64(pos.Y) / float64(CHUNK_SIZE_Y))),
		Z: int(math.Floor(float64(pos.Z) / float64(CHUNK_SIZE_Z))),
	}
	log.Printf("%v, %v", pos, v)
	return v
}

func (this *World) OnCommand(cmdIn Struct.Command, conn *UserConn) {
	// log.Printf("OnCommand: %d", cmdIn.Name)
	switch cmdIn.Name {

	case Struct.CMD_BLOCK_SET:

		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamBlockSet
		json.Unmarshal(out, &params)
		if params.Item.ID != 1 {
			chunkAddr := this.GetChunkAddr(params.Pos)
			chunk := this.ChunkGet(chunkAddr)
			this.Db.BlockSet(conn, this, params)
			chunk.BlockSet(conn, params, false)
		}

	case Struct.CMD_CREATE_ENTITY:

		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamBlockSet
		json.Unmarshal(out, &params)
		chunkAddr := this.GetChunkAddr(params.Pos)
		chunk := this.ChunkGet(chunkAddr)
		chunk.BlockSet(conn, params, false)

	// Пользователь подгрузил чанк
	case Struct.CMD_CHUNK_ADD:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamChunkAdd
		json.Unmarshal(out, &params)
		// получим чанк
		chunk := this.ChunkGet(params.Pos)
		//
		this.Mu.Lock()
		defer this.Mu.Unlock()
		// запомним, что юзер в этом чанке
		chunk.AddUserConn(conn)
		// отправим ему modify_list
		chunk.Loaded(conn)

	// Пользователь выгрузил чанк
	case Struct.CMD_CHUNK_REMOVE:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamChunkRemove
		json.Unmarshal(out, &params)
		// this.ChunkRemove(params, conn)
		// получим чанк
		chunk := this.ChunkGet(params.Pos)
		//
		this.Mu.Lock()
		defer this.Mu.Unlock()
		// забудем, что юзер в этом чанке
		chunk.RemoveUserConn(conn)
		// если в чанке больше нет юзеров, до удалим чанк
		if len(chunk.Connections) < 1 {
			delete(this.Chunks, params.Pos)
		}

	case Struct.CMD_CHAT_SEND_MESSAGE:
		// Send to users
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamChatSendMessage
		json.Unmarshal(out, &params)
		this.Chat.SendMessage(conn, this, params)

	case Struct.CMD_PLAYER_STATE:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamPlayerState
		json.Unmarshal(out, &params)
		params.ID = conn.ID
		params.Nickname = conn.Session.Username
		packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_STATE, Data: params, ID: nil}
		packets := []Struct.JSONResponse{packet}
		// Update local position
		conn.Pos = params.Pos
		conn.Rotate = params.Rotate
		this.SavePlayerState(conn)
		this.SendAll(packets, []string{conn.ID})
		// this.SendAll(packets, []string{})

	case Struct.CMD_LOAD_CHEST:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamLoadChest
		json.Unmarshal(out, &params)
		this.Entities.LoadChest(params, conn)

	case Struct.CMD_SET_CHEST_SLOT_ITEM:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamChestSetSlotItem
		json.Unmarshal(out, &params)
		this.Entities.SetChestSlotItem(params, conn)

	case Struct.CMD_CHANGE_POS_SPAWN:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamPosSpawn
		json.Unmarshal(out, &params)
		this.Db.ChangePosSpawn(conn, params)

	case Struct.CMD_TELEPORT_REQUEST:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamTeleportRequest
		json.Unmarshal(out, &params)
		var new_pos *Struct.Vector3f
		if params.Pos != nil {
			new_pos = params.Pos
		} else if len(params.PlaceID) > 0 {
			switch params.PlaceID {
			case "spawn":
				{
					new_pos = &conn.PosSpawn
				}
			case "random":
				{
					s1 := rand.NewSource(time.Now().UnixNano())
					r1 := rand.New(s1)
					fmt.Print(r1.Intn(100))
					new_pos = &Struct.Vector3f{
						X: float32(1000 + r1.Intn(2000000)),
						Y: 120,
						Z: float32(1000 + r1.Intn(2000000)),
					}
				}
			}
		}
		if new_pos != nil {
			params := &Struct.ParamTeleport{
				Pos:     new_pos,
				PlaceID: params.PlaceID,
			}
			packet := Struct.JSONResponse{Name: Struct.CMD_TELEPORT, Data: params, ID: nil}
			packets := []Struct.JSONResponse{packet}
			connections := map[string]*UserConn{
				conn.ID: conn,
			}
			this.SendSelected(packets, connections, []string{})
		}
	case Struct.CMD_SAVE_INVENTORY:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.PlayerInventory
		json.Unmarshal(out, &params)
		this.Db.SavePlayerInventory(conn, params)
	}
}

// SavePlayerState...
func (this *World) SavePlayerState(conn *UserConn) {
	this.Db.SavePlayerState(conn)
}

// PlayerLeave... Игрок разорвал соединение с сервером
func (this *World) PlayerLeave(conn *UserConn) {
	log.Printf("Player leave %s (%s)", conn.Session.Username, conn.ID)
	// Unsubscribe from chunks
	for _, chunk := range this.Chunks {
		chunk.RemoveUserConn(conn)
	}
	// Delete from current connected list
	delete(this.Connections, conn.ID)
	// Notify about leave
	params := &Struct.ParamPlayerJoin{
		ID:       conn.ID,
		Skin:     conn.Skin,
		Nickname: conn.Session.Username,
	}
	packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_LEAVE, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.SendAll(packets, []string{conn.ID})

	// Write to chat about new player
	chatMessage := &Struct.ParamChatSendMessage{
		Nickname: "<SERVER>",
		Text:     conn.Session.Username + " вышел из игры",
	}
	packet2 := Struct.JSONResponse{Name: Struct.CMD_CHAT_SEND_MESSAGE, Data: chatMessage, ID: nil}
	packets2 := []Struct.JSONResponse{packet2}
	this.SendAll(packets2, []string{conn.ID})

}

//
func (this *World) ChunkGet(pos Struct.Vector3) *Chunk {
	//
	this.Mu.Lock()
	defer this.Mu.Unlock()
	//
	if val, ok := this.Chunks[pos]; ok {
		return val
	}
	this.Chunks[pos] = &Chunk{
		Pos:         pos,
		Connections: make(map[string]*UserConn, 0),
		World:       this,
		ModifyList:  make(map[string]Struct.BlockItem, 0),
	}
	this.Chunks[pos].Load()
	return this.Chunks[pos]
}

//
func (this *World) GetDir() string {
	ps := string(os.PathSeparator)
	dir, err := filepath.Abs("world" + ps + this.Properties.GUID)
	if err != nil {
		log.Println(1, err)
		return ""
	}
	err = os.MkdirAll(dir, os.ModePerm)
	if err != nil {
		log.Println(2, err)
		return ""
	}
	return dir
}

// GetFileName...
func (this *World) GetFileName() string {
	return this.GetDir() + "/attr.json"
}

// Отправить всем, кроме указанных
func (this *World) SendAll(packets []Struct.JSONResponse, exceptIDs []string) {
	for _, conn := range this.Connections {
		found := false
		for _, ID := range exceptIDs {
			if conn.ID == ID {
				found = true
				break
			}
		}
		if !found {
			conn.WriteJSON(packets)
		}
	}
}

// Отправить только указанным
func (this *World) SendSelected(packets []Struct.JSONResponse, connections map[string]*UserConn, exceptIDs []string) {
	for _, conn := range connections {
		found := false
		for _, ID := range exceptIDs {
			if conn.ID == ID {
				found = true
				break
			}
		}
		if !found {
			conn.WriteJSON(packets)
		}
	}
}
