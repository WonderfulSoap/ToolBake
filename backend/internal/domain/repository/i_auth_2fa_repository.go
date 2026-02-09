package repository

import (
	"context"
	"ya-tool-craft/internal/domain/entity"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_auth_2fa_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IAuth2FARepository
type IAuth2FARepository interface {
	// Create creates a new 2FA record for a user
	Create(ctx context.Context, twoFA entity.TwoFAEntity) error

	// GetByUserID retrieves all 2FA records for a user
	GetByUserID(ctx context.Context, userID entity.UserIDEntity) ([]entity.TwoFAEntity, error)

	// GetByUserIDAndType retrieves a specific 2FA record by user ID and type
	GetByUserIDAndType(ctx context.Context, userID entity.UserIDEntity, twoFAType entity.TwoFAType) (entity.TwoFAEntity, bool, error)

	// Delete deletes a 2FA record by user ID and type
	Delete(ctx context.Context, userID entity.UserIDEntity, twoFAType entity.TwoFAType) error

	// SetRecoveryCode sets recovery code for a user
	SetRecoveryCode(ctx context.Context, userID entity.UserIDEntity, code string) error

	// GetRecoveryCode retrieves recovery code for a user
	GetRecoveryCode(ctx context.Context, userID entity.UserIDEntity) (*string, error)

	// ClearRecoveryCode removes recovery code for a user
	ClearRecoveryCode(ctx context.Context, userID entity.UserIDEntity) error
}
