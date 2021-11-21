package Type

import (
	"errors"
	"log"
)

type (
	WorldAdminManager struct {
		List  []string
		World *World
	}
)

// Add
func (this *WorldAdminManager) Add(conn *PlayerConn, username string) error {
	err := this.checkRights(conn)
	if err != nil {
		return err
	}
	// Check if already exists
	i := this.isUsernameExist(username)
	if i >= 0 {
		return errors.New("User already exists")
	}
	this.List = append(this.List, username)
	return nil
}

// Remove
func (this *WorldAdminManager) Remove(conn *PlayerConn, username string) error {
	err := this.checkRights(conn)
	if err != nil {
		return err
	}
	// Check if exists
	i := this.isUsernameExist(username)
	if i < 0 {
		return errors.New("User not found")
	}
	this.List = append(this.List[:i], this.List[i+1:]...)
	return nil
}

// Check permission for modify list
func (this *WorldAdminManager) checkRights(conn *PlayerConn) error {
	log.Println(conn.Session.UserID, this.World.Properties.UserID)
	if conn.Session.UserID == this.World.Properties.UserID {
		return nil
	}
	i := this.isUsernameExist(conn.Session.Username)
	if i < 0 {
		return errors.New("No permissions")
	}
	return nil
}

// Return list
func (this *WorldAdminManager) GetList() []string {
	return this.List
}

// Find
func (this *WorldAdminManager) isUsernameExist(str string) int {
	for i, v := range this.List {
		if v == str {
			return i
		}
	}
	return -1
}
