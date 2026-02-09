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

func NewCreateToolController(
	config config.Config,
	toolRepository repository.IToolRepository,
	accessTokenHeaderValidator common.AccessTokenHeaderValidator,
	cache repository.ICache,
) router.Controller {
	return CreateToolController{
		config:                     config,
		toolRepository:             toolRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
		cache:                      cache,
	}
}

type CreateToolController struct {
	common.JsonResponse

	config                     config.Config
	toolRepository             repository.IToolRepository
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
	cache                      repository.ICache
}

func (c CreateToolController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/tools/create", Handler: c.Create},
	}
}

// @Summary		Create tool
// @Description	Create a custom tool under the authenticated user
// @Tags			Tools
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string					true	"Bearer access token"
// @Param			request			body		CreateToolRequestDto	true	"Tool definition"
// @Success		200				{object}	swagger.BaseSuccessResponse[CreateToolResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/tools/create [post]
func (c *CreateToolController) Create(ctx *gin.Context) {
	logger.Infof(ctx, "Create Tool requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	var req CreateToolRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf(ctx, "Invalid tool create payload: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	tool := req.ToEntity()

	if err := c.toolRepository.CreateTool(user.ID, tool); err != nil {
		logger.Errorf(ctx, "Failed to create tool for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected create tool error"))
		return
	}

	if err := c.cache.Delete(ctx, toolsCacheKey(user.ID)); err != nil {
		logger.Errorf(ctx, "Failed to delete cache for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected delete cache error"))
		return
	}

	logger.Infof(ctx, "Tool created successfully for user %s with tool id %s", user.ID, tool.ID)
	c.Success(ctx, "Tool created successfully", CreateToolResponseDto{})
}
