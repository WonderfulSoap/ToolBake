package repository

import "ya-tool-craft/internal/domain/entity"

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_global_script_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IGlobalScriptRepository
type IGlobalScriptRepository interface {
	GetGlobalScript(userID entity.UserIDEntity) (*entity.GlobalScriptEntity, error)
	UpdateGlobalScript(userID entity.UserIDEntity, script string) error
}
