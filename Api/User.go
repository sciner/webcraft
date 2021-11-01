package Api

import (
	"net/http"

	"madcraft.io/madcraft/Struct"
	"madcraft.io/madcraft/Type"
)

// User ...
type User struct {
	// Mu *sync.Mutex // чтобы избежать коллизий
	Db *Type.GameDatabase
}

// Registration ...Регистрация
func (this *User) Registration(req *http.Request, params map[string]interface{}) (int64, error) {
	username := params["username"].(string)
	password := params["password"].(string)
	id, err := this.Db.InsertNewUser(username, password)
	/*
		out, _ := json.Marshal(params["Info"])
		var ChannelInfo Struct.ChatInfo
		json.Unmarshal(out, &ChannelInfo)
	*/
	return id, err
}

// Login ...Авторизация
func (this *User) Login(req *http.Request, params map[string]interface{}) (*Struct.UserSession, error) {
	username := params["username"].(string)
	password := params["password"].(string)
	session, err := this.Db.LoginUser(username, password)
	return session, err
}
