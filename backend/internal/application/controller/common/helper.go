package common

import (
	"strings"
	"ya-tool-craft/internal/error_code"
	"ya-tool-craft/internal/utils"

	"github.com/gin-gonic/gin"
)

func GetAccessTokenHeader(ctx *gin.Context) (string, error) {
	authHeader := ctx.GetHeader("Authorization")

	if utils.StringRemoveAllSpace(authHeader) == "" {
		return "", error_code.NewErrorWithErrorCodef(error_code.InvalidAccessToken, "Authorization header is empty")
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", error_code.NewErrorWithErrorCodef(error_code.InvalidAccessToken, "Authorization header format is invalid")
	}
	return strings.TrimPrefix(authHeader, "Bearer "), nil
}

func GetOptionalAccessTokenHeader(ctx *gin.Context) (token *string, err error) {
	authHeader := ctx.GetHeader("Authorization")

	if utils.StringRemoveAllSpace(authHeader) == "" {
		return nil, nil
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, error_code.NewErrorWithErrorCodef(error_code.InvalidAccessToken, "Authorization header format is invalid")
	}

	v := strings.TrimPrefix(authHeader, "Bearer ")
	return &v, nil
}
