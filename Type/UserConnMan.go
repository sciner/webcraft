package Type

import (
	"log"

	"github.com/gorilla/websocket"
)

var Worlds WorldMan

func init() {
	Worlds = WorldMan{
		Worlds: make(map[string]*World, 0),
	}
}

type (
	// UserConnMan ...
	UserConnMan struct {
		Connections map[string]*UserConn // Registered connections.
	}
)

// Run in goroutine
func (this *UserConnMan) Connect(DB *GameDatabase, session_id, skin string, Ws *websocket.Conn) *UserConn {
	//
	if val, ok := this.Connections[session_id]; ok {
		log.Printf("Used existing UserConn")
		val.Close()
		delete(this.Connections, session_id)
	}
	//
	session, err := DB.GetUserSession(session_id)
	if err != nil || session == nil {
		return nil
	}
	log.Println("Before new UserConn", session)
	//
	for _, conn := range this.Connections {
		if conn.Session.UserGUID == session.UserGUID {
			conn.Ws.Close()
			break
		}
	}
	//
	this.Connections[session_id] = &UserConn{
		Session: session,
		ID:      session.UserGUID,
		Skin:    skin,
		Ws:      Ws,
	}
	log.Printf("Create new UserConn")
	//
	go this.Connections[session_id].Receiver()
	return this.Connections[session_id]
}
