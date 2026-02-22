package service

import (
	"context"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/error_code"

	"github.com/pkg/errors"
)

func NewUserService(
	userRepo repository.IUserRepository,
	accessTokenRepo repository.IAuthAccessTokenRepository,
	refreshTokenRepo repository.IAuthRefreshTokenRepository,
	cfg config.Config,
) *UserService {
	return &UserService{
		userRepo:         userRepo,
		accessTokenRepo:  accessTokenRepo,
		refreshTokenRepo: refreshTokenRepo,
		config:           cfg,
	}
}

type UserService struct {
	userRepo         repository.IUserRepository
	accessTokenRepo  repository.IAuthAccessTokenRepository
	refreshTokenRepo repository.IAuthRefreshTokenRepository
	config           config.Config
}

func (s *UserService) CreateUser(ctx context.Context, username string, password string) (entity.UserEntity, error) {
	if !s.config.ENABLE_USER_REGISTRATION {
		return entity.UserEntity{}, error_code.NewErrorWithErrorCodef(error_code.UserRegistrationIsNotEnabled, "user registration is not enabled, please set env: ENABLE_USER_REGISTRATION")
	}

	// Check if username already exists
	_, exists, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return entity.UserEntity{}, errors.Wrapf(err, "fail to check existing user")
	}
	if exists {
		return entity.UserEntity{}, error_code.NewErrorWithErrorCodef(error_code.UserAlreadyExists, "username already exists")
	}

	// Create user
	user, err := s.userRepo.Create(ctx, username, []entity.UserRoleEntity{entity.UserRoleUser})
	if err != nil {
		return entity.UserEntity{}, errors.Wrapf(err, "fail to create user")
	}

	// Set password
	if err := s.userRepo.UpdatePassword(ctx, user.ID, password); err != nil {
		return entity.UserEntity{}, errors.Wrapf(err, "fail to set user password")
	}

	logger.Infof(ctx, "user created: username: %s userid: %s", username, user.ID)
	return user, nil
}

func (s *UserService) CheckUsernameExists(ctx context.Context, username string) (bool, error) {
	_, exists, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return false, errors.Wrapf(err, "fail to check username")
	}
	return exists, nil
}

func (s *UserService) UpdateUser(
	ctx context.Context,
	userID entity.UserIDEntity,
	params struct {
		Username *string
	}) error {
	// Get current user
	user, exists, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return errors.Wrapf(err, "fail to get user by id")
	}
	if !exists {
		return error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "user not found")
	}

	// Apply updates (diff update: only non-nil fields)
	if params.Username != nil && user.Name != *params.Username {
		// Check if new username already exists
		_, usernameExists, err := s.userRepo.GetByUsername(ctx, *params.Username)
		if err != nil {
			return errors.Wrapf(err, "fail to check username")
		}
		if usernameExists {
			return error_code.NewErrorWithErrorCodef(error_code.UserAlreadyExists, "username already exists")
		}
		user.Name = *params.Username
	}

	// Update user
	if err := s.userRepo.Update(ctx, user); err != nil {
		return errors.Wrapf(err, "fail to update user")
	}

	logger.Infof(ctx, "user updated: userid: %s", userID)
	return nil
}

func (s *UserService) DeleteUser(ctx context.Context, userID entity.UserIDEntity) error {
	// Check if user exists
	_, exists, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return errors.Wrapf(err, "fail to get user by id")
	}
	if !exists {
		return error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "user not found")
	}

	// Delete all access tokens for this user
	if err := s.accessTokenRepo.DeleteAllTokensByUserID(ctx, userID); err != nil {
		return errors.Wrapf(err, "fail to delete access tokens")
	}

	// Delete all refresh tokens for this user
	if err := s.refreshTokenRepo.DeleteAllTokensByUserID(ctx, userID); err != nil {
		return errors.Wrapf(err, "fail to delete refresh tokens")
	}

	// Delete user and all related data
	if err := s.userRepo.DeleteUserWithAllData(ctx, userID); err != nil {
		return errors.Wrapf(err, "fail to delete user and related data")
	}

	logger.Infof(ctx, "user deleted: userid: %s", userID)
	return nil
}
