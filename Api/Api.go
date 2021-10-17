package Api

import (
	"madcraft.io/madcraft/Api/server"
	"madcraft.io/madcraft/Type"
)

// Server ...
var Server server.APIServer

func Init(db *Type.GameDatabase, worlds Type.WorldMan) {
	Server = server.APIServer{}
	// User
	Server.Add("User", &User{
		Db: db,
	})
	// Game
	Server.Add("Game", &Game{
		Db: db,
	})
}
