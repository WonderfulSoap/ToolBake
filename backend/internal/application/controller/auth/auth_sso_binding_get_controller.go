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

func NewSSOBindingGetController(config config.Config, authService *service.AuthService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return SSOBindingGetController{
		config:                     config,
		authService:                authService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type SSOBindingGetController struct {
	common.JsonResponse

	config                     config.Config
	authService                *service.AuthService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c SSOBindingGetController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/auth/sso/bindings", Handler: c.Handler},
	}
}

// @Summary		Get SSO bindings
// @Description	Get all SSO bindings for the current user
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[SSOBindingGetResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/sso/bindings [get]
func (c *SSOBindingGetController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Get SSO bindings requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	bindings, err := c.authService.GetUserSSOBindings(ctx, user.ID)
	if err != nil {
		logger.Errorf(ctx, "Failed to get SSO bindings: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "Failed to get SSO bindings"))
		return
	}

	respDto := SSOBindingGetResponseDto{}
	respDto.FromEntity(bindings)
	c.Success(ctx, "", respDto)
}
