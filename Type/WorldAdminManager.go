package Type

import (
	"errors"
)

type (
	WorldAdminManager struct {
		List  []string
		World *World
	}
)

// Load
func (this *WorldAdminManager) Load() error {
	list, err := this.World.Db.LoadAdminList(this.World.Properties.ID)
	if err == nil {
		this.List = list
	}
	return err
}

// Add
func (this *WorldAdminManager) Add(conn *PlayerConn, username string) error {
	err := this.CheckIsAdmin(conn)
	if err != nil {
		return err
	}
	//
	_, original_username, err := this.World.Db.FindPlayer(this.World.Properties.ID, username)
	if err != nil {
		return err
	}
	err = this.World.Db.SetAdmin(this.World.Properties.ID, original_username, 1)
	if err != nil {
		return err
	}
	// Remove from array
	return this.Load()
}

// Remove
func (this *WorldAdminManager) Remove(conn *PlayerConn, username string) error {
	err := this.CheckIsAdmin(conn)
	if err != nil {
		return err
	}
	//
	user_id, original_username, err := this.World.Db.FindPlayer(this.World.Properties.ID, username)
	if err != nil {
		return err
	}
	if user_id == this.World.Properties.UserID {
		return errors.New("Can't remove owner")
	}
	err = this.World.Db.SetAdmin(this.World.Properties.ID, original_username, 0)
	if err != nil {
		return err
	}
	// Remove from array
	return this.Load()
}

// Check player is admin
func (this *WorldAdminManager) CheckIsAdmin(conn *PlayerConn) error {
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
