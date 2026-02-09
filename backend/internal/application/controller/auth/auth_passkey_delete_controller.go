package auth

import (
	"net/http"
	"strconv"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewPasskeyDeleteController(authPasskeyService *service.AuthPasskeyService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return PasskeyDeleteController{
		authPasskeyService:         authPasskeyService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type PasskeyDeleteController struct {
	common.JsonResponse

	authPasskeyService         *service.AuthPasskeyService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c PasskeyDeleteController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodDelete, Path: "/api/v1/auth/passkeys/:passkey_id", Handler: c.Handler},
	}
}

// @Summary		Delete passkey
// @Description	Delete a passkey for the current user by passkey ID
// @Tags			Auth
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Param			passkey_id		path		int64	true	"Passkey ID"
// @Success		200				{object}	swagger.BaseSuccessResponse[any]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/passkeys/{passkey_id} [delete]
func (c *PasskeyDeleteController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Delete passkey requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	passkeyIDStr := ctx.Param("passkey_id")
	if passkeyIDStr == "" {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, "passkey_id is required"))
		return
	}

	passkeyID, err := strconv.ParseInt(passkeyIDStr, 10, 64)
	if err != nil || passkeyID <= 0 {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, "passkey_id must be a positive integer"))
		return
	}

	if err := c.authPasskeyService.DeletePasskey(ctx, user.ID, passkeyID); err != nil {
		logger.Errorf(ctx, "Failed to delete passkey: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "Passkey deleted successfully", gin.H{})
}
