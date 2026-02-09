package auth

import (
	"encoding/base64"

	"ya-tool-craft/internal/domain/entity"

	"github.com/go-webauthn/webauthn/protocol"
)

// PasskeyRegisterRequestDto represents the WebAuthn credential creation response
// This is returned from navigator.credentials.create() on the client side
type PasskeyRegisterRequestDto struct {
	ID                      string                        `json:"id" binding:"required" example:"base64url-encoded-credential-id"`
	RawID                   string                        `json:"rawId" binding:"required" example:"base64url-encoded-raw-id"`
	Type                    string                        `json:"type" binding:"required" example:"public-key"`
	Response                PasskeyAttestationResponseDto `json:"response" binding:"required"`
	ClientExtensionResults  map[string]any                `json:"clientExtensionResults,omitempty"`
	AuthenticatorAttachment string                        `json:"authenticatorAttachment,omitempty" example:"platform"`
	DeviceName              *string                       `json:"deviceName,omitempty" example:"MacBook Pro"`
}

type PasskeyAttestationResponseDto struct {
	ClientDataJSON    string   `json:"clientDataJSON" binding:"required" example:"base64url-encoded-client-data-json"`
	AttestationObject string   `json:"attestationObject" binding:"required" example:"base64url-encoded-attestation-object"`
	Transports        []string `json:"transports,omitempty"`
}

func (d *PasskeyRegisterRequestDto) ToEntity() (entity.PasskeyRegisterRequestEntity, error) {
	rawID, err := decodeBase64URL(d.RawID)
	if err != nil {
		return entity.PasskeyRegisterRequestEntity{}, err
	}

	clientDataJSON, err := decodeBase64URL(d.Response.ClientDataJSON)
	if err != nil {
		return entity.PasskeyRegisterRequestEntity{}, err
	}

	attestationObject, err := decodeBase64URL(d.Response.AttestationObject)
	if err != nil {
		return entity.PasskeyRegisterRequestEntity{}, err
	}

	return entity.PasskeyRegisterRequestEntity{
		PublicKeyCredential: protocol.PublicKeyCredential{
			Credential: protocol.Credential{
				ID:   d.ID,
				Type: d.Type,
			},
			RawID:                   protocol.URLEncodedBase64(rawID),
			ClientExtensionResults:  d.ClientExtensionResults,
			AuthenticatorAttachment: d.AuthenticatorAttachment,
		},
		AttestationResponse: protocol.AuthenticatorAttestationResponse{
			AuthenticatorResponse: protocol.AuthenticatorResponse{
				ClientDataJSON: protocol.URLEncodedBase64(clientDataJSON),
			},
			AttestationObject: protocol.URLEncodedBase64(attestationObject),
			Transports:        d.Response.Transports,
		},
	}, nil
}

func decodeBase64URL(value string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(value)
}
