package global_script

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

func NewGetGlobalScriptController(
	config config.Config,
	globalScriptRepository repository.IGlobalScriptRepository,
	accessTokenHeaderValidator common.AccessTokenHeaderValidator,
) router.Controller {
	return GetGlobalScriptController{
		config:                     config,
		globalScriptRepository:     globalScriptRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type GetGlobalScriptController struct {
	common.JsonResponse

	config                     config.Config
	globalScriptRepository     repository.IGlobalScriptRepository
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c GetGlobalScriptController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/global-script", Handler: c.GetGlobalScript},
	}
}

// @Summary		Get global script
// @Description	Retrieve the global script bound to the authenticated user
// @Tags			GlobalScript
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[GetGlobalScriptResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/global-script [get]
func (c *GetGlobalScriptController) GetGlobalScript(ctx *gin.Context) {
	logger.Infof(ctx, "Get global script requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	entity, err := c.globalScriptRepository.GetGlobalScript(user.ID)
	if err != nil {
		logger.Errorf(ctx, "Failed to load global script for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected fetch global script error"))
		return
	}

	if entity == nil {
		logger.Warnf(ctx, "Global script not found for user %s", user.ID)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.FileNotFound, "global script not found"))
		return
	}

	var resp GetGlobalScriptResponseDto
	resp.FromEntity(*entity)
	logger.Infof(ctx, "Global script retrieved successfully for user %s", user.ID)
	c.Success(ctx, "Global script retrieved successfully", resp)
}
