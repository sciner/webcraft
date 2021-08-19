package Type

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"whiteframe.ru/webcraft/Struct"
)

type (
	// Chunk ...
	Chunk struct {
		Pos         Struct.Vector3              `json:"-"`
		Connections map[string]*UserConn        `json:"-"` // Registered connections.
		World       *World                      `json:"-"`
		ModifyList  map[string]Struct.BlockItem `json:"modify_list"`
	}
)

func (this *Chunk) AddUserConn(conn *UserConn) bool {
	if _, ok := this.Connections[conn.ID]; ok {
		log.Println("AddUserConn ... exists", this.Pos)
		// return false
	}
	this.Connections[conn.ID] = conn
	// log.Println("AddUserConn ... OK", this.Pos)
	return true
}

func (this *Chunk) RemoveUserConn(conn *UserConn) bool {
	if _, ok := this.Connections[conn.ID]; ok {
		delete(this.Connections, conn.ID)
		// log.Println("RemoveUserConn ... true", this.Pos)
		return true
	}
	// log.Println("RemoveUserConn ... false", this.Pos)
	return false
}

// Chunk loaded
func (this *Chunk) Loaded(conn *UserConn) bool {
	// log.Println("SendChunkLoaded", this.Pos)
	data := &Struct.CmdChunkState{
		Pos:        this.Pos,
		ModifyList: this.ModifyList,
	}
	packet := Struct.JSONResponse{Name: Struct.EVENT_CHUNK_LOADED, Data: data, ID: nil}
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

// GetFileName
func (this *Chunk) GetFileName() string {
	ps := string(os.PathSeparator)
	dir := this.World.GetDir()
	chunkKey := this.GetChunkKey(this.Pos)
	return dir + ps + chunkKey + ".json"
}

// Load from file
func (this *Chunk) Load() {
	// file, _ := json.Marshal(this.ModifyList)
	fileName := this.GetFileName()
	//  log.Println("Before load from " + fileName)
	s, err := ioutil.ReadFile(fileName)
	if err != nil {
		// Chunk file not found
		// log.Printf("Error load chunk from file: %s", err)
		return
	}
	err = json.Unmarshal([]byte(s), &this.ModifyList)
	if err != nil {
		log.Println("Error Unmarshal chunk ", err)
		return
	}
	// log.Println("this.ModifyList", this.ModifyList)
}

// Save to file
func (this *Chunk) Save() {
	file, _ := json.Marshal(this.ModifyList)
	fileName := this.GetFileName()
	log.Println("Before save to " + fileName)
	_ = ioutil.WriteFile(fileName, file, 0644)
}

// BlockSet
func (this *Chunk) BlockSet(conn *UserConn, params *Struct.ParamBlockSet, notifyAuthor bool) bool {
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
		packet := Struct.JSONResponse{Name: Struct.CLIENT_BLOCK_SET, Data: params, ID: nil}
		packets := []Struct.JSONResponse{packet}
		cons := make(map[string]*UserConn, 0)
		cons[conn.ID] = conn
		this.World.SendSelected(packets, cons, []string{})
		return false
	}

	// Create entity
	switch params.Item.ID {
	case Struct.BLOCK_CHEST:
		params.Item.EntityID = this.World.Entities.CreateChest(params, conn)
		log.Println("CreateEntity", params.Item.EntityID)
		if len(params.Item.EntityID) == 0 {
			return false
		}
	}

	//
	this.ModifyList[blockKey] = params.Item
	log.Println("BlockSet", this.Pos, params.Pos, params.Item, conn.ID)
	// Save to file
	this.Save()
	// Send to users
	packet := Struct.JSONResponse{Name: Struct.CLIENT_BLOCK_SET, Data: params, ID: nil}
	packets := []Struct.JSONResponse{packet}
	//if notifyAuthor {
	this.World.SendSelected(packets, this.Connections, []string{})
	//} else {
	//	this.World.SendSelected(packets, this.Connections, []string{conn.ID})
	//}
	return true
}
