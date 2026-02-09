package global_script

import (
	"time"
	"ya-tool-craft/internal/domain/entity"
)

type GetGlobalScriptResponseDto struct {
	GlobalScript string    `json:"global_script"`
	UpdatedAt    time.Time `json:"updated_at" format:"date-time"`
}

func (dto *GetGlobalScriptResponseDto) FromEntity(scriptEntity entity.GlobalScriptEntity) {
	dto.GlobalScript = scriptEntity.Script
	dto.UpdatedAt = scriptEntity.UpdatedAt
}
