package repository_impl

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"

	"github.com/pkg/errors"
)

type PasskeyRdsModel struct {
	ID           int64          `db:"id"`
	UserID       string         `db:"user_id"`
	CredentialID []byte         `db:"credential_id"`
	PublicKey    []byte         `db:"public_key"`
	SignCount    int64          `db:"sign_count"`
	AAGUID       []byte         `db:"aaguid"`
	Transports   sql.NullString `db:"transports"`
	DeviceName   sql.NullString `db:"device_name"`
	ExtraInfo    string         `db:"extra_info"`
	CreatedAt    time.Time      `db:"created_at"`
	LastUsedAt   sql.NullTime   `db:"last_used_at"`
}

func NewPasskeyRepositoryRdsImpl(client repository.IRdsClient) *PasskeyRepositoryRdsImpl {
	return &PasskeyRepositoryRdsImpl{client: client}
}

type PasskeyRepositoryRdsImpl struct {
	client repository.IRdsClient
}

func (r *PasskeyRepositoryRdsImpl) Create(ctx context.Context, passkey entity.PasskeyEntity) error {
	db := r.client.DB()

	transports := sql.NullString{}
	if passkey.Transports != nil {
		transports.String = *passkey.Transports
		transports.Valid = true
	}

	deviceName := sql.NullString{}
	if passkey.DeviceName != nil {
		deviceName.String = *passkey.DeviceName
		deviceName.Valid = true
	}

	extraInfoJSON, err := encodePasskeyExtraInfo(passkey.BackupEligible, passkey.BackupState)
	if err != nil {
		return errors.Wrap(err, "failed to encode passkey extra info")
	}

	_, err = db.Exec(
		`INSERT INTO user_passkeys (user_id, credential_id, public_key, sign_count, aaguid, transports, device_name, extra_info, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		string(passkey.UserID),
		passkey.CredentialID,
		passkey.PublicKey,
		passkey.SignCount,
		passkey.AAGUID,
		transports,
		deviceName,
		extraInfoJSON,
		passkey.CreatedAt,
	)
	if err != nil {
		return errors.Wrap(err, "failed to insert passkey into rds")
	}

	return nil
}

func (r *PasskeyRepositoryRdsImpl) GetByCredentialID(ctx context.Context, credentialID []byte) (entity.PasskeyEntity, bool, error) {
	db := r.client.DB()
	var model PasskeyRdsModel

	err := db.Get(&model, "SELECT * FROM user_passkeys WHERE credential_id = ?", credentialID)
	if err != nil {
		if err == sql.ErrNoRows {
			return entity.PasskeyEntity{}, false, nil
		}
		return entity.PasskeyEntity{}, false, errors.Wrap(err, "failed to get passkey by credential_id from rds")
	}

	return r.toEntity(&model), true, nil
}

func (r *PasskeyRepositoryRdsImpl) GetByUserID(ctx context.Context, userID entity.UserIDEntity) ([]entity.PasskeyEntity, error) {
	db := r.client.DB()
	var models []PasskeyRdsModel

	err := db.Select(&models, "SELECT * FROM user_passkeys WHERE user_id = ? ORDER BY created_at ASC", string(userID))
	if err != nil {
		return nil, errors.Wrap(err, "failed to get passkeys by user_id from rds")
	}

	passkeys := make([]entity.PasskeyEntity, len(models))
	for i, model := range models {
		passkeys[i] = r.toEntity(&model)
	}

	return passkeys, nil
}

func (r *PasskeyRepositoryRdsImpl) UpdateSignCount(ctx context.Context, id int64, signCount int64) error {
	db := r.client.DB()

	_, err := db.Exec("UPDATE user_passkeys SET sign_count = ? WHERE id = ?", signCount, id)
	if err != nil {
		return errors.Wrap(err, "failed to update passkey sign_count in rds")
	}

	return nil
}

func (r *PasskeyRepositoryRdsImpl) UpdateLastUsedAt(ctx context.Context, id int64) error {
	db := r.client.DB()
	now := time.Now()

	_, err := db.Exec("UPDATE user_passkeys SET last_used_at = ? WHERE id = ?", now, id)
	if err != nil {
		return errors.Wrap(err, "failed to update passkey last_used_at in rds")
	}

	return nil
}

func (r *PasskeyRepositoryRdsImpl) Delete(ctx context.Context, id int64, userID entity.UserIDEntity) error {
	db := r.client.DB()

	_, err := db.Exec("DELETE FROM user_passkeys WHERE id = ? AND user_id = ?", id, string(userID))
	if err != nil {
		return errors.Wrap(err, "failed to delete passkey from rds")
	}

	return nil
}

func (r *PasskeyRepositoryRdsImpl) DeleteByUserID(ctx context.Context, userID entity.UserIDEntity) error {
	db := r.client.DB()

	_, err := db.Exec("DELETE FROM user_passkeys WHERE user_id = ?", string(userID))
	if err != nil {
		return errors.Wrap(err, "failed to delete passkeys by user_id from rds")
	}

	return nil
}

func (r *PasskeyRepositoryRdsImpl) toEntity(model *PasskeyRdsModel) entity.PasskeyEntity {
	var transports *string
	if model.Transports.Valid {
		transports = &model.Transports.String
	}

	var deviceName *string
	if model.DeviceName.Valid {
		deviceName = &model.DeviceName.String
	}

	var lastUsedAt *time.Time
	if model.LastUsedAt.Valid {
		lastUsedAt = &model.LastUsedAt.Time
	}

	decodedExtraInfo := decodePasskeyExtraInfo(model.ExtraInfo)
	return entity.PasskeyEntity{
		ID:             model.ID,
		UserID:         entity.UserIDEntity(model.UserID),
		CredentialID:   model.CredentialID,
		PublicKey:      model.PublicKey,
		SignCount:      model.SignCount,
		AAGUID:         model.AAGUID,
		Transports:     transports,
		DeviceName:     deviceName,
		BackupEligible: decodedExtraInfo.backupEligible,
		BackupState:    decodedExtraInfo.backupState,
		CreatedAt:      model.CreatedAt,
		LastUsedAt:     lastUsedAt,
	}
}

type passkeyExtraInfoModel struct {
	BackupEligible *bool `json:"backup_eligible,omitempty"`
	BackupState    *bool `json:"backup_state,omitempty"`
}

type decodedPasskeyExtraInfo struct {
	backupEligible *bool
	backupState    *bool
}

func encodePasskeyExtraInfo(backupEligible *bool, backupState *bool) (string, error) {
	model := passkeyExtraInfoModel{
		BackupEligible: backupEligible,
		BackupState:    backupState,
	}
	encoded, err := json.Marshal(model)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func decodePasskeyExtraInfo(raw string) decodedPasskeyExtraInfo {
	if raw == "" {
		return decodedPasskeyExtraInfo{}
	}

	var decoded passkeyExtraInfoModel
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return decodedPasskeyExtraInfo{}
	}
	return decodedPasskeyExtraInfo{
		backupEligible: decoded.BackupEligible,
		backupState:    decoded.BackupState,
	}
}
