package repository

import "ya-tool-craft/internal/domain/entity"

type IGlobalScriptRepository interface {
	GetGlobalScript(userID entity.UserIDEntity) (*entity.GlobalScriptEntity, error)
	UpdateGlobalScript(userID entity.UserIDEntity, script string) error
}
