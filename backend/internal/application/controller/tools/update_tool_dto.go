package tools

import (
	"time"
	"ya-tool-craft/internal/domain/entity"
)

type UpdateToolRequestDto struct {
	ID                string            `json:"id" binding:"min=1,max=128" example:"tool-123"`
	Name              string            `json:"name" binding:"omitempty,min=1,max=255" example:"Sample Tool"`
	Namespace         string            `json:"namespace" binding:"omitempty,min=1,max=255" example:"default"`
	IsActivate        bool              `json:"is_activate" example:"true"`
	RealtimeExecution bool              `json:"realtime_execution" example:"false"`
	UiWidgets         string            `json:"ui_widgets" example:"[]"`
	Source            string            `json:"source" example:"// source code"`
	Description       *string           `json:"description" example:"Describe the tool briefly"`
	ExtraInfo         map[string]string `json:"extra_info" example:"{\"key\":\"value\"}"`
	Category          *string           `json:"category" binding:"omitempty,max=255" example:"analytics"`
}

func (dto UpdateToolRequestDto) ToEntity(toolUID string) entity.ToolEntity {
	extraInfo := dto.ExtraInfo
	if extraInfo == nil {
		extraInfo = map[string]string{}
	}

	return entity.NewToolEntityWithUID(
		toolUID,
		dto.ID,
		dto.Name,
		dto.Namespace,
		stringValue(dto.Category),
		dto.IsActivate,
		dto.RealtimeExecution,
		dto.UiWidgets,
		dto.Source,
		stringValue(dto.Description),
		extraInfo,
		time.Time{}, // createdAt will not be updated by repository, so we can set it to zero value
		time.Time{}, // updatedAt will be set in repository
	)
}

type UpdateToolResponseDto struct{}
