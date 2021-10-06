package Type

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"madcraft.io/madcraft/Struct"
)

type (
	// UserConn ...
	GameDatabase struct {
		Conn *sql.DB
	}
)

func (this *GameDatabase) Open() {
	//
	conn, err := sql.Open("sqlite", "db.sqlite3")
	if err != nil {
		log.Printf("%v", err)
		return
	}
	this.Conn = conn
}

//
func (this *GameDatabase) GetWorldID(world *World) int64 {
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

//
func (this *GameDatabase) InsertChatMessage(conn *UserConn, world *World, params *Struct.ParamChatSendMessage) {
	_, err := this.Conn.Query(`INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES ($1, $2, $3, $4, $5)`, conn.IDInt, time.Now().Unix(), params.Text, world.IDInt, 0)
	if err != nil {
		log.Printf("%v", err)
	}
}
