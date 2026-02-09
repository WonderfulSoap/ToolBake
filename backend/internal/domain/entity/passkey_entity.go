package entity

import (
	"time"

	"github.com/go-webauthn/webauthn/protocol"
)

type PasskeyEntity struct {
	ID             int64
	UserID         UserIDEntity
	CredentialID   []byte
	PublicKey      []byte
	SignCount      int64
	AAGUID         []byte
	Transports     *string
	DeviceName     *string
	BackupEligible *bool
	BackupState    *bool
	CreatedAt      time.Time
	LastUsedAt     *time.Time
}

// PasskeyRegisterRequestEntity is an alias of WebAuthn CredentialCreationResponse payload.
type PasskeyRegisterRequestEntity = protocol.CredentialCreationResponse

// PasskeyLoginRequestEntity is an alias of WebAuthn CredentialAssertionResponse payload.
type PasskeyLoginRequestEntity = protocol.CredentialAssertionResponse

func NewPasskeyEntity(
	userID UserIDEntity,
	credentialID []byte,
	publicKey []byte,
	signCount int64,
	aaguid []byte,
	transports *string,
	deviceName *string,
	backupEligible *bool,
	backupState *bool,
) PasskeyEntity {
	return PasskeyEntity{
		UserID:         userID,
		CredentialID:   credentialID,
		PublicKey:      publicKey,
		SignCount:      signCount,
		AAGUID:         aaguid,
		Transports:     transports,
		DeviceName:     deviceName,
		BackupEligible: backupEligible,
		BackupState:    backupState,
		CreatedAt:      time.Now(),
	}
}
