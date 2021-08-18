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
func (this *UserConnMan) Connect(ID, username, skin string, Ws *websocket.Conn) *UserConn {
	if val, ok := this.Connections[ID]; ok {
		log.Printf("Used existing UserConn")
		val.Close()
		delete(this.Connections, ID)
	}
	this.Connections[ID] = &UserConn{
		ID:       ID,
		Username: username,
		Skin:     skin,
		Ws:       Ws,
	}
	log.Printf("Create new UserConn")
	go this.Connections[ID].Receiver()
	return this.Connections[ID]
}
