package tools

import (
	"fmt"
	"ya-tool-craft/internal/domain/entity"
)

func toolsCacheKey(userID entity.UserIDEntity) string {
	return fmt.Sprintf("tools:%s", userID)
}
