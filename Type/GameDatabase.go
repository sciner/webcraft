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
	GameDatabase struct {
		Mu   *sync.Mutex // чтобы избежать коллизий
		Conn *sql.DB
	}
)

func copyFile(in, out string) (int64, error) {
	i, e := os.Open(in)
	if e != nil {
		return 0, e
	}
	defer i.Close()
	o, e := os.Create(out)
	if e != nil {
		return 0, e
	}
	defer o.Close()
	return o.ReadFrom(i)
}

func GetGameDatabase(filename string) *GameDatabase {
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
		log.Printf("%v", err)
		return nil
	}
	return &GameDatabase{
		Conn: conn,
		Mu:   &sync.Mutex{},
	}
}

//
func (this *GameDatabase) GetWorldID(world *World) int64 {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// Find existing world record
	// @todo
	rows, err := this.Conn.Query("SELECT rowid FROM world WHERE guid = $1", world.ID)
	if err != nil {
		log.Printf("%v", err)
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
		log.Printf("%v", err)
	}
	id, _ := result.LastInsertId() // id последнего добавленного объекта
	return id
}

//
func (this *GameDatabase) GetUserID(conn *UserConn) int64 {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// Find existing world record
	// @todo
	rows, err := this.Conn.Query("SELECT rowid FROM user WHERE guid = $1", conn.ID)
	if err != nil {
		log.Printf("%v", err)
	}
	defer rows.Close()
	for rows.Next() {
		err := rows.Scan(&conn.IDInt)
		if err != nil {
			fmt.Println(err)
			continue
		}
		return conn.IDInt
	}
	// Insert new world to Db
	result, err := this.Conn.Exec("INSERT INTO user(guid, username, dt, skin) VALUES($1, $2, $3, $4)", conn.ID, conn.Username, time.Now().Unix(), conn.Skin)
	if err != nil {
		log.Printf("%v", err)
	}
	id, _ := result.LastInsertId() // id последнего добавленного объекта
	return id
}

// Добавление сообщения в чат
func (this *GameDatabase) InsertChatMessage(conn *UserConn, world *World, params *Struct.ParamChatSendMessage) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	_, err := this.Conn.Query(`INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES ($1, $2, $3, $4, $5)`, conn.IDInt, time.Now().Unix(), params.Text, world.IDInt, 0)
	if err != nil {
		log.Printf("%v", err)
	}
}

// Установка блока
func (this *GameDatabase) BlockSet(conn *UserConn, world *World, params *Struct.ParamBlockSet) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	user_session_id := 0
	params_json, _ := json.Marshal(params)
	_, err := this.Conn.Query(`INSERT INTO world_modify(user_id, dt, world_id, user_session_id, params, x, y, z) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, conn.IDInt, time.Now().Unix(), world.IDInt, user_session_id, params_json, params.Pos.X, params.Pos.Y, params.Pos.Z)
	if err != nil {
		log.Printf("%v", err)
	}
}

// Сырой запрос в БД
func (this *GameDatabase) RAWQuery(sql_query string) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	_, err := this.Conn.Query(sql_query)
	if err != nil {
		log.Printf("%v", err)
	}
}
