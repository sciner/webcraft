package Type

import (
	"madcraft.io/madcraft/Struct"
	_ "modernc.org/sqlite"
)

type (
	// Chat ...
	Chat struct {
		World *World
		Db    *WorldDatabase
	}
)

func (this *Chat) SendMessage(conn *UserConn, world *World, params *Struct.ParamChatSendMessage) {
	params.Nickname = conn.Session.Username
	packet := Struct.JSONResponse{Name: Struct.EVENT_CHAT_SEND_MESSAGE, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.Db.InsertChatMessage(conn, world, params)
	//
	this.World.SendAll(packets, []string{conn.ID})
}
