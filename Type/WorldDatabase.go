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

	_ "github.com/mattn/go-sqlite3"
	"madcraft.io/madcraft/Struct"
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
	conn, err := sql.Open("sqlite3", filename)
	if err != nil {
		log.Printf("SQL_ERROR8: %v", err)
		return nil
	}
	return &WorldDatabase{
		Conn: conn,
		Mu:   &sync.Mutex{},
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
		Items:   make([]Struct.BlockItem, 0),
		Current: &Struct.PlayerInventoryCurrent{},
	}
	inventory_bytes, _ := json.Marshal(inventory)
	result, err := this.Conn.Exec("INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory) VALUES($1, $2, $3, $4, $5, $6, $7, $8)", conn.Session.UserID, conn.Session.UserGUID, conn.Session.Username, time.Now().Unix(), string(pos_bytes), string(pos_bytes), string(rotate_bytes), string(inventory_bytes))
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
	_, err := this.Conn.Query(`INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES ($1, $2, $3, $4, $5)`, conn.Session.UserID, time.Now().Unix(), params.Text, world.Properties.ID, 0)
	if err != nil {
		log.Printf("SQL_ERROR3: %v", err)
	}
}

// Установка блока
func (this *WorldDatabase) BlockSet(conn *UserConn, world *World, params *Struct.ParamBlockSet) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	user_session_id := 0
	params_json, _ := json.Marshal(params)
	_, err := this.Conn.Query(`INSERT INTO world_modify(user_id, dt, world_id, user_session_id, params, x, y, z) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, conn.Session.UserID, time.Now().Unix(), world.Properties.ID, user_session_id, params_json, params.Pos.X, params.Pos.Y, params.Pos.Z)
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
		result, err := this.Conn.Exec("INSERT INTO world(guid, title, seed, user_id, dt, generator, pos_spawn) VALUES($1, $2, $3, $4, $5, $6, $7)", world.GUID, world.Title, world.Seed, world.UserID, time.Now().Unix(), string(generator_out), string(pos_spawn_out))
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
	_, err := this.Conn.Query(`UPDATE user SET pos = $1, rotate = $2, dt_moved = $3 WHERE id = $4`, string(pos_json_bytes), string(rotate_json_bytes), time.Now().Unix(), conn.Session.UserID)
	if err != nil {
		log.Printf("SQL_ERROR12: %v", err)
	}
	return err
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
