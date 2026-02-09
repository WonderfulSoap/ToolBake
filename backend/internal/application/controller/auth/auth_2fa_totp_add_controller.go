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

func NewTwoFATOTPAddController(twoFAService *service.TwoFAService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return TwoFATOTPAddController{
		twoFAService:               twoFAService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type TwoFATOTPAddController struct {
	common.JsonResponse

	twoFAService               *service.TwoFAService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c TwoFATOTPAddController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/2fa/totp", Handler: c.Handler},
	}
}

// @Summary		Add TOTP 2FA
// @Description	Verify TOTP code and enable 2FA for the user. Returns a recovery code that can be used to disable 2FA.
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string					true	"Bearer access token"
// @Param			request			body		TwoFATOTPAddRequestDto	true	"TOTP verification request"
// @Success		200				{object}	swagger.BaseSuccessResponse[TwoFATOTPAddResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Failure		409				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/2fa/totp [post]
func (c *TwoFATOTPAddController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Add TOTP 2FA requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	var req TwoFATOTPAddRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		logger.Errorf(ctx, "Failed to bind request: %v", err)
		c.Error(ctx, err)
		return
	}

	recoveryCode, err := c.twoFAService.VerifyAndEnableTOTP(ctx, user.ID, req.Token, req.Code)
	if err != nil {
		logger.Errorf(ctx, "Failed to enable TOTP 2FA: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "TOTP 2FA enabled successfully", TwoFATOTPAddResponseDto{
		RecoveryCode: recoveryCode,
	})
}
