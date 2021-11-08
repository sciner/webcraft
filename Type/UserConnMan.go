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
	// PlayerConnMan ...
	PlayerConnMan struct {
		Connections map[string]*PlayerConn // Registered connections.
	}
)

// Run in goroutine
func (this *PlayerConnMan) Connect(DB *GameDatabase, session_id, skin string, Ws *websocket.Conn) *PlayerConn {
	//
	if val, ok := this.Connections[session_id]; ok {
		log.Printf("Used existing PlayerConn")
		val.Close()
		delete(this.Connections, session_id)
	}
	//
	session, err := DB.GetPlayerSession(session_id)
	if err != nil || session == nil {
		return nil
	}
	log.Println("Before new PlayerConn", session)
	//
	for _, conn := range this.Connections {
		if conn.Session.UserGUID == session.UserGUID {
			conn.Ws.Close()
			break
		}
	}
	//
	this.Connections[session_id] = &PlayerConn{
		Session: session,
		ID:      session.UserGUID,
		Skin:    skin,
		Ws:      Ws,
	}
	log.Printf("Create new PlayerConn")
	//
	go this.Connections[session_id].Receiver()
	return this.Connections[session_id]
}
