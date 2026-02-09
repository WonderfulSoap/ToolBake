package auth

import (
	"encoding/base64"
	"time"

	"ya-tool-craft/internal/domain/entity"
)

type PasskeyDto struct {
	ID             int64      `json:"id"`
	CredentialID   string     `json:"credential_id"`
	DeviceName     *string    `json:"device_name"`
	BackupEligible *bool      `json:"backup_eligible"`
	BackupState    *bool      `json:"backup_state"`
	CreatedAt      time.Time  `json:"created_at"`
	LastUsedAt     *time.Time `json:"last_used_at"`
}

type PasskeyGetResponseDto struct {
	Passkeys []PasskeyDto `json:"passkeys"`
}

func (d *PasskeyGetResponseDto) FromEntity(passkeys []entity.PasskeyEntity) {
	d.Passkeys = make([]PasskeyDto, len(passkeys))
	for i, passkey := range passkeys {
		d.Passkeys[i] = PasskeyDto{
			ID:             passkey.ID,
			CredentialID:   base64.RawURLEncoding.EncodeToString(passkey.CredentialID),
			DeviceName:     passkey.DeviceName,
			BackupEligible: passkey.BackupEligible,
			BackupState:    passkey.BackupState,
			CreatedAt:      passkey.CreatedAt,
			LastUsedAt:     passkey.LastUsedAt,
		}
	}
}
