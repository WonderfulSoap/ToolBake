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

func NewUpdateGlobalScriptController(
	config config.Config,
	globalScriptRepository repository.IGlobalScriptRepository,
	accessTokenHeaderValidator common.AccessTokenHeaderValidator,
) router.Controller {
	return UpdateGlobalScriptController{
		config:                     config,
		globalScriptRepository:     globalScriptRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type UpdateGlobalScriptController struct {
	common.JsonResponse

	config                     config.Config
	globalScriptRepository     repository.IGlobalScriptRepository
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c UpdateGlobalScriptController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPut, Path: "/api/v1/global-script", Handler: c.UpdateGlobalScript},
	}
}

// @Summary		Update global script
// @Description	Create or update the global script for the authenticated user
// @Tags			GlobalScript
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string							true	"Bearer access token"
// @Param			request			body		UpdateGlobalScriptRequestDto	true	"Global script body"
// @Success		200				{object}	swagger.BaseSuccessResponse[UpdateGlobalScriptResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/global-script [put]
func (c *UpdateGlobalScriptController) UpdateGlobalScript(ctx *gin.Context) {
	logger.Infof(ctx, "Update global script requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	var req UpdateGlobalScriptRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf(ctx, "Invalid global script payload: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	if err := c.globalScriptRepository.UpdateGlobalScript(user.ID, req.GlobalScript); err != nil {
		logger.Errorf(ctx, "Failed to update global script for user %s: %v", user.ID, err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected update global script error"))
		return
	}

	logger.Infof(ctx, "Global script updated successfully for user %s", user.ID)
	c.Success(ctx, "Global script updated successfully", UpdateGlobalScriptResponseDto{})
}
