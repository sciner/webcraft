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
	}
)

//
func (this *WorldMan) Get(world_guid string) *World {
	if val, ok := this.Worlds[world_guid]; ok {
		return val
	}
	//
	this.Worlds[world_guid] = &World{
		DBGame:      this.GameDB,
		Mu:          &sync.Mutex{},
		Connections: make(map[string]*UserConn, 0),
		Chunks:      make(map[Struct.Vector3]*Chunk, 0),
		Entities:    &EntityManager{},
	}
	this.Worlds[world_guid].Load(world_guid)
	return this.Worlds[world_guid]
}
