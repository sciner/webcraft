package Type

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

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

//
func (this *WorldDatabase) GetWorldID(world *World) int64 {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// Find existing world record
	// @todo
	rows, err := this.Conn.Query("SELECT id FROM world WHERE guid = $1", world.ID)
	if err != nil {
		log.Printf("SQL_ERROR7: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		err := rows.Scan(&world.IDInt)
		if err != nil {
			fmt.Println(err)
			continue
		}
		return world.IDInt
	}
	// Insert new world to Db
	result, err := this.Conn.Exec("INSERT INTO world(guid, title, seed, user_id, dt) VALUES($1, $2, $3, $4, $5)", world.ID, world.Seed, world.Seed, 0, time.Now().Unix())
	if err != nil {
		log.Printf("SQL_ERROR6: %v", err)
	}
	id, _ := result.LastInsertId() // id последнего добавленного объекта
	return id
}

//
func (this *WorldDatabase) GetUserID(conn *UserConn) int64 {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// Find existing world record
	// @todo
	rows, err := this.Conn.Query("SELECT id FROM user WHERE guid = $1", conn.ID)
	if err != nil {
		log.Printf("SQL_ERROR1: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var IDInt int64
		err := rows.Scan(&IDInt)
		if err != nil {
			fmt.Println(err)
			continue
		}
		return IDInt
	}
	// Insert new world to Db
	result, err := this.Conn.Exec("INSERT INTO user(id, guid, username, dt, skin) VALUES($1, $2, $3, $4, $5)", conn.Session.UserID, conn.Session.UserGUID, conn.Session.Username, time.Now().Unix(), conn.Skin)
	if err != nil {
		log.Printf("SQL_ERROR2: %v", err, conn.Session)
		log.Println(conn.Session.UserID, conn.Session.UserGUID, conn.Session.Username, time.Now().Unix(), conn.Skin)
	}
	id, _ := result.LastInsertId() // id последнего добавленного объекта
	return id
}

// Добавление сообщения в чат
func (this *WorldDatabase) InsertChatMessage(conn *UserConn, world *World, params *Struct.ParamChatSendMessage) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	_, err := this.Conn.Query(`INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES ($1, $2, $3, $4, $5)`, conn.Session.UserID, time.Now().Unix(), params.Text, world.IDInt, 0)
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
	_, err := this.Conn.Query(`INSERT INTO world_modify(user_id, dt, world_id, user_session_id, params, x, y, z) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, conn.Session.UserID, time.Now().Unix(), world.IDInt, user_session_id, params_json, params.Pos.X, params.Pos.Y, params.Pos.Z)
	if err != nil {
		log.Printf("SQL_ERROR4: %v", err)
	}
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
