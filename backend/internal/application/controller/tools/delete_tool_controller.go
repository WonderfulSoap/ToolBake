package tools

import (
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

func NewDeleteToolController(
	config config.Config,
	toolRepository repository.IToolRepository,
	accessTokenHeaderValidator common.AccessTokenHeaderValidator,
	cache repository.ICache,
) router.Controller {
	return DeleteToolController{
		config:                     config,
		toolRepository:             toolRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
		cache:                      cache,
	}
}

type DeleteToolController struct {
	common.JsonResponse

	config                     config.Config
	toolRepository             repository.IToolRepository
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
	cache                      repository.ICache
}

func (c DeleteToolController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodDelete, Path: "/api/v1/tools/:tool_uid", Handler: c.Delete},
	}
}

// @Summary		Delete tool
// @Description	Delete a tool belonging to the authenticated user
// @Tags			Tools
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Param			tool_uid		path		string	true	"Tool unique identifier (UID)"
// @Success		200				{object}	swagger.BaseSuccessResponse[DeleteToolResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/tools/{tool_uid} [delete]
func (c *DeleteToolController) Delete(ctx *gin.Context) {
	logger.Infof(ctx, "Delete Tool requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	toolUID := ctx.Param("tool_uid")
	if toolUID == "" {
		logger.Errorf(ctx, "Invalid tool delete: tool_uid is required")
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "tool_uid is required"))
		return
	}

	if err := c.toolRepository.DeleteTool(user.ID, toolUID); err != nil {
		logger.Errorf(ctx, "Failed to delete tool %s for user %s: %v", toolUID, user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected delete tool error"))
		return
	}

	if err := c.cache.Delete(ctx, toolsCacheKey(user.ID)); err != nil {
		logger.Errorf(ctx, "Failed to delete cache for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected delete cache error"))
		return
	}

	logger.Infof(ctx, "Tool deleted successfully for user %s with tool uid %s", user.ID, toolUID)
	c.Success(ctx, "Tool deleted successfully", DeleteToolResponseDto{})
}
