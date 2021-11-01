package Type

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"sync"
	"time"

	// _ "github.com/mattn/go-sqlite3"
	"madcraft.io/madcraft/Struct"
	_ "modernc.org/sqlite"
)

type (
	// UserConn ...
	WorldDatabase struct {
		Mu   *sync.Mutex // чтобы избежать коллизий
		Conn *sql.DB
	}
)

func GetWorldDatabase(filename string) *WorldDatabase {
	//
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		log.Print("DB file not found", filename)
		// This will copy
		bytesWritten, err := copyFile("./world.sqlite3.template", filename)
		if err != nil || bytesWritten < 1 {
			log.Fatal(err)
		}
	}
	//
	conn, err := sql.Open("sqlite", filename)
	if err != nil {
		log.Printf("SQL_ERROR8: %v", err)
		return nil
	}
	return &WorldDatabase{
		Conn: conn,
		Mu:   &sync.Mutex{},
	}
}

// ChunkBecameModified...
func (this *WorldDatabase) ChunkBecameModified() ([]*Struct.Vector3, error) {
	//
	var resp []*Struct.Vector3
	//
	rows, err := this.Conn.Query("SELECT DISTINCT CAST(round(x / 16 - 0.5) AS INT) AS x, CAST(round(y / 32 - 0.5) AS INT) AS y, CAST(round(z / 16 - 0.5) AS INT) AS z FROM world_modify")
	if err != nil {
		log.Printf("SQL_ERROR41: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		addr := Struct.Vector3{}
		err := rows.Scan(&addr.X, &addr.Y, &addr.Z)
		if err != nil {
			fmt.Println(err)
			return resp, err
		}
		resp = append(resp, &addr)
	}
	return resp, nil
}

// LoadModifiers...
func (this *WorldDatabase) LoadModifiers(chunk *Chunk) (map[string]Struct.BlockItem, error) {
	//
	resp := make(map[string]Struct.BlockItem)
	//
	x := chunk.Pos.X * 16
	y := chunk.Pos.Y * 32
	z := chunk.Pos.Z * 16
	rows, err := this.Conn.Query("SELECT x, y, z, params, 1 as power, entity_id, extra_data FROM world_modify WHERE x >= $1 AND x < $2 AND y >= $3 AND y < $4 AND z >= $5 AND z < $6", x, x+CHUNK_SIZE_X, y, y+CHUNK_SIZE_Y, z, z+CHUNK_SIZE_Z)
	if err != nil {
		log.Printf("SQL_ERROR40: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var x int64
		var y int64
		var z int64
		item := &Struct.BlockItem{}
		item.Power = 1
		var params_string string
		var extra_data *string
		var entity_id *string
		err := rows.Scan(&x, &y, &z, &params_string, &item.Power, &entity_id, &extra_data)
		if err != nil {
			fmt.Println(err)
			return resp, err
		}
		//
		params := &Struct.BlockItem{}
		if err := json.Unmarshal([]byte(params_string), &params); err != nil {
			panic(err)
		}
		//
		if entity_id != nil {
			item.EntityID = string(*entity_id)
		}
		//
		if extra_data != nil {
			if err := json.Unmarshal([]byte(*extra_data), &item.ExtraData); err != nil {
				panic(err)
			}
		}
		//
		item.ID = params.ID
		item.Rotate = params.Rotate
		//
		pos := fmt.Sprintf("%d,%d,%d", x, y, z)
		resp[pos] = *item
	}
	return resp, nil
}

// Сырой запрос в БД
func (this *WorldDatabase) RAWQuery(sql_query string) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	_, err := this.Conn.Query(sql_query)
	if err != nil {
		log.Printf("SQL_ERROR5: %v", err)
	}
}

// RegisterUser... Возвращает игрока либо создает и возвращает его
func (this *WorldDatabase) RegisterUser(conn *UserConn, default_pos_spawn *Struct.Vector3f, lock bool) (int64, *Struct.PlayerState, error) {
	if lock {
		this.Mu.Lock()
		defer this.Mu.Unlock()
	}
	// Find existing world record
	player_state := &Struct.PlayerState{}
	// @todo
	rows, err := this.Conn.Query("SELECT id, inventory, pos, pos_spawn, rotate FROM user WHERE guid = $1", conn.ID)
	if err != nil {
		log.Printf("SQL_ERROR1: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var IDInt int64
		var inventory string
		var pos string
		var pos_spawn string
		var rotate string
		err := rows.Scan(&IDInt, &inventory, &pos, &pos_spawn, &rotate)
		if err != nil {
			fmt.Println(err)
			return 0, nil, err
		}
		// Pos
		err = json.Unmarshal([]byte(pos), &player_state.Pos)
		if err != nil {
			return 0, nil, err
		}
		// PosSpawn
		err = json.Unmarshal([]byte(pos_spawn), &player_state.PosSpawn)
		if err != nil {
			return 0, nil, err
		}
		// Rotate
		err = json.Unmarshal([]byte(rotate), &player_state.Rotate)
		if err != nil {
			return 0, nil, err
		}
		// Inventory
		err = json.Unmarshal([]byte(inventory), &player_state.Inventory)
		if err != nil {
			return 0, nil, err
		}
		//
		return IDInt, player_state, nil
	}
	// Insert new user to Db
	pos_bytes, _ := json.Marshal(default_pos_spawn)
	rotate_bytes, _ := json.Marshal(&Struct.Vector3f{
		X: 0,
		Y: 0,
		Z: math.Pi,
	})
	// Inventory
	inventory := &Struct.PlayerInventory{
		Items:   make([]*Struct.BlockItem, 0),
		Current: &Struct.PlayerInventoryCurrent{},
	}
	inventory_bytes, _ := json.Marshal(inventory)
	// result, err := this.Conn.Exec("INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory) VALUES($1, $2, $3, $4, $5, $6, $7, $8)", conn.Session.UserID, conn.Session.UserGUID, conn.Session.Username, time.Now().Unix(), string(pos_bytes), string(pos_bytes), string(rotate_bytes), string(inventory_bytes))
	query := `INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory) VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
	statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
	if err != nil {
		log.Printf("ERROR24: %v", err)
	}
	result, err := statement.Exec(conn.Session.UserID, conn.Session.UserGUID, conn.Session.Username, time.Now().Unix(), string(pos_bytes), string(pos_bytes), string(rotate_bytes), string(inventory_bytes))
	if err != nil || result == nil {
		log.Printf("SQL_ERROR2: %v", err)
		log.Println(conn.Session.UserID, conn.Session.UserGUID, conn.Session.Username, time.Now().Unix(), conn.Skin)
		return 0, nil, err
	}
	return this.RegisterUser(conn, default_pos_spawn, false)
}

// Добавление сообщения в чат
func (this *WorldDatabase) InsertChatMessage(conn *UserConn, world *World, params *Struct.ParamChatSendMessage) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// _, err := this.Conn.Query(`INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES ($1, $2, $3, $4, $5)`, conn.Session.UserID, time.Now().Unix(), params.Text, world.Properties.ID, 0)
	query := `INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES ($1, $2, $3, $4, $5)`
	statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
	if err != nil {
		log.Printf("ERROR25: %v", err)
	}
	_, err = statement.Exec(conn.Session.UserID, time.Now().Unix(), params.Text, world.Properties.ID, 0)
	if err != nil {
		log.Printf("SQL_ERROR3: %v", err)
	}
}

// Установка блока
func (this *WorldDatabase) BlockSet(conn *UserConn, world *World, params *Struct.ParamBlockSet) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	var null_string *string
	// user_session_id := conn.Session.SessionID
	params_json, _ := json.Marshal(params.Item)
	query := `INSERT INTO world_modify(user_id, dt, world_id, params, x, y, z, entity_id, extra_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	// Prepare statement. This is good to avoid SQL injections
	statement, err := this.Conn.Prepare(query)
	if err != nil {
		log.Printf("ERROR26: %v", err)
	}
	entity_id := null_string
	extra_data := null_string
	// Extra data
	if params.Item.ExtraData != nil {
		extra_data_bytes, _ := json.Marshal(params.Item.ExtraData)
		s := string(extra_data_bytes)
		extra_data = &s
	}
	// Entity ID
	if len(params.Item.EntityID) > 0 {
		entity_id = &params.Item.EntityID
	}
	_, err = statement.Exec(conn.Session.UserID, time.Now().Unix(), world.Properties.ID, params_json, params.Pos.X, params.Pos.Y, params.Pos.Z, entity_id, extra_data)
	if params.Item.ExtraData != nil {
		// @todo Update extra data
	}
	if err != nil {
		log.Printf("SQL_ERROR4: %v", err)
	}
}

// GetWorld... Возвращает мир по его GUID либо создает и возвращает его
func (this *WorldDatabase) GetWorld(world_guid string, DBGame *GameDatabase) (*Struct.WorldProperties, error) {
	rows, err := this.Conn.Query("SELECT id, guid, dt, title, seed, generator, pos_spawn FROM world WHERE guid = $1", world_guid)
	if err != nil {
		log.Printf("ERROR24: %v", err)
		return nil, err
	}
	defer rows.Close()
	world := &Struct.WorldProperties{}
	var generator string
	var pos_spawn string
	var unix_time int64
	for rows.Next() {
		if err := rows.Scan(&world.ID, &world.GUID, &unix_time, &world.Title, &world.Seed, &generator, &pos_spawn); err != nil {
			return nil, err
		}
	}
	//
	if world.ID == 0 {
		log.Println("World not found, insert new")
		world, err = DBGame.GetWorld(world_guid)
		if err != nil {
			log.Printf("Error55: %v", err)
			return nil, err
		}
		log.Println("World found in GameDB " + world.Seed)
		// Insert new world to Db
		generator_out, _ := json.Marshal(world.Generator)
		pos_spawn_out, _ := json.Marshal(world.PosSpawn)
		// result, err := this.Conn.Exec("INSERT INTO world(guid, title, seed, user_id, dt, generator, pos_spawn) VALUES($1, $2, $3, $4, $5, $6, $7)", world.GUID, world.Title, world.Seed, world.UserID, time.Now().Unix(), string(generator_out), string(pos_spawn_out))
		query := `INSERT INTO world(guid, title, seed, user_id, dt, generator, pos_spawn) VALUES($1, $2, $3, $4, $5, $6, $7)`
		statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
		if err != nil {
			log.Printf("ERROR27: %v", err)
		}
		result, err := statement.Exec(world.GUID, world.Title, world.Seed, world.UserID, time.Now().Unix(), string(generator_out), string(pos_spawn_out))
		if err != nil || result == nil {
			log.Printf("SQL_ERROR6: %v", err)
		}
		return this.GetWorld(world_guid, DBGame)
	}
	//
	world.Dt = time.Unix(unix_time, 0)
	// Generator
	err = json.Unmarshal([]byte(generator), &world.Generator)
	if err != nil {
		return nil, err
	}
	// PosSpawn
	err = json.Unmarshal([]byte(pos_spawn), &world.PosSpawn)
	if err != nil {
		return nil, err
	}
	//
	if world.ID < 1 {
		return nil, errors.New("World not found with GUID: " + world_guid)
	}
	return world, nil
}

// SavePlayerState...
func (this *WorldDatabase) SavePlayerState(conn *UserConn) error {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	pos_json_bytes, _ := json.Marshal(conn.Pos)
	rotate_json_bytes, _ := json.Marshal(conn.Rotate)
	query := `UPDATE user SET pos = $1, rotate = $2, dt_moved = $3 WHERE id = $4`
	statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
	if err != nil {
		log.Printf("SQL_ERROR12_2: %v", err)
	}
	_, err = statement.Exec(string(pos_json_bytes), string(rotate_json_bytes), time.Now().Unix(), conn.Session.UserID)
	if err != nil {
		log.Printf("SQL_ERROR12: %v", err)
	}
	return err
}

// ChangePosSpawn...
func (this *WorldDatabase) ChangePosSpawn(conn *UserConn, params *Struct.ParamPosSpawn) error {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	//
	pos_json_bytes, _ := json.Marshal(params.Pos)
	//
	query := `UPDATE user SET pos_spawn = $1 WHERE id = $2`
	statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
	if err != nil {
		log.Printf("SQL_ERROR30_2: %v", err)
	}
	_, err = statement.Exec(string(pos_json_bytes), conn.Session.UserID)
	if err != nil {
		log.Printf("SQL_ERROR31: %v", err)
	}
	conn.PosSpawn = params.Pos
	return err
}

// SavePlayerInventory...
func (this *WorldDatabase) SavePlayerInventory(conn *UserConn, inventory *Struct.PlayerInventory) error {
	inventory_bytes, _ := json.Marshal(inventory)
	//
	query := `UPDATE user SET inventory = $1 WHERE id = $2`
	statement, err := this.Conn.Prepare(query)
	if err != nil {
		log.Printf("SQL_ERROR32: %v", err)
	}
	_, err = statement.Exec(string(inventory_bytes), conn.Session.UserID)
	if err != nil {
		log.Printf("SQL_ERROR33: %v", err)
	}
	return err
}

// LoadWorldChests...
func (this *WorldDatabase) LoadWorldChests(world *World) (map[string]*Chest, map[string]*EntityBlock, error) {
	Chests := make(map[string]*Chest)       // `json:"chests"`
	Blocks := make(map[string]*EntityBlock) // `json:"blocks"` // Блоки занятые сущностями (содержат ссылку на сущность) Внимание! В качестве ключа используется сериализованные координаты блока

	rows, err := this.Conn.Query("SELECT x, y, z, dt, user_id, entity_id, item, slots FROM chest")
	if err != nil {
		log.Printf("SQL_ERROR42: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var x int64
		var y int64
		var z int64
		var dt int64
		var user_id int64
		var entity_id string
		var block_item_string string
		var slots_string string

		err := rows.Scan(&x, &y, &z, &dt, &user_id, &entity_id, &block_item_string, &slots_string)
		if err != nil {
			fmt.Println(err)
			return Chests, Blocks, err
		}

		// EntityBlock
		EntityBlock := &EntityBlock{
			ID:   entity_id,
			Type: "chest",
		}

		// Block item
		bi := &Struct.BlockItem{}
		if err := json.Unmarshal([]byte(block_item_string), &bi); err != nil {
			panic(err)
		}

		// slots
		slots := make(map[int]*ChestSlot)
		if err := json.Unmarshal([]byte(slots_string), &slots); err != nil {
			panic(err)
		}

		Chest := &Chest{
			UserID: user_id,          //  `json:"user_id"` // Кто автор
			Time:   time.Unix(dt, 0), // `json:"time"` // Время создания, time.Now()
			Item:   *bi,              // `json:"item"` // Предмет
			Slots:  slots,            // `json:"slots"`
		}

		pos := fmt.Sprintf("%d,%d,%d", x, y, z)

		Chests[entity_id] = Chest
		Blocks[pos] = EntityBlock

	}
	return Chests, Blocks, nil
}

// CreateChest...
func (this *WorldDatabase) CreateChest(conn *UserConn, pos *Struct.Vector3, chest *Chest) error {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	query := `INSERT INTO chest(dt, user_id, entity_id, item, slots, x, y, z) VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
	statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
	if err != nil {
		log.Printf("SQL_ERROR44: %v", err)
	}
	item_json_bytes, _ := json.Marshal(chest.Item)
	slots_json_bytes, _ := json.Marshal(chest.Slots)
	_, err = statement.Exec(time.Now().Unix(), conn.Session.UserID, chest.Item.EntityID, string(item_json_bytes), string(slots_json_bytes), pos.X, pos.Y, pos.Z)
	if err != nil {
		log.Printf("SQL_ERROR45: %v", err)
	}
	return err
}

// SaveChestSlots...
func (this *WorldDatabase) SaveChestSlots(chest *Chest) error {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	query := `UPDATE chest SET slots = $1 WHERE entity_id = $2`
	statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
	if err != nil {
		log.Printf("SQL_ERROR46: %v", err)
	}
	slots_json_bytes, _ := json.Marshal(chest.Slots)
	_, err = statement.Exec(string(slots_json_bytes), chest.Item.EntityID)
	if err != nil {
		log.Printf("SQL_ERROR47: %v", err)
	}
	return err
}
