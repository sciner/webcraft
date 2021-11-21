package Type

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"madcraft.io/madcraft/Struct"
)

const (
	CHUNK_SIZE_X int = 16
	CHUNK_SIZE_Y int = 40
	CHUNK_SIZE_Z int = 16
)

type (
	World struct {
		Properties       *Struct.WorldProperties
		Mu               *sync.Mutex            // чтобы избежать коллизий
		Connections      map[string]*PlayerConn // Registered connections.
		Chunks           map[Struct.Vector3]*Chunk
		Entities         *EntityManager
		Directory        string
		Db               *WorldDatabase
		DBGame           *GameDatabase
		Chat             *Chat
		ChunkModifieds   map[string]bool
		tickerWorldTimer chan bool // makes a world that run a periodic function
		Mobs             map[string]*Mob
		Admins           *WorldAdminManager
	}
)

type ParamMobAdded struct {
	Mobs map[string]*Mob `json:"mobs"`
}

/**
* Таймер
**/
func schedule(what func(), delay time.Duration) chan bool {
	stop := make(chan bool)
	go func() {
		i := 0
		for {
			if i > 0 {
				what()
			}
			i++
			select {
			case <-time.After(delay):
			case <-stop:
				return
			}
		}
	}()
	return stop
}

func (this *World) Load(guid string) {
	this.Properties = &Struct.WorldProperties{
		GUID: guid,
	}
	this.Directory = this.GetDir()
	this.Db = GetWorldDatabase(this.Directory + "/world.sqlite")
	//
	this.Db.Init()
	//
	err := this.RestoreModifiedChunks()
	//
	this.Chat = &Chat{
		World: this,
		Db:    this.Db,
	}
	this.Admins = &WorldAdminManager{
		World: this,
	}
	this.Admins.Load()
	//
	world_properties, err := this.Db.GetWorld(guid, this.DBGame) // DBGame
	if err != nil {
		log.Printf("ERROR10 LOAD WORLD: %v", err)
		return
	}
	this.Properties = world_properties
	this.updateWorldState()
	//
	this.Entities.Load(this)
	//
	this.tickerWorldTimer = schedule(func() {
		pn := this.getTimer()
		this.save()
		this.tick()
		// time elapsed forcurrent tick
		log.Printf("Tick took %sms", strconv.Itoa(int(this.getTimer()-pn)))
	}, 5000*time.Millisecond)
}

// Save player positions
func (this *World) save() {
	for _, conn := range this.Connections {
		this.Db.SavePlayerState(conn)
		conn.PositionChanged = false
	}
}

// Game tick
func (this *World) tick() {
}

// getTimer
func (this *World) getTimer() int64 {
	return time.Now().UnixNano() / int64(time.Millisecond)
}

func (this *World) updateWorldState() {
	currentTime := time.Now()
	// возраст в реальных секундах
	diff_sec := currentTime.Sub(this.Properties.Dt).Seconds()
	// один игровой день в реальных секундах
	game_day_in_real_seconds := float64(86400 / Struct.GAME_ONE_SECOND) // 1200
	// возраст в игровых днях
	age := diff_sec / game_day_in_real_seconds // например 215.23
	// возраст в ЦЕЛЫХ игровых днях
	this.Properties.State.Age = int64(math.Floor(age)) // например 215
	// количество игровых секунд прошедших в текущем игровом дне
	this.Properties.State.DayTime = int64((age - float64(this.Properties.State.Age)) * float64(Struct.GAME_DAY_SECONDS))
}

