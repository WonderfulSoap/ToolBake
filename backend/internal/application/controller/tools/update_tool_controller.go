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

func NewUpdateToolController(
	config config.Config,
	toolRepository repository.IToolRepository,
	accessTokenHeaderValidator common.AccessTokenHeaderValidator,
	cache repository.ICache,
) router.Controller {
	return UpdateToolController{
		config:                     config,
		toolRepository:             toolRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
		cache:                      cache,
	}
}

type UpdateToolController struct {
	common.JsonResponse

	config                     config.Config
	toolRepository             repository.IToolRepository
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
	cache                      repository.ICache
}

func (c UpdateToolController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPut, Path: "/api/v1/tools/:tool_uid", Handler: c.Update},
	}
}

// @Summary		Update tool
// @Description	Update an existing tool belonging to the authenticated user
// @Tags			Tools
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string					true	"Bearer access token"
// @Param			tool_uid		path		string					true	"Tool identifier"
// @Param			request			body		UpdateToolRequestDto	true	"Fields to update"
// @Success		200				{object}	swagger.BaseSuccessResponse[UpdateToolResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/tools/{tool_uid} [put]
func (c *UpdateToolController) Update(ctx *gin.Context) {
	logger.Infof(ctx, "Update Tool requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	toolUID := ctx.Param("tool_uid")
	if toolUID == "" {
		logger.Errorf(ctx, "Invalid tool update: tool_uid is required")
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "tool_uid is required"))
		return
	}

	var req UpdateToolRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf(ctx, "Invalid tool update payload: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	tool := req.ToEntity(toolUID)

	if err := c.toolRepository.UpdateTool(user.ID, tool); err != nil {
		logger.Errorf(ctx, "Failed to update tool %s for user %s: %v", toolUID, user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected update tool error"))
		return
	}

	if err := c.cache.Delete(ctx, toolsCacheKey(user.ID)); err != nil {
		logger.Errorf(ctx, "Failed to delete cache for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected delete cache error"))
		return
	}

	logger.Infof(ctx, "Tool updated successfully for user %s with tool uid %s", user.ID, toolUID)
	c.Success(ctx, "Tool updated successfully", UpdateToolResponseDto{})
}
