package auth

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewPasskeyRegisterVerifyController(authPasskeyService *service.AuthPasskeyService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return PasskeyRegisterVerifyController{
		authPasskeyService:         authPasskeyService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type PasskeyRegisterVerifyController struct {
	common.JsonResponse

	authPasskeyService         *service.AuthPasskeyService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c PasskeyRegisterVerifyController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/passkey/register/verify", Handler: c.Handler},
	}
}

// @Summary		Finish passkey registration
// @Description	Verify and store the passkey credential created by navigator.credentials.create()
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string						true	"Bearer access token"
// @Param			request			body		PasskeyRegisterRequestDto	true	"Passkey credential response"
// @Success		200				{object}	swagger.BaseSuccessResponse[any]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/passkey/register/verify [post]
func (c *PasskeyRegisterVerifyController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Finish passkey registration requested")

	var req PasskeyRegisterRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	registerReq, err := req.ToEntity()
	if err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	_, err = c.authPasskeyService.FinishRegistration(ctx, user.ID, registerReq, req.DeviceName)
	if err != nil {
		logger.Errorf(ctx, "Failed to finish passkey registration: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "Passkey registered successfully", gin.H{})
}
