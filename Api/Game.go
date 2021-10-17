package Api

import (
	"encoding/json"
	"log"
	"net/http"

	"madcraft.io/madcraft/Struct"
	"madcraft.io/madcraft/Type"
)

// Game ...
type (
	Game struct {
		Db *Type.GameDatabase
	}
)

// CreateWorld... Создание нового мира (сервера)
func (this *Game) CreateWorld(req *http.Request, params map[string]interface{}) (*Type.WorldCreated, error) {
	session_id := req.Header.Get("x-session-id")
	session, err := this.Db.GetUserSession(session_id)
	if err != nil {
		return nil, err
	}
	generator := params["generator"].(map[string]interface{})
	generator_out, _ := json.Marshal(generator)
	seed := params["seed"].(string)
	title := params["title"].(string)
	id, guid, err := this.Db.InsertNewWorld(session.UserID, string(generator_out), seed, title)
	log.Println(id, guid, err)
	return &Type.WorldCreated{
		ID:        id,
		GUID:      guid,
		Generator: generator,
	}, err
}

// MyWorlds... Возвращает все сервера созданные мной и те, которые я себе добавил
func (this *Game) MyWorlds(req *http.Request, params map[string]interface{}) ([]*Struct.WorldProperties, error) {
	session_id := req.Header.Get("x-session-id")
	session, err := this.Db.GetUserSession(session_id)
	if err != nil {
		return nil, err
	}
	return this.Db.MyWorlds(session.UserID, true)
}

// JoinWorld... Присоединение к миру
func (this *Game) JoinWorld(req *http.Request, params map[string]interface{}) (*Struct.WorldProperties, error) {
	world_guid := params["world_guid"].(string)
	session_id := req.Header.Get("x-session-id")
	session, err := this.Db.GetUserSession(session_id)
	if err != nil {
		return nil, err
	}
	return this.Db.JoinWorld(session.UserID, world_guid, true)
}
