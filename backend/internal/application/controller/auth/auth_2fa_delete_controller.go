package auth

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewTwoFADeleteController(twoFAService *service.TwoFAService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return TwoFADeleteController{
		twoFAService:               twoFAService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type TwoFADeleteController struct {
	common.JsonResponse

	twoFAService               *service.TwoFAService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

type TwoFADeleteRequestDto struct {
	Type string `json:"type" binding:"required"`
	Code string `json:"code" binding:"required"`
}

func (c TwoFADeleteController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodDelete, Path: "/api/v1/auth/2fa", Handler: c.Handler},
	}
}

// @Summary		Delete 2FA
// @Description	Delete a specific 2FA method for the current user (requires verification code)
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string					true	"Bearer access token"
// @Param			request			body		TwoFADeleteRequestDto	true	"2FA type and verification code"
// @Success		200				{object}	swagger.BaseSuccessResponse[any]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/2fa [delete]
func (c *TwoFADeleteController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Delete 2FA requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	var req TwoFADeleteRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	twoFAType := entity.TwoFAType(req.Type)

	err = c.twoFAService.Delete2FA(ctx, user.ID, twoFAType, req.Code)
	if err != nil {
		logger.Errorf(ctx, "Failed to delete 2FA: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "2FA deleted successfully", nil)
}
