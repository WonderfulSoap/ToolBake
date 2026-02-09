package user

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

func NewCreateUserController(config config.Config, userService *service.UserService) router.Controller {
	return CreateuserController{
		config:      config,
		userService: userService,
	}
}

type CreateuserController struct {
	common.JsonResponse

	config      config.Config
	userService *service.UserService
}

func (c CreateuserController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPost, Path: "/api/v1/user/create", Handler: c.Create},
	}
}

// @Summary		Create user
// @Description	Create a new user with username and password
// @Tags			User
// @Accept			json
// @Produce		json
// @Param			request	body		CreateUserRequestDto	true	"New user information"
// @Success		200		{object}	swagger.BaseSuccessResponse[CreateUserResponseDto]
// @Failure		400		{object}	swagger.BaseFailResponse
// @Router			/api/v1/user/create [post]
func (c *CreateuserController) Create(ctx *gin.Context) {
	logger.Infof(ctx, "Create User")

	var req CreateUserRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	logger.Infof(ctx, `User name: %s`, req.UserName)

	if _, err := c.userService.CreateUser(ctx, req.UserName, req.Password); err != nil {
		logger.Errorf(ctx, "Failed to create user: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "User created successfully", CreateUserResponseDto{})
}