// OnPlayer...
func (this *World) OnPlayer(conn *PlayerConn) {
	// 1. Add new connection
	if val, ok := this.Connections[conn.ID]; ok {
		log.Printf("OnPlayer delete existing conn: %s", conn.ID)
		val.Close()
		delete(this.Connections, conn.ID)
	}
	log.Printf("OnPlayer add conn: %s", conn.ID)
	this.Connections[conn.ID] = conn
	// 2. Insert to DB if new player
	user_id, player_state, err := this.Db.RegisterUser(this, this.Connections[conn.ID], this.Properties.PosSpawn, true)
	if err != nil || user_id == 0 {
		log.Println("ERROR14: User not registered")
		return
	}
	// Fix player position
	if player_state.Pos.Y < 1 {
		player_state.Pos = player_state.PosSpawn
	}
	// 3.
	conn.PosSpawn = *player_state.PosSpawn
	//
	conn.Indicators = player_state.Indicators
	// 4. Send about all other players
	for _, c := range this.Connections {
		if c.ID != conn.ID {
			params := &Struct.ParamPlayerJoin{
				ID:       c.ID,
				Skin:     c.Skin,
				Username: c.Session.Username,
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
		Username: conn.Session.Username,
		Pos:      *player_state.Pos,
		Rotate:   *player_state.Rotate,
	}
	packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_JOIN, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	// this.SendAll(packets, []string{conn.ID})
	this.SendAll(packets, []string{})
	// 6. Write to chat about new player
	this.SendSystemChatMessage(conn.Session.Username+" подключился", []string{conn.ID})
	// 7. Send CMD_CONNECTED
	this.SendConnectedInfo(conn, player_state, this.Properties)
	// 8. Send all mobs in the world
	if len(this.Mobs) > 0 {
		packet_mobs := Struct.JSONResponse{Name: Struct.CMD_MOB_ADDED, Data: this.getMobsAsSlice(), ID: nil}
		packets_mobs := []Struct.JSONResponse{packet_mobs}
		this.SendAll(packets_mobs, []string{})
	}
}

// SendConnectedInfo
func (this *World) SendConnectedInfo(conn *PlayerConn, player_state *Struct.PlayerState, world_state *Struct.WorldProperties) {
	data := &Struct.ParamWorldState{
		Player: player_state,
		World:  world_state,
	}
	packet := Struct.JSONResponse{Name: Struct.CMD_CONNECTED, Data: data, ID: nil}
	packets := []Struct.JSONResponse{packet}
	conn.WriteJSON(packets)
}

// SendSystemChatMessage...
func (this *World) SendSystemChatMessage(message string, except_conn_id_list []string) {
	chatMessage := &Struct.ParamChatSendMessage{
		Username: "<SERVER>",
		Text:     message,
	}
	packet2 := Struct.JSONResponse{Name: Struct.CMD_CHAT_SEND_MESSAGE, Data: chatMessage, ID: nil}
	packets2 := []Struct.JSONResponse{packet2}
	this.SendAll(packets2, except_conn_id_list)
}

// SendSystemChatMessageToSelectedPlayers...
func (this *World) SendSystemChatMessageToSelectedPlayers(message string, connections map[string]*PlayerConn, exceptIDs []string) {
	chatMessage := &Struct.ParamChatSendMessage{
		Username: "<SERVER>",
		Text:     message,
	}
	packet2 := Struct.JSONResponse{Name: Struct.CMD_CHAT_SEND_MESSAGE, Data: chatMessage, ID: nil}
	packets2 := []Struct.JSONResponse{packet2}
	this.SendSelected(packets2, connections, exceptIDs)
}

//
func (this *World) GetChunkAddr(pos Struct.Vector3) Struct.Vector3 {
	v := Struct.Vector3{
		X: int(math.Floor(float64(pos.X) / float64(CHUNK_SIZE_X))),
		Y: int(math.Floor(float64(pos.Y) / float64(CHUNK_SIZE_Y))),
		Z: int(math.Floor(float64(pos.Z) / float64(CHUNK_SIZE_Z))),
	}
	return v
}

func (this *World) OnCommand(cmdIn Struct.Command, conn *PlayerConn) {

	switch cmdIn.Name {

	case Struct.CMD_BLOCK_SET:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamBlockSet
		json.Unmarshal(out, &params)
		// Ignore bedrock for non admin
		err := this.Admins.CheckIsAdmin(conn)
		if params.Item.ID != 1 || err == nil {
			chunkAddr := this.GetChunkAddr(params.Pos)
			chunk := this.ChunkGet(chunkAddr)
			if chunk.BlockSet(conn, params, false) {
				this.Db.BlockSet(conn, this, params)
				this.ChunkBecameModified(&chunkAddr)
			}
		}

	case Struct.CMD_CREATE_ENTITY:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamBlockSet
		json.Unmarshal(out, &params)
		chunkAddr := this.GetChunkAddr(params.Pos)
		chunk := this.ChunkGet(chunkAddr)
		chunk.BlockSet(conn, params, false)
		this.Db.BlockSet(conn, this, params)
		this.ChunkBecameModified(&chunkAddr)

	// Пользователь подгрузил чанк
	case Struct.CMD_CHUNK_ADD:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamChunkAdd
		json.Unmarshal(out, &params)
		chunk := this.LoadChunkForPlayer(conn, params.Pos)
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
		chunk.RemovePlayerConn(conn)
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
		params.Username = conn.Session.Username
		packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_STATE, Data: params, ID: nil}
		packets := []Struct.JSONResponse{packet}
		// Update local position
		this.ChangePlayerPosition(conn, params)
		this.SendAll(packets, []string{conn.ID})

	case Struct.CMD_LOAD_CHEST:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamLoadChest
		json.Unmarshal(out, &params)
		this.Entities.LoadChest(params, conn)

	case Struct.CMD_SET_CHEST_SLOT_ITEM:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamChestSetSlotItem
		json.Unmarshal(out, &params)
		this.Entities.SetChestSlotItem(this, conn, params)

	case Struct.CMD_CHANGE_POS_SPAWN:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamPosSpawn
		json.Unmarshal(out, &params)
		this.Db.ChangePosSpawn(conn, params)
		message := "Установлена точка возрождения " + strconv.Itoa(int(params.Pos.X)) + ", " + strconv.Itoa(int(params.Pos.Y)) + ", " + strconv.Itoa(int(params.Pos.Z))
		connections := map[string]*PlayerConn{
			conn.ID: conn,
		}
		this.SendSystemChatMessageToSelectedPlayers(message, connections, []string{})

	case Struct.CMD_TELEPORT_REQUEST:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamTeleportRequest
		json.Unmarshal(out, &params)
		this.TeleportPlayer(conn, params)

	case Struct.CMD_SAVE_INVENTORY:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.PlayerInventory
		json.Unmarshal(out, &params)
		this.Db.SavePlayerInventory(conn, params)

	case Struct.CMD_MODIFY_INDICATOR_REQUEST:
		out, _ := json.Marshal(cmdIn.Data)
		var params *Struct.ParamsModifyIndicatorRequest
		json.Unmarshal(out, &params)
		switch params.Indicator {
		case "live":
			conn.Indicators.Live.Value += params.Value
		case "food":
			conn.Indicators.Food.Value += params.Value
		case "oxygen":
			conn.Indicators.Oxygen.Value += params.Value
		}
		if params.Indicator == "live" && conn.Indicators.Live.Value <= 0 {
			conn.Indicators.Live.Value = 20
			this.TeleportPlayer(conn, &Struct.ParamTeleportRequest{
				PlaceID: "spawn",
			})
		}
		// notify player about his new indicators
		send_params := &Struct.ParamsEntityIndicator{
			Indicators: conn.Indicators,
		}
		json.Unmarshal(out, &conn.Indicators)
		packet := Struct.JSONResponse{Name: Struct.CMD_ENTITY_INDICATORS, Data: send_params, ID: nil}
		packets := []Struct.JSONResponse{packet}
		connections := map[string]*PlayerConn{
			conn.ID: conn,
		}
		this.SendSelected(packets, connections, []string{})
		// @todo notify all about change?

	case Struct.CMD_MOB_ADD:
		err := this.Admins.CheckIsAdmin(conn)
		if err == nil {
			out, _ := json.Marshal(cmdIn.Data)
			var params *Struct.ParamMobAdd
			json.Unmarshal(out, &params)
			params.Rotate.Z = conn.Rotate.Z
			this.AddMob(conn, params)
		}

	case Struct.CMD_MOB_DELETE:
		err := this.Admins.CheckIsAdmin(conn)
		if err == nil {
			out, _ := json.Marshal(cmdIn.Data)
			var params *Struct.ParamMobDelete
			json.Unmarshal(out, &params)
			if _, ok := this.Mobs[params.ID]; ok {
				delete(this.Mobs, params.ID)
				packet := Struct.JSONResponse{Name: Struct.CMD_MOB_DELETED, Data: []string{params.ID}, ID: nil}
				packets := []Struct.JSONResponse{packet}
				this.SendAll(packets, []string{})
			}
		}
	}
}

// AddMob...
func (this *World) AddMob(conn *PlayerConn, params *Struct.ParamMobAdd) {
	mob := &Mob{
		ID:         uuid.New().String(),
		Type:       params.Type,
		Skin:       params.Skin,
		Pos:        params.Pos,
		Rotate:     params.Rotate,
		Indicators: Struct.InitPlayerIndicators(),
		World:      this,
	}
	this.Mobs[mob.ID] = mob
	packet := Struct.JSONResponse{Name: Struct.CMD_MOB_ADDED, Data: []*Mob{mob}, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.SendAll(packets, []string{})
}

//
func (this *World) getMobsAsSlice() []*Mob {
	// Defines the Slice capacity to match the Map elements count
	mobs := make([]*Mob, 0, len(this.Mobs))
	for _, m := range this.Mobs {
		mobs = append(mobs, m)
	}
	return mobs
}

// TeleportPlayer
func (this *World) TeleportPlayer(conn *PlayerConn, params *Struct.ParamTeleportRequest) {
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
					X: float64(1000 + r1.Intn(2000000)),
					Y: 120,
					Z: float64(1000 + r1.Intn(2000000)),
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
		connections := map[string]*PlayerConn{
			conn.ID: conn,
		}
		this.SendSelected(packets, connections, []string{})
		//
		conn.Pos = *new_pos
		this.CheckPlayerVisibleChunks(conn, conn.ChunkRenderDist, true)
	}
}

// PlayerLeave... Игрок разорвал соединение с сервером
func (this *World) PlayerLeave(conn *PlayerConn) {
	log.Printf("Player leave %s (%s)", conn.Session.Username, conn.ID)
	// Unsubscribe from chunks
	for _, chunk := range this.Chunks {
		chunk.RemovePlayerConn(conn)
	}
	//
	this.save()
	// Delete from current connected list
	delete(this.Connections, conn.ID)
	// Notify about leave
	params := &Struct.ParamPlayerJoin{
		ID:       conn.ID,
		Skin:     conn.Skin,
		Username: conn.Session.Username,
	}
	packet := Struct.JSONResponse{Name: Struct.CMD_PLAYER_LEAVE, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.SendAll(packets, []string{conn.ID})
	// Write to chat about new player
	chatMessage := &Struct.ParamChatSendMessage{
		Username: "<SERVER>",
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
		Connections: make(map[string]*PlayerConn, 0),
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
func (this *World) SendSelected(packets []Struct.JSONResponse, connections map[string]*PlayerConn, exceptIDs []string) {
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

// RestoreModifiedChunks...
func (this *World) RestoreModifiedChunks() error {
	this.ChunkModifieds = make(map[string]bool)
	list, err := this.Db.ChunkBecameModified()
	if err != nil {
		return err
	}
	for _, vec := range list {
		this.ChunkBecameModified(vec)
	}
	return nil
}

// ChunkBecameModified...
func (this *World) ChunkBecameModified(vec *Struct.Vector3) {
	key := fmt.Sprintf("%v", vec)
	this.ChunkModifieds[key] = true
}

// ChunkHasModifiers...
func (this *World) ChunkHasModifiers(vec *Struct.Vector3) bool {
	key := fmt.Sprintf("%v", vec)
	return this.ChunkModifieds[key]
}

// ScanChunkFiles..
func (this *World) ScanChunkFiles() ([]string, error) {
	root := this.GetDir()
	var files []string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if !info.IsDir() {
			if strings.HasPrefix(info.Name(), "c_") {
				files = append(files, info.Name())
			}
		}
		return nil
	})
	return files, err
}

// LoadChunkForPlayer...
func (this *World) LoadChunkForPlayer(conn *PlayerConn, pos Struct.Vector3) *Chunk {
	// получим чанк
	chunk := this.ChunkGet(pos)
	//
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// запомним, что юзер в этом чанке
	chunk.AddPlayerConn(conn)
	return chunk
}

//
func (this *World) ChangePlayerPosition(conn *PlayerConn, params *Struct.ParamPlayerState) {
	if params.Pos.Y < 1 {
		this.TeleportPlayer(conn, &Struct.ParamTeleportRequest{
			PlaceID: "spawn",
		})
		return
	}
	conn.Pos = params.Pos
	conn.Rotate = params.Rotate
	conn.ChunkRenderDist = params.ChunkRenderDist
	conn.PositionChanged = true
	this.CheckPlayerVisibleChunks(conn, params.ChunkRenderDist, false)
}

// CheckPlayerVisibleChunks
func (this *World) CheckPlayerVisibleChunks(conn *PlayerConn, ChunkRenderDist int, force bool) {
	conn.ChunkPos = this.GetChunkAddr(*&Struct.Vector3{
		X: int(conn.Pos.X),
		Y: int(conn.Pos.Y),
		Z: int(conn.Pos.Z),
	})
	if force || !conn.ChunkPosO.Equal(conn.ChunkPos) {
		// чанки, находящиеся рядом с игроком, у которых есть модификаторы
		modified_chunks := []*Struct.Vector3{}
		x_rad := ChunkRenderDist + 5
		y_rad := 5
		z_rad := ChunkRenderDist + 5
		for x := -x_rad; x < x_rad; x++ {
			for y := -y_rad; y < y_rad; y++ {
				for z := -z_rad; z < z_rad; z++ {
					vec := &Struct.Vector3{
						X: conn.ChunkPos.X + x,
						Y: conn.ChunkPos.Y + y,
						Z: conn.ChunkPos.Z + z,
					}
					if this.ChunkHasModifiers(vec) {
						modified_chunks = append(modified_chunks, vec)
						// this.LoadChunkForPlayer(conn, *vec)
					}
				}
			}
		}
		// cnt := len(modified_chunks)
		// this.SendSystemChatMessage("Chunk changed to "+fmt.Sprintf("%v", conn.ChunkPos)+" ... "+strconv.Itoa(cnt), []string{})
		packet := Struct.JSONResponse{Name: Struct.CMD_NEARBY_MODIFIED_CHUNKS, Data: modified_chunks, ID: nil}
		packets := []Struct.JSONResponse{packet}
		connections := map[string]*PlayerConn{
			conn.ID: conn,
		}
		this.SendSelected(packets, connections, []string{})
		conn.ChunkPosO = conn.ChunkPos
	}
}

func (this *World) Destroy() {
	this.tickerWorldTimer <- true
}
