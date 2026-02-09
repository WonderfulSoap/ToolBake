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

func NewPasskeyLoginVerifyController(authPasskeyService *service.AuthPasskeyService) router.Controller {
	return PasskeyLoginVerifyController{
		authPasskeyService: authPasskeyService,
	}
}

type PasskeyLoginVerifyController struct {
	common.JsonResponse

	authPasskeyService *service.AuthPasskeyService
}

func (c PasskeyLoginVerifyController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/passkey/login/verify", Handler: c.Handler},
	}
}

// @Summary		Finish passkey login
// @Description	Verify the passkey credential from navigator.credentials.get() and return tokens
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			request	body		PasskeyLoginRequestDto	true	"Passkey credential assertion response"
// @Success		200		{object}	swagger.BaseSuccessResponse[LoginResponseDto]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Failure		401		{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/passkey/login/verify [post]
func (c *PasskeyLoginVerifyController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Finish passkey login requested")

	var req PasskeyLoginRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	loginReq, err := req.ToEntity()
	if err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	accessToken, refreshToken, err := c.authPasskeyService.FinishLogin(ctx, loginReq)
	if err != nil {
		logger.Errorf(ctx, "Failed to finish passkey login: %v", err)
		c.Error(ctx, err)
		return
	}

	var resp LoginResponseDto
	resp.FromEntity(accessToken, refreshToken)

	c.Success(ctx, "Passkey login successful", resp)
}
