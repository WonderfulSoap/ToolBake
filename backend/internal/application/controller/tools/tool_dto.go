package tools

import (
	"time"
	"ya-tool-craft/internal/domain/entity"
)

type ToolDto struct {
	UID               string            `json:"uid" example:"tool-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
	ToolID            string            `json:"tool_id" example:"tool-123"`
	Name              string            `json:"name" example:"Sample Tool"`
	Namespace         string            `json:"namespace" example:"default"`
	Category          string            `json:"category" example:"analytics"`
	IsActivate        bool              `json:"is_activate" example:"true"`
	RealtimeExecution bool              `json:"realtime_execution" example:"false"`
	UiWidgets         string            `json:"ui_widgets" example:"[]"`
	Source            string            `json:"source" example:"// source code"`
	Description       string            `json:"description" example:"Simple tool"`
	ExtraInfo         map[string]string `json:"extra_info" example:"{\"key\":\"value\"}"`
	CreatedAt         time.Time         `json:"created_at" example:"2024-01-01T00:00:00Z"`
	UpdatedAt         time.Time         `json:"updated_at" example:"2024-01-01T00:00:00Z"`
}

func (t *ToolDto) FromEntity(tool entity.ToolEntity) {
	t.UID = tool.UniqueID
	t.ToolID = tool.ID
	t.Name = tool.Name
	t.Namespace = tool.Namespace
	t.Category = tool.Category
	t.IsActivate = tool.IsActivate
	t.RealtimeExecution = tool.RealtimeExecution
	t.UiWidgets = tool.UiWidgets
	t.Source = tool.Source
	t.Description = tool.Description
	t.ExtraInfo = copyExtraInfoMap(tool.ExtraInfo)
	t.CreatedAt = tool.CreatedAt
	t.UpdatedAt = tool.UpdatedAt
}

func copyExtraInfoMap(info map[string]string) map[string]string {
	if info == nil {
		return map[string]string{}
	}

	result := make(map[string]string, len(info))
	for k, v := range info {
		result[k] = v
	}
	return result
}
