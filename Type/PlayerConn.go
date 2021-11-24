package Type

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"madcraft.io/madcraft/Struct"
	"madcraft.io/madcraft/utils"
	"madcraft.io/madcraft/utils/conf"
)

type (
	// PlayerConn ...
	PlayerConn struct {
		Session          *Struct.PlayerSession
		World            *World
		ID               string // уникальный GUID пользователя
		Skin             string
		Rotate           Struct.Vector3f
		Pos              Struct.Vector3f
		PosSpawn         Struct.Vector3f
		PositionChanged  bool
		ChunkPos         Struct.Vector3
		ChunkPosO        Struct.Vector3
		ChunkRenderDist  int
		Ws               *websocket.Conn
		Mu               *sync.Mutex          // чтобы избежать коллизий записи в сокет
		Join             chan *websocket.Conn // Register requests from the connections.
		Time             time.Time            // Время соединения, time.Now()
		LastInPacketTime time.Time            // Время, когда была последняя активность от игрока по вебсокету
		Leave            chan *websocket.Conn // Unregister requests from connections.
		Closed           bool
		Indicators       *Struct.PlayerIndicators
	}
)

// Run in goroutine
func (this *PlayerConn) Close() {
	this.Closed = true
}

// Run in goroutine
func (this *PlayerConn) Receiver() {

	for {
		if this.Closed {
			goto Exit
		}
		_, command, err := this.Ws.ReadMessage()
		if err != nil {
			log.Println("************** PlayerConn.Receiver().ReadMessage() ERROR", err)
			goto Exit
		}
		// Входящая команда от пользователя на сервер
		// commandString := string(command)
		// log.Printf("commandString: " + commandString)
		// Command ... Входящая команда от пользователя на сервер
		// func (ur *UserRoom) Command(command string, uConn *PlayerConn) {
		var cmdIn Struct.Command
		err = json.Unmarshal([]byte(command), &cmdIn)
		if err == nil {
			this.LastInPacketTime = time.Now()
			// log.Println("-> CMD:", cmdIn.Name, "From:", this.ID)
			switch cmdIn.Name {
			case Struct.CMD_CONNECT:
				if this.World != nil {
					// @todo
					this.SendError(1, errors.New("error_already_connected_to_another_world"))
				} else {
					// разбор входных параметров
					out, _ := json.Marshal(cmdIn.Data)
					var param *Struct.CmdConnect
					json.Unmarshal(out, &param)
					log.Printf("Connect to world ID: %s", param.WorldGUID)
					//
					world, err := Worlds.Get(param.WorldGUID)
					if err != nil {
						this.SendError(1, err)
					} else {
						this.World = world
						this.World.OnPlayer(this)
					}
				}
			case Struct.CMD_PING:
				this.SendPong()
			case Struct.CMD_DATA:
				// do nothing
			default:
				if this.World == nil {
					// @todo
					log.Println("Сперва нужно войти в мир")
				} else {
					go this.World.OnCommand(cmdIn, this)
				}
			}
		} else {
			// @todo
			log.Println("Ошибка разбора входящей команды")
		}
	}
Exit:
	if this.World != nil {
		this.World.PlayerLeave(this)
	}
	this.Closed = true
}

func (this *PlayerConn) SendHello(world *World) {
	packet := Struct.JSONResponse{Name: Struct.CMD_HELLO, Data: "Welcome to `" + world.Properties.Title + "`. Game mode is `" + strings.ToLower(world.Properties.GameMode) + "`. World running on server " + conf.Config.AppCode + " ver. " + conf.Config.AppVersion, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.WriteJSON(packets)
}

func (this *PlayerConn) SendPong() {
	packet := Struct.JSONResponse{Name: Struct.CMD_PONG, Data: nil, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.WriteJSON(packets)
}

// SendError...
func (this *PlayerConn) SendError(code int, err error) {
	packets := utils.GenerateErrorPackets(code, fmt.Sprintf("%v", err))
	this.WriteJSON(packets)
}

// Отправка содержимого сундука
func (this *PlayerConn) SendChest(chest *Chest) {
	packet := Struct.JSONResponse{Name: Struct.CMD_CHEST_CONTENT, Data: chest, ID: nil}
	packets := []Struct.JSONResponse{packet}
	this.WriteJSON(packets)
}

func (this *PlayerConn) WriteJSON(packets []Struct.JSONResponse) {
	if this.Mu == nil {
		this.Mu = &sync.Mutex{}
		this.Time = time.Now()
	}
	this.Mu.Lock()
	defer this.Mu.Unlock()
	this.Ws.WriteJSON(packets)
}
