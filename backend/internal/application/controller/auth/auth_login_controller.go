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

func NewAuthLoginController(config config.Config, authService *service.AuthService) router.Controller {
	return AuthLoginController{
		config:      config,
		authService: authService,
	}
}

type AuthLoginController struct {
	common.JsonResponse

	config      config.Config
	authService *service.AuthService
}

func (c AuthLoginController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/login", Handler: c.Login},
	}
}

// @Summary		login
// @Description	login and get refresh token, access token
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			request	body		LoginRequestDto	true	"Account information"
// @Success		200		{object}	swagger.BaseSuccessResponse[LoginResponseDto]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/login [post]
func (c *AuthLoginController) Login(ctx *gin.Context) {
	logger.Infof(ctx, "Login")

	if !c.config.ENABLE_PASSWORD_LOGIN {
		logger.Warnf(ctx, "Authentication is disabled in the configuration")
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.PasswordLoginIsNotEnabled, "password login is not enabled, please set env: ENABLE_PASSWORD_LOGIN"))
		return
	}
	var req LoginRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	res, twoFAToken, credentialValid, err := c.authService.Login(ctx, req.UserName, req.Password)
	if err != nil {
		logger.Errorf(ctx, "Failed to login: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected login error"))
		return
	}

	if !credentialValid {
		logger.Infof(ctx, "Invalid credentials for user: %s", req.UserName)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InvalidCredentials, ""))
		return
	}

	// Check if 2FA is required
	if twoFAToken != nil {
		err := error_code.NewErrorWithErrorCodeFAppendExtraData(
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
