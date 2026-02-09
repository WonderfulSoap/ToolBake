package repository_impl

import (
	"context"
	"database/sql"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"

	"github.com/pkg/errors"
	"github.com/samber/lo"
)

// TwoFARdsModel represents the user_2fa table structure in RDS
type TwoFARdsModel struct {
	ID        int64     `db:"id"`
	UserID    string    `db:"user_id"`
	Type      string    `db:"type"`
	Secret    string    `db:"secret"`
	Verified  bool      `db:"verified"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

func NewAuth2FARepositoryRdsImpl(client repository.IRdsClient) *Auth2FARepositoryRdsImpl {
	return &Auth2FARepositoryRdsImpl{client: client}
}

type Auth2FARepositoryRdsImpl struct {
	client repository.IRdsClient
}

// Create creates a new 2FA record for a user
func (r *Auth2FARepositoryRdsImpl) Create(ctx context.Context, twoFA entity.TwoFAEntity) error {
	db := r.client.DB()
	now := time.Now()

	_, err := db.Exec(
		"INSERT INTO user_2fa (user_id, type, secret, verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		string(twoFA.UserID), string(twoFA.Type), twoFA.Secret, twoFA.Verified, now, now,
	)
	if err != nil {
		return errors.Wrap(err, "fail to insert 2fa record into rds")
	}

	return nil
}

// GetByUserID retrieves all 2FA records for a user
func (r *Auth2FARepositoryRdsImpl) GetByUserID(ctx context.Context, userID entity.UserIDEntity) ([]entity.TwoFAEntity, error) {
	db := r.client.DB()
	var models []TwoFARdsModel

	err := db.Select(&models, "SELECT * FROM user_2fa WHERE user_id = ? ORDER BY created_at ASC", string(userID))
	if err != nil {
		return nil, errors.Wrap(err, "fail to get 2fa records by user id from rds")
	}

	entities := lo.Map(models, func(model TwoFARdsModel, _ int) entity.TwoFAEntity {
		return r.toEntity(&model)
	})

	return entities, nil
}

// GetByUserIDAndType retrieves a specific 2FA record by user ID and type
func (r *Auth2FARepositoryRdsImpl) GetByUserIDAndType(ctx context.Context, userID entity.UserIDEntity, twoFAType entity.TwoFAType) (entity.TwoFAEntity, bool, error) {
	db := r.client.DB()
	var model TwoFARdsModel

	err := db.Get(&model, "SELECT * FROM user_2fa WHERE user_id = ? AND type = ?", string(userID), string(twoFAType))
	if err != nil {
		if err == sql.ErrNoRows {
			return entity.TwoFAEntity{}, false, nil
		}
		return entity.TwoFAEntity{}, false, errors.Wrap(err, "fail to get 2fa record by user id and type from rds")
	}

	return r.toEntity(&model), true, nil
}

// Delete deletes a 2FA record by user ID and type
func (r *Auth2FARepositoryRdsImpl) Delete(ctx context.Context, userID entity.UserIDEntity, twoFAType entity.TwoFAType) error {
	db := r.client.DB()

	_, err := db.Exec("DELETE FROM user_2fa WHERE user_id = ? AND type = ?", string(userID), string(twoFAType))
	if err != nil {
		return errors.Wrap(err, "fail to delete 2fa record from rds")
	}

	return nil
}

// SetRecoveryCode sets recovery code for a user
func (r *Auth2FARepositoryRdsImpl) SetRecoveryCode(ctx context.Context, userID entity.UserIDEntity, code string) error {
	db := r.client.DB()
	now := time.Now()

	_, err := db.Exec(
		"UPDATE users SET recovery_code = ?, updated_at = ? WHERE id = ?",
		code, now, string(userID),
	)
	if err != nil {
		return errors.Wrap(err, "fail to set recovery code in rds")
	}

	return nil
}

// GetRecoveryCode retrieves recovery code for a user
func (r *Auth2FARepositoryRdsImpl) GetRecoveryCode(ctx context.Context, userID entity.UserIDEntity) (*string, error) {
	db := r.client.DB()
	var code sql.NullString

	err := db.Get(&code, "SELECT recovery_code FROM users WHERE id = ?", string(userID))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, errors.Wrap(err, "fail to get recovery code from rds")
	}

	if !code.Valid {
		return nil, nil
	}

	return &code.String, nil
}

// ClearRecoveryCode removes recovery code for a user
func (r *Auth2FARepositoryRdsImpl) ClearRecoveryCode(ctx context.Context, userID entity.UserIDEntity) error {
	db := r.client.DB()
	now := time.Now()

	_, err := db.Exec(
		"UPDATE users SET recovery_code = NULL, updated_at = ? WHERE id = ?",
		now, string(userID),
	)
	if err != nil {
		return errors.Wrap(err, "fail to clear recovery code in rds")
	}

	return nil
}

// toEntity converts TwoFARdsModel to TwoFAEntity
func (r *Auth2FARepositoryRdsImpl) toEntity(model *TwoFARdsModel) entity.TwoFAEntity {
	return entity.TwoFAEntity{
		ID:        model.ID,
		UserID:    entity.UserIDEntity(model.UserID),
		Type:      entity.TwoFAType(model.Type),
		Secret:    model.Secret,
		Verified:  model.Verified,
		CreatedAt: model.CreatedAt,
		UpdatedAt: model.UpdatedAt,
	}
}
