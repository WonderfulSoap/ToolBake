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

func NewTwoFAGetController(twoFAService *service.TwoFAService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return TwoFAGetController{
		twoFAService:               twoFAService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type TwoFAGetController struct {
	common.JsonResponse

	twoFAService               *service.TwoFAService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c TwoFAGetController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/auth/2fa", Handler: c.Handler},
	}
}

// @Summary		Get 2FA info
// @Description	Get 2FA information for the current user
// @Tags			Auth
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[TwoFAGetResponseDto]
// @Failure		401				{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/2fa [get]
func (c *TwoFAGetController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Get 2FA info requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	twoFAInfoList, err := c.twoFAService.Get2FAInfo(ctx, user.ID)
	if err != nil {
		logger.Errorf(ctx, "Failed to get 2FA info: %v", err)
		c.Error(ctx, err)
		return
	}

	dtoList := make([]TwoFAInfoDto, 0, len(twoFAInfoList))
	for _, info := range twoFAInfoList {
		dtoList = append(dtoList, TwoFAInfoDto{
			Type:      string(info.Type),
			Enabled:   info.Enabled,
			CreatedAt: info.CreatedAt,
		})
	}

	c.Success(ctx, "", TwoFAGetResponseDto{
		TwoFAList: dtoList,
	})
}
