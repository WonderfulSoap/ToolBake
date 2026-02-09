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

func NewPasskeyRegisterChallengeController(authPasskeyService *service.AuthPasskeyService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return PasskeyRegisterChallengeController{
		authPasskeyService:         authPasskeyService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type PasskeyRegisterChallengeController struct {
	common.JsonResponse

	authPasskeyService         *service.AuthPasskeyService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c PasskeyRegisterChallengeController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/passkey/register/challenge", Handler: c.Handler},
	}
}

// @Summary		Begin passkey registration
// @Description	Generate challenge for passkey registration. Returns WebAuthn CredentialCreationOptions for navigator.credentials.create()
// @Tags			Auth
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[PasskeyChallengeResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/passkey/register/challenge [post]
func (c *PasskeyRegisterChallengeController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Begin passkey registration requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	options, err := c.authPasskeyService.RegistrationChallenge(ctx, user.ID)
	if err != nil {
		logger.Errorf(ctx, "Failed to begin passkey registration: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "Passkey registration challenge generated", options)
}
