package user

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/domain/service"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewUserInfoController(config config.Config, authService *service.AuthService, userRepository repository.IUserRepository, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return UserInfoController{
		config:                     config,
		authService:                authService,
		userRepository:             userRepository,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type UserInfoController struct {
	common.JsonResponse

	config                     config.Config
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
	authService                *service.AuthService
	userRepository             repository.IUserRepository
}

func (c UserInfoController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/user", Handler: c.Handler},
	}
}

// @Summary		Get current user info
// @Description	Fetch user information based on the supplied access token
// @Tags			User
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[UserInfoResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/user [get]
func (c *UserInfoController) Handler(ctx *gin.Context) {
	logger.Infof(ctx, "User Info requested")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	logger.Infof(ctx, "User retrieved successfully: %s", user.ID)
	respDto := UserInfoResponseDto{}
	respDto.FromEntity(user)

	c.Success(ctx, "User retrieved successfully", respDto)
}
