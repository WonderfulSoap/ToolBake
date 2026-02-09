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

func NewSSOBindingDeleteController(config config.Config, authService *service.AuthService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return SSOBindingDeleteController{
		config:                     config,
		authService:                authService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type SSOBindingDeleteController struct {
	common.JsonResponse

	config                     config.Config
	authService                *service.AuthService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c SSOBindingDeleteController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodDelete, Path: "/api/v1/auth/sso/bindings", Handler: c.Handler},
	}
}

// @Summary		Delete SSO binding
// @Description	Delete a SSO binding for the current user by provider
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string						true	"Bearer access token"
// @Param			request			body		SSOBindingDeleteRequestDto	true	"Delete SSO binding request"
// @Success		200				{object}	swagger.BaseSuccessResponse[any]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/sso/bindings [delete]
func (c *SSOBindingDeleteController) Handler(ctx *gin.Context) {
	var req SSOBindingDeleteRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	logger.Infof(ctx, "Delete SSO binding requested for provider: %s", req.Provider)

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	err = c.authService.DeleteUserSSOBinding(ctx, user.ID, req.Provider)
	if err != nil {
		logger.Errorf(ctx, "Failed to delete SSO binding: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "SSO binding deleted successfully", gin.H{})
}
