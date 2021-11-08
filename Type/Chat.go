package Type

import (
	"madcraft.io/madcraft/Struct"
)

type (
	// Chat ...
	Chat struct {
		World *World
		Db    *WorldDatabase
	}
)

func (this *Chat) SendMessage(conn *PlayerConn, world *World, params *Struct.ParamChatSendMessage) {
	params.Nickname = conn.Session.Username
	packet := Struct.JSONResponse{Name: Struct.CMD_CHAT_SEND_MESSAGE, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.Db.InsertChatMessage(conn, world, params)
	//
	this.World.SendAll(packets, []string{conn.ID})
}
