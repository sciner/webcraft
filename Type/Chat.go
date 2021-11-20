package Type

import (
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"

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
	// Command
	if params.Text[0:1] == "/" {
		err := this.runCmd(conn, world, params.Text)
		if err != nil {
			cons := make(map[string]*PlayerConn, 0)
			cons[conn.ID] = conn
			this.World.SendSystemChatMessageToSelectedPlayers(fmt.Sprintf("%v", err), cons, []string{})
		}
		return
	}
	// Simple message
	params.Username = conn.Session.Username
	packet := Struct.JSONResponse{Name: Struct.CMD_CHAT_SEND_MESSAGE, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.Db.InsertChatMessage(conn, world, params)
	this.World.SendAll(packets, []string{conn.ID})
}

func (this *Chat) runCmd(conn *PlayerConn, world *World, original_text string) error {
	text := strings.Join(strings.Fields(original_text), " ")
	tmp := strings.Split(text, " ")
	cmd := strings.ToLower(tmp[0])
	log.Println("text: " + text)
	switch cmd {
	case "/spawnmob":
		{
			args, err := this.parseCMD(tmp, []string{"string", "?int", "?int", "?int", "string", "string"})
			if err != nil {
				return err
			}
			// Correct format
			log.Println("Correct format", args)
			params := &Struct.ParamMobAdd{}
			// X
			if args[1] == nil {
				params.Pos.X = conn.Pos.X
			} else {
				params.Pos.X, _ = strconv.ParseFloat(fmt.Sprint(args[1]), 64)
			}
			// Y
			if args[2] == nil {
				params.Pos.Y = conn.Pos.Y
			} else {
				params.Pos.Y, _ = strconv.ParseFloat(fmt.Sprint(args[2]), 64)
			}
			// Z
			if args[3] == nil {
				params.Pos.Z = conn.Pos.Z
			} else {
				params.Pos.Z, _ = strconv.ParseFloat(fmt.Sprint(args[3]), 64)
			}
			//
			params.Type = fmt.Sprint(args[4])
			params.Skin = fmt.Sprint(args[5])
			world.AddMob(conn, params)
		}
	}
	return nil
}

// parseCMD...
func (this *Chat) parseCMD(args, format []string) ([]interface{}, error) {
	resp := make([]interface{}, 0)
	if len(args) != len(format) {
		return nil, errors.New("Invalid arguments count")
	}
	for i, ch := range args {
		switch format[i] {
		case "int":
			{
				value, err := strconv.Atoi(ch)
				if err != nil {
					return resp, errors.New("Invalid arg pos = " + strconv.Itoa(i))
				}
				resp = append(resp, value)
			}
		case "?int":
			{
				value, err := strconv.Atoi(ch)
				if err == nil {
					resp = append(resp, value)
				} else {
					if ch == "~" {
						resp = append(resp, nil)
					} else {
						return resp, errors.New("Invalid arg pos = " + strconv.Itoa(i))
					}
				}
			}
		case "string":
			{
				if value, err := strconv.Atoi(ch); err == nil {
					resp = append(resp, value)
				} else {
					resp = append(resp, string(ch))
				}

			}
		}
	}
	return resp, nil
}
