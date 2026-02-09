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

func NewSSOBindingAddController(config config.Config, authService *service.AuthService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return SSOBindingAddController{
		config:                     config,
		authService:                authService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type SSOBindingAddController struct {
	common.JsonResponse

	config                     config.Config
	authService                *service.AuthService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c SSOBindingAddController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPut, Path: "/api/v1/auth/sso/:provider", Handler: c.Handler},
	}
}

// @Summary		Add SSO binding
// @Description	Bind a SSO account (github/google) to the current user
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string				true	"Bearer access token"
// @Param			provider		path		string				true	"SSO provider (github/google)"
// @Param			request			body		SSOLoginRequestDto	true	"OAuth code"
// @Success		200				{object}	swagger.BaseSuccessResponse[any]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/sso/{provider} [put]
func (c *SSOBindingAddController) Handler(ctx *gin.Context) {
	provider := ctx.Param("provider")
	logger.Infof(ctx, "Add %s SSO binding requested", provider)

	var req SSOLoginRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	err = c.authService.AddSSOBindingForUser(ctx, user.ID, provider, req.OauthCode)
	if err != nil {
		logger.Errorf(ctx, "Failed to add %s SSO binding: %v", provider, err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "SSO binding added successfully", gin.H{})
}
