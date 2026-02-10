package auth

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewAuthIssueAccessTokenController(config config.Config, authService *service.AuthService) router.Controller {
	return AuthIssueAccessTokenController{
		config:      config,
		authService: authService,
	}
}

type AuthIssueAccessTokenController struct {
	common.JsonResponse

	config      config.Config
	authService *service.AuthService
}

func (c AuthIssueAccessTokenController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/auth/access-token", Handler: c.Handler},
	}
}

// @Summary		issue new access token
// @Description	issue new access token by refresh token
// @Tags			Auth
// @Accept			json
// @Produce		json
// @Param			request	body		IssueAccessTokenRequestDto	true	"Refresh token"
// @Success		200		{object}	swagger.BaseSuccessResponse[IssueAccessTokenResponseDto]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Router			/api/v1/auth/access-token [post]
func (c *AuthIssueAccessTokenController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "Issue new access token")

	var req IssueAccessTokenRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	accessToken, valid, err := c.authService.IssueNewAccessToken(ctx, req.RefreshToken)
	if err != nil {
		logger.Errorf(ctx, "failed to issue access token: %v", err)
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected issue access token error"))
		return
	}

	if !valid {
		logger.Infof(ctx, "invalid refresh token supplied")
		c.Error(ctx, error_code.NewErrorWithErrorCodef(error_code.InvalidRefreshToken, ""))
		return
	}

	resp := IssueAccessTokenResponseDto{}
	resp.FromEntity(accessToken)
	c.Success(ctx, "", resp)
}
