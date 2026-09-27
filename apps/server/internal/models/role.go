package models

import "time"

type Role struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Role) TableName() string { return "roles" }
