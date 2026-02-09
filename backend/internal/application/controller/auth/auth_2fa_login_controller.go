package auth

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewTwoFALoginController(twoFAService *service.TwoFAService) router.Controller {
	return TwoFALoginController{
		twoFAService: twoFAService,
	}
}

type TwoFALoginController struct {
	common.JsonResponse

	twoFAService *service.TwoFAService
}

func (c TwoFALoginController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/2fa/login", Handler: c.Handler},
	}
}

// @Summary		2FA Login
// @Description	Complete login with 2FA verification
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			request	body		TwoFALoginRequestDto	true	"2FA login request"
// @Success		200		{object}	swagger.BaseSuccessResponse[TwoFALoginResponseDto]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Failure		401		{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/2fa/login [post]
func (c *TwoFALoginController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "2FA login requested")

	var req TwoFALoginRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf(ctx, "Failed to bind request: %v", err)
		c.Error(ctx, err)
		return
	}

	result, err := c.twoFAService.Verify2FATokenAndLogin(ctx, req.Token, req.Code)
	if err != nil {
		logger.Errorf(ctx, "Failed to verify 2FA and login: %v", err)
		c.Error(ctx, err)
		return
	}

	logger.Infof(ctx, "2FA login successful: user_id=%s", result.User.ID)

	c.Success(ctx, "", TwoFALoginResponseDto{
		AccessToken:  result.AccessToken.Token,
		RefreshToken: result.RefreshToken.Token,
	})
}
