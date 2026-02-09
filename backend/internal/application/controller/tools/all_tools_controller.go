package tools

import (
	"encoding/json"
	"fmt"
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewAllToolsController(
	config config.Config,
	toolRepository repository.IToolRepository,
	accessTokenHeaderValidator common.AccessTokenHeaderValidator,
	cache repository.ICache,
) router.Controller {
	return AllToolsController{
		config:                     config,
		toolRepository:             toolRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
		cache:                      cache,
	}
}

type AllToolsController struct {
	common.JsonResponse

	config                     config.Config
	toolRepository             repository.IToolRepository
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
	cache                      repository.ICache
}

func (c AllToolsController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/tools", Handler: c.AllTools},
	}
}

// @Summary		List tools
// @Description	Retrieve all tools of the authenticated user
// @Tags			Tools
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[AllToolsResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/tools [get]
func (c *AllToolsController) AllTools(ctx *gin.Context) {
	logger.Infof(ctx, "List tools requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	// Try to get from cache first
	cacheKey := fmt.Sprintf("tools:%s", user.ID)
	cachedValue, found, err := c.cache.Get(ctx, cacheKey)
	if err != nil {
		logger.Errorf(ctx, "Failed to get cache for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected fetch tools from cache"))
		return
	}

	respJsonObjectStr := ""

	if found {
		// Cache hit: return cached JSON directly
		logger.Infof(ctx, "Cache hit for tools of user %s", user.ID)
		respJsonObjectStr = cachedValue
	} else {
		logger.Infof(ctx, "Cache miss for tools of user %s", user.ID)
		toolsEntity, err := c.toolRepository.AllTools(user.ID)
		if err != nil {
			logger.Errorf(ctx, "Failed to get tools for user %s: %v", user.ID, err)
			c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected fetch tools error"))
			return
		}

		var resp AllToolsResponseDto
		resp.FromEntity(toolsEntity)

		// Store result in cache as JSON string
		respJSON, err := json.Marshal(resp)
		if err != nil {
			logger.Warnf(ctx, "Failed to marshal tools response for cache for user %s: %v", user.ID, err)
			c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected marshal tools error"))
			return
		}
		if err := c.cache.Set(ctx, cacheKey, string(respJSON)); err != nil {
			logger.Warnf(ctx, "Failed to set cache for user %s: %v", user.ID, err)
			c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected set cache error"))
			return
		}
		respJsonObjectStr = string(respJSON)

	}

	c.SuccessWithCachedJsonString(ctx, "", respJsonObjectStr)
}
