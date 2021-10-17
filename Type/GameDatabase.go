package Type

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"madcraft.io/madcraft/Struct"
	// "encoding/json"
)

type (
	// GameDatabase ...
	GameDatabase struct {
		Mu   *sync.Mutex // чтобы избежать коллизий
		Conn *sql.DB
	}
)

func GetGameDatabase(filename string) *GameDatabase {
	//
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		log.Print("DB file not found", filename)
		// This will copy
		bytesWritten, err := copyFile("./game.sqlite3.template", filename)
		if err != nil || bytesWritten < 1 {
			log.Fatal(err)
		}
	}
	//
	conn, err := sql.Open("sqlite", filename)
	if err != nil {
		log.Printf("%v", err)
		return nil
	}
	return &GameDatabase{
		Conn: conn,
		Mu:   &sync.Mutex{},
	}
}

// Регистрация нового пользователя
func (this *GameDatabase) InsertNewUser(username, password string) (int64, error) {
	//
	if this.UserExists(username) {
		return 0, errors.New("error_user_already_registered")
	}
	//
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// result, err := this.Conn.Query(`INSERT INTO user(dt, guid, username, password) VALUES ($1, $2, $3, $4)`, time.Now().Unix(), uuid.New().String(), username, password)
	result, err := this.Conn.Exec(`INSERT INTO user(dt, guid, username, password) VALUES ($1, $2, $3, $4)`, time.Now().Unix(), uuid.New().String(), username, password)
	if err != nil {
		fmt.Println(err)
		log.Printf("Error: %s | %v", err.Error(), result)
		return 0, err
	} else {
		log.Printf("INSERTED %s", username)
		return result.LastInsertId()
	}
}

// UserExists...
func (this *GameDatabase) UserExists(username string) bool {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	rows, err := this.Conn.Query("SELECT id FROM user WHERE username = $1 LIMIT 1", username)
	if err != nil {
		log.Printf("%v", err)
		return false
	}
	defer rows.Close()
	for rows.Next() {
		return true
	}
	return false
}

// LoginUser...
func (this *GameDatabase) LoginUser(username, password string) (*Struct.UserSession, error) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	rows, err := this.Conn.Query("SELECT id, username, password FROM user WHERE username = $1 LIMIT 1", username)
	if err != nil {
		log.Printf("%v", err)
		return nil, err
	}
	defer rows.Close()
	session := &Struct.UserSession{}
	exists_password := ""
	for rows.Next() {
		if err := rows.Scan(&session.UserID, &session.Username, &exists_password); err != nil {
			return nil, err
		}
	}
	if exists_password != password {
		return nil, errors.New("error_invalid_login_or_password")
	}
	if session.UserID > 0 {
		session.SessionID, _ = this.CreateUserSession(session.UserID)
		return session, nil
	}
	return nil, err
}

// Регистрация новой сессии пользователя
func (this *GameDatabase) CreateUserSession(user_id int64) (string, error) {
	token := uuid.New().String()
	result, err := this.Conn.Exec(`INSERT INTO user_session(dt, user_id, token) VALUES ($1, $2, $3)`, time.Now().Unix(), user_id, token)
	if err != nil {
		fmt.Println(err)
		log.Printf("Error: %s | %v", err.Error(), result)
		return "", err
	} else {
		return token, nil
	}
}

// GetUserSession...
func (this *GameDatabase) GetUserSession(session_id string) (*Struct.UserSession, error) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	rows, err := this.Conn.Query("SELECT u.id AS user_id, u.username, u.guid FROM user_session s LEFT JOIN user u ON u.id = s.user_id WHERE token = $1 LIMIT 1", session_id)
	if err != nil {
		log.Printf("SQL_ERROR9: %v", err)
		return nil, err
	}
	defer rows.Close()
	session := &Struct.UserSession{}
	for rows.Next() {
		if err := rows.Scan(&session.UserID, &session.Username, &session.UserGUID); err != nil {
			return nil, err
		}
	}
	//
	if session.UserID > 0 {
		session.SessionID = session_id
		return session, nil
	}
	return nil, err
}

// Создание нового мира (сервера)
func (this *GameDatabase) InsertNewWorld(user_id int64, generator, seed, title string) (int64, string, error) {
	//
	this.Mu.Lock()
	defer this.Mu.Unlock()
	guid := uuid.New().String()
	pos_spawn_bytes, _ := json.Marshal(&Struct.Vector3f{
		X: 2895.7,
		Y: 67,
		Z: 2783.06,
	})
	result, err := this.Conn.Exec(`INSERT INTO world(dt, guid, user_id, title, seed, generator, pos_spawn) VALUES ($1, $2, $3, $4, $5, $6, $7)`, time.Now().Unix(), guid, user_id, title, seed, generator, string(pos_spawn_bytes))
	if err != nil || result == nil {
		fmt.Println(err)
		log.Printf("Error InsertNewWorld: %s; Result: %v", err.Error(), result)
		return 0, "", err
	} else {
		log.Printf("WORLD INSERTED: %s(seed: %s, guid: %s)", title, seed, guid)
		world_id, err := result.LastInsertId()
		this.InsertWorldPlayer(world_id, user_id, false)
		return world_id, guid, err
	}
}

