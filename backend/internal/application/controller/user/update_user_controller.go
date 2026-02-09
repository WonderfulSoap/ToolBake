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

func NewUpdateUserController(config config.Config, userService *service.UserService, accessTokenHeaderValidator common.AccessTokenHeaderValidator) router.Controller {
	return UpdateUserController{
		config:                     config,
		userService:                userService,
		accessTokenHeaderValidator: accessTokenHeaderValidator,
	}
}

type UpdateUserController struct {
	common.JsonResponse

	config                     config.Config
	userService                *service.UserService
	accessTokenHeaderValidator common.AccessTokenHeaderValidator
}

func (c UpdateUserController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodPut, Path: "/api/v1/user/info", Handler: c.Update},
	}
}

// @Summary		Update user
// @Description	Update current user's information (username, mail). Only provided fields will be updated.
// @Tags			User
// @Accept			json
// @Produce		json
// @Param			Authorization	header		string					true	"Bearer access token"
// @Param			request			body		UpdateUserRequestDto	true	"Fields to update (only non-null fields will be updated)"
// @Success		200				{object}	swagger.BaseSuccessResponse[UpdateUserResponseDto]
// @Failure		400				{object}	swagger.BaseFailResponse
// @Router			/api/v1/user/info [put]
func (c *UpdateUserController) Update(ctx *gin.Context) {
	logger.Infof(ctx, "Update User")

	user, err := c.accessTokenHeaderValidator.ValidateAccessTokenHeader(ctx)
	if err != nil {
		c.Error(ctx, err)
		return
	}

	var req UpdateUserRequestDto
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InvalidRequestParameters, err.Error()))
		return
	}

	logger.Infof(ctx, "Updating user: %s", user.ID)

	params := struct {
		Username *string
	}{
		Username: req.Username,
	}

	if err := c.userService.UpdateUser(ctx, user.ID, params); err != nil {
		logger.Errorf(ctx, "Failed to update user: %v", err)
		c.Error(ctx, err)
		return
	}

	c.Success(ctx, "User updated successfully", UpdateUserResponseDto{})
}
