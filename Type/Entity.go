package Type

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"sync"
	"time"

	"whiteframe.ru/webcraft/Struct"
)

type (
	ChestSlot struct {
		ID       int     `json:"id"`
		Count    int     `json:"count"`
		Power    float32 `json:"power"`
		EntityID string  `json:"entity_id"`
	}
	EntityBlock struct {
		ID   string `json:"id"`
		Type string `json:"type"` // chest
	}
	// Chest ...
	Chest struct {
		UserID string             `json:"user_id"` // Кто автор
		Time   time.Time          `json:"time"`    // Время создания, time.Now()
		Item   Struct.BlockItem   `json:"item"`    // предмет
		Slots  map[int]*ChestSlot `json:"slots"`
	}
	EntityManager struct {
		Mu     *sync.Mutex             `json:"-"` // чтобы избежать коллизий
		Chests map[string]*Chest       `json:"chests"`
		Blocks map[string]*EntityBlock `json:"blocks"` // Блоки занятые сущностями (содержат ссылку на сущность) Внимание! В качестве ключа используется сериализованные координаты блока
		World  *World                  `json:"-"`
	}
)

// GetBlockKey
func (this *EntityManager) GetBlockKey(pos Struct.Vector3) string {
	return fmt.Sprintf("%d,%d,%d", pos.X, pos.Y, pos.Z)
}

// GenerateID...
func (this *EntityManager) GenerateID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		log.Fatal(err)
	}
	uuid := fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
	if _, ok := this.Chests[uuid]; ok {
		return this.GenerateID()
	}
	return uuid
}

// GetEntityByPos
func (this *EntityManager) GetEntityByPos(pos Struct.Vector3) (interface{}, string) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	blockPosKey := this.GetBlockKey(pos)
	if be, ok := this.Blocks[blockPosKey]; ok {
		// log.Println("Block occupied by another entity")
		switch be.Type {
		case "chest":
			return this.Chests[be.ID], be.Type
		}
	}
	return nil, ""
}

// CreateEntity...
func (this *EntityManager) CreateChest(params *Struct.ParamBlockSet, conn *UserConn) string {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	blockPosKey := this.GetBlockKey(params.Pos)
	if _, ok := this.Blocks[blockPosKey]; ok {
		log.Println("Block occupied by another entity")
		return ""
	}
	entity := &Chest{
		UserID: conn.ID,
		Time:   time.Now(),
		Item:   params.Item,
		Slots:  make(map[int]*ChestSlot, 27),
	}
	entity.Item.EntityID = this.GenerateID()
	this.Chests[entity.Item.EntityID] = entity
	this.Blocks[blockPosKey] = &EntityBlock{
		ID:   entity.Item.EntityID,
		Type: "chest",
	}
	this.Save()
	return entity.Item.EntityID
}

// LoadChest...
func (this *EntityManager) LoadChest(params *Struct.ParamLoadChest, conn *UserConn) {
	if chest, ok := this.Chests[params.EntityID]; ok {
		conn.SendChest(chest)
	}
}

// Получены новые данные о содержимом слоте сундука
func (this *EntityManager) SetChestSlotItem(params *Struct.ParamChestSetSlotItem, conn *UserConn) {
	if chest, ok := this.Chests[params.EntityID]; ok {
		this.Mu.Lock()
		defer this.Mu.Unlock()
		if params.Item.Count == 0 {
			delete(chest.Slots, params.SlotIndex)
		} else {
			chest.Slots[params.SlotIndex] = &ChestSlot{
				ID:       params.Item.ID,
				Count:    params.Item.Count,
				EntityID: params.Item.EntityID,
				Power:    params.Item.Power,
			}
		}
		this.Save()
	}
}

// GetFileName
func (this *EntityManager) GetFileName() string {
	ps := string(os.PathSeparator)
	dir := this.World.GetDir()
	return dir + ps + "entities.json"
}

// Load from file
func (this *EntityManager) Load(world *World) {
	this.World = world
	this.Mu = &sync.Mutex{}
	this.Mu.Lock()
	defer this.Mu.Unlock()
	this.Chests = make(map[string]*Chest, 0)
	this.Blocks = make(map[string]*EntityBlock, 0)
	// file, _ := json.Marshal(this.ModifyList)
	fileName := this.GetFileName()
	log.Println("Before load from " + fileName)
	s, err := ioutil.ReadFile(fileName)
	if err != nil {
		log.Printf("Error load entity from file `%s`", err)
		return
	}
	err = json.Unmarshal([]byte(s), &this)
	if err != nil {
		log.Printf("Error Unmarshal chunk `%s`", err)
		return
	}
}

// Save to file
func (this *EntityManager) Save() {
	file, _ := json.MarshalIndent(this, "", "\t")
	fileName := this.GetFileName()
	log.Println("Before save to " + fileName)
	_ = ioutil.WriteFile(fileName, file, 0644)
}