// Присоединение к миру
func (this *GameDatabase) JoinWorld(user_id int64, world_guid string) (*Struct.WorldProperties, error) {
	//
	this.Mu.Lock()
	defer this.Mu.Unlock()
	// 1. find world
	world_id, err := this.GetWorldID(world_guid)
	if err != nil {
		log.Printf("%v", err)
		return nil, err
	}
	// 2. check already joined
	world_player_id, err := this.PlayerExistsInWorld(world_id, user_id)
	if err != nil {
		return nil, err
	}
	if world_player_id > 0 {
		return nil, errors.New("error_player_exists_in_selected_world")
	}
	// 3. insert player to world
	this.InsertWorldPlayer(world_id, user_id, false)
	// 4. return WorldProperties
	worlds, err := this.MyWorlds(user_id, false)
	if err != nil {
		return nil, err
	}
	//
	for _, world := range worlds {
		if world.ID == world_id {
			return world, nil
		}
	}
	return nil, errors.New("World player not found")
}

// GetWorld... Возвращает мир по его GUID
func (this *GameDatabase) GetWorld(world_guid string) (*Struct.WorldProperties, error) {
	rows, err := this.Conn.Query("SELECT id, guid, dt, title, seed, generator, user_id, pos_spawn FROM world WHERE guid = $1", world_guid)
	if err != nil {
		log.Printf("%v", err)
		return nil, err
	}
	defer rows.Close()
	world := &Struct.WorldProperties{}
	var generator string
	var pos_spawn string
	var unix_time int64
	for rows.Next() {
		if err := rows.Scan(&world.ID, &world.GUID, &unix_time, &world.Title, &world.Seed, &generator, &world.UserID, &pos_spawn); err != nil {
			return nil, err
		}
	}
	//
	if world.ID == 0 {
		return nil, errors.New("World not found")
	}
	//
	world.Dt = time.Unix(unix_time, 0)
	// Generator
	err = json.Unmarshal([]byte(generator), &world.Generator)
	if err != nil {
		return nil, err
	}
	// PosSpawn
	err = json.Unmarshal([]byte(pos_spawn), &world.PosSpawn)
	if err != nil {
		return nil, err
	}
	//
	if world.ID < 1 {
		return nil, errors.New("World not found with GUID: " + world_guid)
	}
	return world, nil
}

// GetWorldID... Возвращает ID мира по его GUID
func (this *GameDatabase) GetWorldID(world_guid string) (int64, error) {
	rows, err := this.Conn.Query("SELECT w.id FROM world AS w WHERE w.guid = $1", world_guid)
	if err != nil {
		log.Printf("%v", err)
		return 0, err
	}
	defer rows.Close()
	var world_id int64
	for rows.Next() {
		if err := rows.Scan(&world_id); err != nil {
			return 0, err
		}
	}
	if world_id < 1 {
		return 0, errors.New("World not found with GUID: " + world_guid)
	}
	return world_id, nil
}

// Проверяет нахождение игрока в мире
func (this *GameDatabase) PlayerExistsInWorld(world_id, user_id int64) (int64, error) {
	rows, err := this.Conn.Query("SELECT wp.id FROM world_player AS wp WHERE wp.world_id = $1 AND wp.user_id = $2", world_id, user_id)
	if err != nil {
		log.Printf("%v", err)
		return 0, err
	}
	defer rows.Close()
	var world_player_id int64
	for rows.Next() {
		if err := rows.Scan(&world_player_id); err != nil {
			return 0, err
		}
	}
	if world_id < 1 {
		return 0, errors.New("World player not found")
	}
	return world_player_id, nil
}

// Добавление игрока в мир
func (this *GameDatabase) InsertWorldPlayer(world_id, user_id int64, lock bool) (int64, error) {
	//
	if lock {
		this.Mu.Lock()
		defer this.Mu.Unlock()
	}
	result, err := this.Conn.Exec(`INSERT INTO world_player(dt, world_id, user_id) VALUES ($1, $2, $3)`, time.Now().Unix(), world_id, user_id)
	if err != nil || result == nil {
		fmt.Println(err)
		log.Printf("Error InsertNewWorld: %s; Result: %v", err.Error(), result)
		return 0, err
	} else {
		id, err := result.LastInsertId()
		log.Printf("WORLD PLAYER INSERTED: %d", id)
		return id, err
	}
}

// Возвращает все сервера созданные мной и те, которые я себе добавил
func (this *GameDatabase) MyWorlds(user_id int64, lock bool) ([]*Struct.WorldProperties, error) {
	if lock {
		this.Mu.Lock()
		defer this.Mu.Unlock()
	}
	rows, err := this.Conn.Query("SELECT w.id, w.dt, w.guid, w.title, w.seed, w.generator FROM world_player AS wp LEFT JOIN world w ON w.id = wp.world_id WHERE wp.user_id = $1", user_id)
	if err != nil {
		log.Printf("%v", err)
		return nil, err
	}
	defer rows.Close()
	result := []*Struct.WorldProperties{}
	for rows.Next() {
		world := &Struct.WorldProperties{}
		var unix_time int64
		var generator string
		if err := rows.Scan(&world.ID, &unix_time, &world.GUID, &world.Title, &world.Seed, &generator); err != nil {
			return nil, err
		}
		world.Dt = time.Unix(unix_time, 0)
		err = json.Unmarshal([]byte(generator), &world.Generator)
		result = append(result, world)
	}
	return result, nil
}

// Сырой запрос в БД
func (this *GameDatabase) RAWQuery(sql_query string) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	_, err := this.Conn.Query(sql_query)
	if err != nil {
		log.Printf("SQL_ERROR10: %v", err)
	}
}
