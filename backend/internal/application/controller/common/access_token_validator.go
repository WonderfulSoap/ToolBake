package common

import (
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/error_code"

	"github.com/gin-gonic/gin"
)

func NewAccessTokenHeaderValidator(
	authService *service.AuthService,
	userRepository repository.IUserRepository,
) AccessTokenHeaderValidator {
	return AccessTokenHeaderValidator{
		authService:    authService,
		userRepository: userRepository,
	}
}

type AccessTokenHeaderValidator struct {
	authService    *service.AuthService
	userRepository repository.IUserRepository
}

func (v *AccessTokenHeaderValidator) ValidateOptionalAccessTokenHeader(ctx *gin.Context) (user entity.UserEntity, accessTokenExists bool, err error) {
	token, err := GetOptionalAccessTokenHeader(ctx)
	if err != nil {
		logger.Errorf(ctx, "get optional access token error from header: %v", err)
		return entity.UserEntity{}, false, err
	}

	if token == nil {
		return entity.UserEntity{}, false, nil
	}

	user, err = v.ValidateAccessTokenHeader(ctx)
	if err != nil {
		return entity.UserEntity{}, false, err
	}

	return user, true, nil

}

func (v *AccessTokenHeaderValidator) ValidateAccessTokenHeader(ctx *gin.Context) (entity.UserEntity, error) {
	accessTokenStr, err := GetAccessTokenHeader(ctx)
	if err != nil {
		logger.Errorf(ctx, "access token error from header: %v", err)
		return entity.UserEntity{}, err
	}
	accessToken, ok, err := v.authService.ValidateAccessToken(ctx, accessTokenStr)
	if err != nil {
		logger.Errorf(ctx, "access token validate error: %v", err)
		return entity.UserEntity{}, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected validate user error")
	}
	if !ok {
		logger.Errorf(ctx, "access token is not valid")
		return entity.UserEntity{}, error_code.NewErrorWithErrorCodef(error_code.InvalidAccessToken, "Access token is invalid")
	}

	userID := accessToken.UserID

	user, exists, err := v.userRepository.GetByID(ctx, userID)
	if err != nil {
		logger.Errorf(ctx, "fail to get user by id: %v", err)
		return entity.UserEntity{}, error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "Unexpected get user error")
	}
	if !exists {
		logger.Errorf(ctx, "user not found: %s", userID)
		return entity.UserEntity{}, error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "User not found")
	}

	return user, nil
}
