package Type

import (
	"fmt"
	"log"
	"sync"

	"madcraft.io/madcraft/Struct"
)

type (
	// Chunk ...
	Chunk struct {
		Pos         Struct.Vector3              `json:"-"`
		Connections map[string]*PlayerConn      `json:"-"` // Registered connections.
		World       *World                      `json:"-"`
		ModifyList  map[string]Struct.BlockItem `json:"modify_list"`
		Mu          *sync.Mutex                 `json:"-"` // чтобы избежать коллизий
	}
)

// AddPlayerConn...
func (this *Chunk) AddPlayerConn(conn *PlayerConn) bool {
	if _, ok := this.Connections[conn.ID]; ok {
		log.Println("AddPlayerConn ... exists", this.Pos)
		// return false
	}
	this.Connections[conn.ID] = conn
	// log.Println("AddPlayerConn ... OK", this.Pos)
	return true
}

// RemovePlayerConn...
func (this *Chunk) RemovePlayerConn(conn *PlayerConn) bool {
	if _, ok := this.Connections[conn.ID]; ok {
		delete(this.Connections, conn.ID)
		// log.Println("RemovePlayerConn ... true", this.Pos)
		return true
	}
	// log.Println("RemovePlayerConn ... false", this.Pos)
	return false
}

// Chunk loaded
func (this *Chunk) Loaded(conn *PlayerConn) bool {
	// log.Println("SendChunkLoaded", this.Pos)
	data := &Struct.CmdChunkState{
		Pos:        this.Pos,
		ModifyList: this.ModifyList,
	}
	packet := Struct.JSONResponse{Name: Struct.CMD_CHUNK_LOADED, Data: data, ID: nil}
	packets := []Struct.JSONResponse{packet}
	conn.WriteJSON(packets)
	return true
}

// GetBlockKey
func (this *Chunk) GetBlockKey(pos Struct.Vector3) string {
	return fmt.Sprintf("%d,%d,%d", pos.X, pos.Y, pos.Z)
}

// GetChunkKey
func (this *Chunk) GetChunkKey(pos Struct.Vector3) string {
	return fmt.Sprintf("c_%d_%d_%d", pos.X, pos.Y, pos.Z)
}

// Load from file
func (this *Chunk) Load() {
	this.Mu = &sync.Mutex{}
	ml, err := this.World.Db.LoadModifiers(this)
	if err != nil {
		log.Printf("Error: %v", err)
		return
	}
	this.ModifyList = ml
	if this.Pos.X == 181 && this.Pos.Y == 2 && this.Pos.Z == 174 {
		log.Printf("%s, ml.length = %d", this.GetChunkKey(this.Pos), len(ml))
	}
}

// BlockSet
func (this *Chunk) BlockSet(conn *PlayerConn, params *Struct.ParamBlockSet, notifyAuthor bool) bool {

	blockKey := this.GetBlockKey(params.Pos)

	// Если на этом месте есть сущность, тогда запретить ставить что-то на это место
	entity, entity_type := this.World.Entities.GetEntityByPos(params.Pos)
	if entity != nil {
		switch entity_type {
		case "chest":
			params.Item = entity.(*Chest).Item // this.ModifyList[blockKey]
		default:
			// этот случай ошибочный, такого не должно произойти
			params.Item = this.ModifyList[blockKey]
		}
		packet := Struct.JSONResponse{Name: Struct.CMD_BLOCK_SET, Data: params, ID: nil}
		packets := []Struct.JSONResponse{packet}
		cons := make(map[string]*PlayerConn, 0)
		cons[conn.ID] = conn
		this.World.SendSelected(packets, cons, []string{})
		return false
	}

	// Create entity
	switch params.Item.ID {
	case Struct.BLOCK_CHEST:
		params.Item.EntityID = this.World.Entities.CreateChest(this.World, conn, params)
		log.Println("CreateEntity", params.Item.EntityID)
		if len(params.Item.EntityID) == 0 {
			return false
		}
	}
	//
	this.Mu.Lock()
	defer this.Mu.Unlock()
	//
	this.ModifyList[blockKey] = params.Item
	log.Println("BlockSet", this.Pos, params.Pos, params.Item, conn.ID)
	// Send to users
	packet := Struct.JSONResponse{Name: Struct.CMD_BLOCK_SET, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	//if notifyAuthor {
	this.World.SendSelected(packets, this.Connections, []string{})
	//} else {
	//	this.World.SendSelected(packets, this.Connections, []string{conn.ID})
	//}
	return true
}
