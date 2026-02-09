package user

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewCheckUsernameController(config config.Config, userService *service.UserService) router.Controller {
	return CheckUsernameController{
		config:      config,
		userService: userService,
	}
}

type CheckUsernameController struct {
	common.JsonResponse

	config      config.Config
	userService *service.UserService
}

func (c CheckUsernameController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/user/check", Handler: c.Check},
	}
}

// @Summary		Check username exists
// @Description	Check if a username already exists
// @Tags			User
// @Accept			json
// @Produce		json
// @Param			request	body		CheckUsernameRequestDto	true	"Username to check"
// @Success		200		{object}	swagger.BaseSuccessResponse[CheckUsernameResponseDto]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Router			/api/v1/user/check [post]
func (c *CheckUsernameController) Check(ctx *gin.Context) {
	var req CheckUsernameRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	exists, err := c.userService.CheckUsernameExists(ctx, req.Username)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "Username check completed", CheckUsernameResponseDto{Exists: exists})
}
