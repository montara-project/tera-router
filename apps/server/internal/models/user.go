package models

import "time"

type User struct {
	ID           string     `json:"id"`
	Fullname     string     `json:"fullname"`
	Email        string     `json:"email"`
	Phone        *string    `json:"phone"`
	Address      *string    `json:"address"`
	TokenVerify  *string    `json:"token_verify"`
	PasswordHash string     `json:"-"`
	IsActive     bool       `json:"is_active"`
	IsBlocked    bool       `json:"is_blocked"`
	RoleID       string     `json:"role_id"`
	Role         Role       `json:"role"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
}
