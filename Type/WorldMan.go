package Type

import (
	"sync"

	"madcraft.io/madcraft/Struct"
)

type (
	// WorldMan ...
	WorldMan struct {
		GameDB *GameDatabase
		Worlds map[string]*World // Registered connections
		Models *ModelManager
		Blocks *BlockManager
	}
)

//
func (this *WorldMan) Init() {
	this.Worlds = make(map[string]*World, 0)
	this.Models = &ModelManager{}
	this.Blocks = &BlockManager{}
	this.Models.Init()
	this.Blocks.Init()
}

// Return loaded world or load and return
func (this *WorldMan) Get(world_guid string) (*World, error) {
	if val, ok := this.Worlds[world_guid]; ok {
		return val, nil
	}
	//
	this.Worlds[world_guid] = &World{
		DBGame:      this.GameDB,
		Mu:          &sync.Mutex{},
		Connections: make(map[string]*PlayerConn, 0),
		Chunks:      make(map[Struct.Vector3]*Chunk, 0),
		Entities:    &EntityManager{},
		Mobs:        make(map[string]*Mob, 0),
	}
	this.Worlds[world_guid].Load(world_guid)
	return this.Worlds[world_guid], nil
}
