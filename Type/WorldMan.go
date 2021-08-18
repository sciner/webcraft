package Type

import (
	"sync"

	"whiteframe.ru/webcraft/Struct"
)

type (
	// WorldMan ...
	WorldMan struct {
		Worlds map[string]*World // Registered connections.
	}
)

func (this *WorldMan) Get(ID string, Seed string) *World {
	if val, ok := this.Worlds[ID]; ok {
		return val
	}
	this.Worlds[ID] = &World{
		ID:          ID,
		Seed:        Seed,
		Mu:          &sync.Mutex{},
		Connections: make(map[string]*UserConn, 0),
		Chunks:      make(map[Struct.Vector3]*Chunk, 0),
		Entities:    &EntityManager{},
	}
	this.Worlds[ID].Entities.Load(this.Worlds[ID])
	return this.Worlds[ID]
}
