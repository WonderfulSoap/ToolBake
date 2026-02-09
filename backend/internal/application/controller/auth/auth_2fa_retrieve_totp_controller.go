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

func NewTwoFARetrieveTOTPController(twoFAService *service.TwoFAService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return TwoFARetrieveTOTPController{
		twoFAService:               twoFAService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type TwoFARetrieveTOTPController struct {
	common.JsonResponse

	twoFAService               *service.TwoFAService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c TwoFARetrieveTOTPController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/auth/2fa/totp", Handler: c.Handler},
	}
}

// @Summary		Retrieve TOTP setup info
// @Description	Generate TOTP secret and QR code for 2FA setup
// @Tags			Auth
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[TwoFARetrieveTOTPResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/2fa/totp [get]
func (c *TwoFARetrieveTOTPController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Retrieve TOTP requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	totpInfo, err := c.twoFAService.GenerateNewTOTPForUser(ctx, user.ID, user.Name)
	if err != nil {
		logger.Errorf(ctx, "Failed to generate TOTP: %v", err)
		c.Error(ctx, err)
		return
	}

	respDto := TwoFARetrieveTOTPResponseDto{
		Token:  totpInfo.Token,
		Secret: totpInfo.Secret,
		URL:    totpInfo.URL,
		QRCode: totpInfo.QRCode,
	}
	c.Success(ctx, "", respDto)
}
