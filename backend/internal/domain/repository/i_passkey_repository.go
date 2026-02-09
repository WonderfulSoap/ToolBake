package repository

import (
	"context"
	"ya-tool-craft/internal/domain/entity"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_passkey_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IPasskeyRepository
type IPasskeyRepository interface {
	// Create creates a new passkey for a user
	Create(ctx context.Context, passkey entity.PasskeyEntity) error

	// GetByCredentialID retrieves a passkey by credential ID (used during login)
	GetByCredentialID(ctx context.Context, credentialID []byte) (entity.PasskeyEntity, bool, error)

	// GetByUserID retrieves all passkeys for a user
	GetByUserID(ctx context.Context, userID entity.UserIDEntity) ([]entity.PasskeyEntity, error)

	// UpdateSignCount updates the sign count after successful authentication
	UpdateSignCount(ctx context.Context, id int64, signCount int64) error

	// UpdateLastUsedAt updates the last used timestamp
	UpdateLastUsedAt(ctx context.Context, id int64) error

	// Delete deletes a passkey by ID
	Delete(ctx context.Context, id int64, userID entity.UserIDEntity) error

	// DeleteByUserID deletes all passkeys for a user
	DeleteByUserID(ctx context.Context, userID entity.UserIDEntity) error
}
