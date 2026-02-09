package user

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/service"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewDeleteUserController(config config.Config, userService *service.UserService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return DeleteUserController{
		config:                     config,
		userService:                userService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type DeleteUserController struct {
	common.JsonResponse

	config                     config.Config
	userService                *service.UserService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c DeleteUserController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodDelete, Path: "/api/v1/user/delete", Handler: c.Delete},
	}
}

// @Summary		Delete current user
// @Description	Delete the current authenticated user and all related data
// @Tags			User
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string	true	"Bearer access token"
// @Success		200				{object}	swagger.BaseSuccessResponse[DeleteUserResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/user/delete [delete]
func (c *DeleteUserController) Delete(ctx *gin.Context) {
	logger.Infof(ctx, "Delete User")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	logger.Infof(ctx, "Deleting user: %s", user.ID)

	if err := c.userService.DeleteUser(ctx, user.ID); err != nil {
		logger.Errorf(ctx, "Failed to delete user: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "User deleted successfully", DeleteUserResponseDto{})
}
