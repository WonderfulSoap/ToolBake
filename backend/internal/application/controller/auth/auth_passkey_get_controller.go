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

func NewPasskeyGetController(authPasskeyService *service.AuthPasskeyService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return PasskeyGetController{
		authPasskeyService:         authPasskeyService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type PasskeyGetController struct {
	common.JsonResponse

	authPasskeyService         *service.AuthPasskeyService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c PasskeyGetController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/auth/passkeys", Handler: c.Handler},
	}
}

// @Summary		Get passkeys
// @Description	Get all passkeys for the current user
// @Tags			Auth
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[PasskeyGetResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/passkeys [get]
func (c *PasskeyGetController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Get passkeys requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	passkeys, err := c.authPasskeyService.GetPasskeys(ctx, user.ID)
	if err != nil {
		logger.Errorf(ctx, "Failed to get passkeys: %v", err)
		c.Error(ctx, err)
		return
	}

	respDto := PasskeyGetResponseDto{}
	respDto.FromEntity(passkeys)
	c.Success(ctx, "", respDto)
}
