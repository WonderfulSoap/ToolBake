package entity

import "time"

type GlobalScriptEntity struct {
	Script    string
	UpdatedAt time.Time
}

func NewGlobalScriptEntity(script string, updatedAt time.Time) GlobalScriptEntity {
	return GlobalScriptEntity{
		Script:    script,
		UpdatedAt: updatedAt,
	}
}
