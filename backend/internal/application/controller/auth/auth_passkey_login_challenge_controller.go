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

func NewPasskeyLoginChallengeController(authPasskeyService *service.AuthPasskeyService) router.Controller {
	return PasskeyLoginChallengeController{
		authPasskeyService: authPasskeyService,
	}
}

type PasskeyLoginChallengeController struct {
	common.JsonResponse

	authPasskeyService *service.AuthPasskeyService
}

func (c PasskeyLoginChallengeController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/passkey/login/challenge", Handler: c.Handler},
	}
}

// @Summary		Begin passkey login
// @Description	Generate challenge for passkey login. Returns WebAuthn CredentialRequestOptions for navigator.credentials.get()
// @Tags			Auth
// @Produce		json
// @Success		200	{object}	swagger.BaseSuccessResponse[PasskeyLoginChallengeResponseDto]
// @Failure		400	{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/passkey/login/challenge [post]
func (c *PasskeyLoginChallengeController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Begin passkey login requested")

	options, err := c.authPasskeyService.LoginChallenge(ctx)
	if err != nil {
		logger.Errorf(ctx, "Failed to begin passkey login: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "Passkey login challenge generated", options)
}
