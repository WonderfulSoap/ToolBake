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

func NewSSOLoginController(config config.Config, authService *service.AuthService) router.Controller {
	return SSOLoginController{
		config:      config,
		authService: authService,
	}
}

type SSOLoginController struct {
	common.JsonResponse

	config      config.Config
	authService *service.AuthService
}

func (c SSOLoginController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/sso/:provider", Handler: c.SSOLogin},
	}
}

// @Summary		SSO login(If user not exists, create a new user)
// @Description	Login via SSO (github/google) and get refresh token, access token
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			provider	path		string				true	"SSO provider (github/google)"
// @Param			request		body		SSOLoginRequestDto	true	"OAuth code"
// @Success		200			{object}	swagger.BaseSuccessResponse[LoginResponseDto]
// @Failure		400			{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/sso/{provider} [post]
func (c *SSOLoginController) SSOLogin(ctx *gin.Context) {
	provider := ctx.Param("provider")
	logger.Infof(ctx, "%s SSO login requested", provider)

	var req SSOLoginRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	res, twoFAToken, err := c.authService.LoginOrCreateUserBySSO(ctx, provider, req.OauthCode)
	if err != nil {
		logger.Errorf(ctx, "Failed to login by %s sso: %v", provider, err)
		c.Error(ctx, err)
		return
	}

	// Check if 2FA is required
	if twoFAToken != nil {
		err := error_code.NewErrorWithErrorCodeAppendExtraData(
			error_code.TwoFaTotpIsRequiredForLogin,
			gin.H{
				"two_fa_token": *twoFAToken,
			},
			"",
		)
		c.Error(ctx, err)
		return
	}

	respDto := LoginResponseDto{}
	respDto.FromEntity(res.AccessToken, res.RefreshToken)
	c.Success(ctx, "", respDto)
}
