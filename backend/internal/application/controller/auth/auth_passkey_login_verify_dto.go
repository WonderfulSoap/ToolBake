package auth

import (
	"ya-tool-craft/internal/domain/entity"

	"github.com/go-webauthn/webauthn/protocol"
)

// PasskeyLoginRequestDto represents the WebAuthn credential assertion response
// This is returned from navigator.credentials.get() on the client side
type PasskeyLoginRequestDto struct {
	ID                      string                      `json:"id" binding:"required" example:"base64url-encoded-credential-id"`
	RawID                   string                      `json:"rawId" binding:"required" example:"base64url-encoded-raw-id"`
	Type                    string                      `json:"type" binding:"required" example:"public-key"`
	Response                PasskeyAssertionResponseDto `json:"response" binding:"required"`
	ClientExtensionResults  map[string]any              `json:"clientExtensionResults,omitempty"`
	AuthenticatorAttachment string                      `json:"authenticatorAttachment,omitempty" example:"cross-platform"`
}

type PasskeyAssertionResponseDto struct {
	ClientDataJSON    string `json:"clientDataJSON" binding:"required" example:"base64url-encoded-client-data-json"`
	AuthenticatorData string `json:"authenticatorData" binding:"required" example:"base64url-encoded-authenticator-data"`
	Signature         string `json:"signature" binding:"required" example:"base64url-encoded-signature"`
	UserHandle        string `json:"userHandle,omitempty" example:"base64url-encoded-user-handle"`
}

func (d *PasskeyLoginRequestDto) ToEntity() (entity.PasskeyLoginRequestEntity, error) {
	rawID, err := decodeBase64URL(d.RawID)
	if err != nil {
		return entity.PasskeyLoginRequestEntity{}, err
	}

	clientDataJSON, err := decodeBase64URL(d.Response.ClientDataJSON)
	if err != nil {
		return entity.PasskeyLoginRequestEntity{}, err
	}

	authenticatorData, err := decodeBase64URL(d.Response.AuthenticatorData)
	if err != nil {
		return entity.PasskeyLoginRequestEntity{}, err
	}

	signature, err := decodeBase64URL(d.Response.Signature)
	if err != nil {
		return entity.PasskeyLoginRequestEntity{}, err
	}

	var userHandle []byte
	if d.Response.UserHandle != "" {
		userHandle, err = decodeBase64URL(d.Response.UserHandle)
		if err != nil {
			return entity.PasskeyLoginRequestEntity{}, err
		}
	}

	return entity.PasskeyLoginRequestEntity{
		PublicKeyCredential: protocol.PublicKeyCredential{
			Credential: protocol.Credential{
				ID:   d.ID,
				Type: d.Type,
			},
			RawID:                   protocol.URLEncodedBase64(rawID),
			ClientExtensionResults:  d.ClientExtensionResults,
			AuthenticatorAttachment: d.AuthenticatorAttachment,
		},
		AssertionResponse: protocol.AuthenticatorAssertionResponse{
			AuthenticatorResponse: protocol.AuthenticatorResponse{
				ClientDataJSON: protocol.URLEncodedBase64(clientDataJSON),
			},
			AuthenticatorData: protocol.URLEncodedBase64(authenticatorData),
			Signature:         protocol.URLEncodedBase64(signature),
			UserHandle:        protocol.URLEncodedBase64(userHandle),
		},
	}, nil
}
