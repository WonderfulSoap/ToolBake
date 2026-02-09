package auth

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewAuthLogoutController(config config.Config, authService *service.AuthService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return AuthLogoutController{
		config:                     config,
		authService:                authService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type AuthLogoutController struct {
	common.JsonResponse

	config                     config.Config
	authService                *service.AuthService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c AuthLogoutController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/logout", Handler: c.Handler},
	}
}

// @Summary		logout
// @Description	invalidate tokens associated with the current access token
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[any]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/logout [post]
func (c *AuthLogoutController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Logout requested")

	_, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}
	accessToken, err := common.GetAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	err = c.authService.Logout(ctx, accessToken)
	if err != nil {
		logger.Errorf(ctx, "Logout failed: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Unexpected logout error"))
		return
	}

	c.Success(ctx, "Logout successful", gin.H{})
}
