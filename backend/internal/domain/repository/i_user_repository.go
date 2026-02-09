package repository

import (
	"context"
	"ya-tool-craft/internal/domain/entity"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_user_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IUserRepository
type IUserRepository interface {
	// Create creates a new user with the given username, email and password
	Create(ctx context.Context, username string, roles []entity.UserRoleEntity) (entity.UserEntity, error)

	// GetByID retrieves a user by ID
	GetByID(ctx context.Context, id entity.UserIDEntity) (entity.UserEntity, bool, error)

	// GetByEmail retrieves a user by email
	GetByEmail(ctx context.Context, email string) (entity.UserEntity, bool, error)

	// GetByUsername retrieves a user by username
	GetByUsername(ctx context.Context, username string) (entity.UserEntity, bool, error)

	// Update updates user information
	Update(ctx context.Context, user entity.UserEntity) error

	// Delete deletes a user
	Delete(ctx context.Context, id entity.UserIDEntity) error

	// UpdatePassword updates user's password
	UpdatePassword(ctx context.Context, id entity.UserIDEntity, newPassword string) error

	// ValidateCredentialsByUsername validates username and password combination
	// Returns user entity and true if credentials are valid, otherwise returns false
	ValidateCredentialsByUsername(ctx context.Context, username string, password string) (entity.UserEntity, bool, error)

	// ValidateCredentialsByEmail validates email and password combination
	// Returns user entity and true if credentials are valid, otherwise returns false
	ValidateCredentialsByEmail(ctx context.Context, email string, password string) (entity.UserEntity, bool, error)

	// CreateUserBySSO creates a new user and user sso binding
	CreateUserBySSO(ctx context.Context, provider string, providerUserID string, providerUsername *string, providerEmail *string, roles []entity.UserRoleEntity) (entity.UserEntity, error)

	// GetUserBySSO retrieves a user sso binding by provider and provider user id
	GetUserBySSO(ctx context.Context, provider string, providerUserID string) (entity.UserEntity, bool, error)

	// GetUserSSOBindings retrieves all SSO bindings for a user
	GetUserSSOBindings(ctx context.Context, userID entity.UserIDEntity) ([]entity.UserSSOEntity, error)

	// AddUserSSOBinding adds a new user sso binding
	AddUserSSOBinding(ctx context.Context, userID entity.UserIDEntity, provider string, providerUserID string, providerUsername *string, providerEmail *string) error

	// DeleteUserSSOBinding deletes a user sso binding by provider
	DeleteUserSSOBinding(ctx context.Context, userID entity.UserIDEntity, provider string) error

	// DeleteUserWithAllData deletes a user and all related data (sso bindings, tools, global scripts, etc.)
	DeleteUserWithAllData(ctx context.Context, id entity.UserIDEntity) error
}
