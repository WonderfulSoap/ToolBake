package repository

import (
	"time"
	"ya-tool-craft/internal/domain/entity"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_tool_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IToolRepository
type IToolRepository interface {
	CreateTool(userID entity.UserIDEntity, tool entity.ToolEntity) error
	UpdateTool(userID entity.UserIDEntity, tool entity.ToolEntity) error
	DeleteTool(userID entity.UserIDEntity, toolUID string) error

	AllTools(userID entity.UserIDEntity) (entity.ToolsEntity, error)
	ToolsLastUpdatedAt(userID entity.UserIDEntity) (*time.Time, error)
}
