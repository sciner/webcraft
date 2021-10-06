package Type

import (
	"sync"

	"madcraft.io/madcraft/Struct"
)

type (
	// WorldMan ...
	WorldMan struct {
		Worlds map[string]*World // Registered connections
	}
)

func (this *WorldMan) Get(ID string, Seed string) *World {
	if val, ok := this.Worlds[ID]; ok {
		return val
	}
	//
	db_filename := "./world/" + ID + "/db.sqlite"
	//
	this.Worlds[ID] = &World{
		ID:          ID,
		Seed:        Seed,
		Db:          GetGameDatabase(db_filename),
		Mu:          &sync.Mutex{},
		Connections: make(map[string]*UserConn, 0),
		Chunks:      make(map[Struct.Vector3]*Chunk, 0),
		Entities:    &EntityManager{},
	}
	this.Worlds[ID].Load()
	return this.Worlds[ID]
}
