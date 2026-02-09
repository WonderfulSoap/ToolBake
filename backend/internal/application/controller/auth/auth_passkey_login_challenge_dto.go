package auth

import "github.com/go-webauthn/webauthn/protocol"

// PasskeyLoginChallengeResponseDto represents the WebAuthn credential request options
// This is passed to navigator.credentials.get() on the client side
type PasskeyLoginChallengeResponseDto struct {
	PublicKey PublicKeyCredentialRequestOptionsDto `json:"publicKey"`
}

type PublicKeyCredentialRequestOptionsDto struct {
	Challenge        string                             `json:"challenge" example:"base64url-encoded-challenge"`
	Timeout          int                                `json:"timeout" example:"300000"`
	RpID             string                             `json:"rpId" example:"localhost"`
	AllowCredentials []PublicKeyCredentialDescriptorDto `json:"allowCredentials,omitempty"`
	UserVerification string                             `json:"userVerification,omitempty" example:"preferred"`
}

// FromProtocol converts protocol.CredentialAssertion to PasskeyLoginChallengeResponseDto
func (dto *PasskeyLoginChallengeResponseDto) FromProtocol(assertion *protocol.CredentialAssertion) {
	opts := assertion.Response

	dto.PublicKey = PublicKeyCredentialRequestOptionsDto{
		Challenge:        string(opts.Challenge),
		Timeout:          opts.Timeout,
		RpID:             opts.RelyingPartyID,
		UserVerification: string(opts.UserVerification),
	}

	// Convert allowCredentials
	if len(opts.AllowedCredentials) > 0 {
		dto.PublicKey.AllowCredentials = make([]PublicKeyCredentialDescriptorDto, len(opts.AllowedCredentials))
		for i, cred := range opts.AllowedCredentials {
			transports := make([]string, len(cred.Transport))
			for j, t := range cred.Transport {
				transports[j] = string(t)
			}
			dto.PublicKey.AllowCredentials[i] = PublicKeyCredentialDescriptorDto{
				Type:       string(cred.Type),
				ID:         string(cred.CredentialID),
				Transports: transports,
			}
		}
	}
}
