package Type

import (
	"database/sql"
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
	rows, err := this.Conn.Query("SELECT u.id user_id, u.username, u.guid FROM user_session s LEFT JOIN user u ON u.id = s.user_id WHERE token = $1 LIMIT 1", session_id)
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

// Сырой запрос в БД
func (this *GameDatabase) RAWQuery(sql_query string) {
	this.Mu.Lock()
	defer this.Mu.Unlock()
	_, err := this.Conn.Query(sql_query)
	if err != nil {
		log.Printf("SQL_ERROR10: %v", err)
	}
}
