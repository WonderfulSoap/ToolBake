package tools

import (
	"time"
	"ya-tool-craft/internal/domain/entity"

	"github.com/samber/lo"
)

type AllToolsResponseDto struct {
	Tools              []ToolDto `json:"tools"`
	ToolsLastUpdatedAt time.Time `json:"tools_last_update_at" format:"date-time"`
}

func (dto *AllToolsResponseDto) FromEntity(list entity.ToolsEntity) {
	dto.Tools = lo.Map(list.Tools, func(tool entity.ToolEntity, _ int) ToolDto {
		item := ToolDto{}
		item.FromEntity(tool)
		return item
	})

	dto.ToolsLastUpdatedAt = list.LastUpdatedAt
}
