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

func NewTwoFARecoveryController(twoFAService *service.TwoFAService) router.Controller {
	return TwoFARecoveryController{
		twoFAService: twoFAService,
	}
}

type TwoFARecoveryController struct {
	common.JsonResponse

	twoFAService *service.TwoFAService
}

func (c TwoFARecoveryController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/2fa/recovery", Handler: c.Handler},
	}
}

// @Summary		2FA Recovery
// @Description	Remove 2FA using recovery code. Use this when you've lost access to your authenticator app.
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			request	body		TwoFARecoveryRequestDto	true	"2FA recovery request"
// @Success		200		{object}	swagger.BaseSuccessResponse[any]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Failure		401		{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/2fa/recovery [post]
func (c *TwoFARecoveryController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "2FA recovery requested")

	var req TwoFARecoveryRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf(ctx, "Failed to bind request: %v", err)
		c.Error(ctx, err)
		return
	}

	err := c.twoFAService.Remove2FAByRecoveryCode(ctx, req.Token, req.RecoveryCode)
	if err != nil {
		logger.Errorf(ctx, "Failed to recover 2FA: %v", err)
		c.Error(ctx, err)
		return
	}

	logger.Infof(ctx, "2FA recovery successful, 2FA removed")

	c.Success(ctx, "2FA removed successfully", nil)
}
