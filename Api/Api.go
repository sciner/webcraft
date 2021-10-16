package Api

import (
	"madcraft.io/madcraft/Api/server"
	"madcraft.io/madcraft/Type"
)

// Server ...
var Server server.APIServer

func Init(db *Type.GameDatabase) {
	Server = server.APIServer{}
	Server.Add("User", &User{
		Db: db,
	})
}
