package auth

import "github.com/go-webauthn/webauthn/protocol"

// PasskeyChallengeResponseDto represents the WebAuthn credential creation options
// This is passed to navigator.credentials.create() on the client side
type PasskeyChallengeResponseDto struct {
	PublicKey PublicKeyCredentialCreationOptionsDto `json:"publicKey"`
}

type PublicKeyCredentialCreationOptionsDto struct {
	Challenge          string                             `json:"challenge" example:"base64url-encoded-challenge"`
	Timeout            int                                `json:"timeout" example:"300000"`
	RelyingParty       RelyingPartyDto                    `json:"rp"`
	User               UserEntityDto                      `json:"user"`
	PubKeyCredParams   []PubKeyCredParamDto               `json:"pubKeyCredParams"`
	AuthSelection      *AuthenticatorSelectionCriteriaDto `json:"authenticatorSelection,omitempty"`
	Attestation        string                             `json:"attestation" example:"none"`
	ExcludeCredentials []PublicKeyCredentialDescriptorDto `json:"excludeCredentials,omitempty"`
}

type RelyingPartyDto struct {
	ID   string `json:"id" example:"localhost"`
	Name string `json:"name" example:"ToolBake"`
}

type UserEntityDto struct {
	ID          string `json:"id" example:"base64url-encoded-user-id"`
	Name        string `json:"name" example:"user@example.com"`
	DisplayName string `json:"displayName" example:"John Doe"`
}

type PubKeyCredParamDto struct {
	Type string `json:"type" example:"public-key"`
	Alg  int64  `json:"alg" example:"-7"`
}

type AuthenticatorSelectionCriteriaDto struct {
	AuthenticatorAttachment string `json:"authenticatorAttachment,omitempty" example:"platform"`
	RequireResidentKey      bool   `json:"requireResidentKey,omitempty"`
	ResidentKey             string `json:"residentKey,omitempty" example:"preferred"`
	UserVerification        string `json:"userVerification,omitempty" example:"preferred"`
}

type PublicKeyCredentialDescriptorDto struct {
	Type       string   `json:"type" example:"public-key"`
	ID         string   `json:"id" example:"base64url-encoded-credential-id"`
	Transports []string `json:"transports,omitempty"`
}

// FromProtocol converts protocol.CredentialCreation to PasskeyChallengeResponseDto
func (dto *PasskeyChallengeResponseDto) FromProtocol(creation *protocol.CredentialCreation) {
	opts := creation.Response

	// Convert user ID (any type) to string
	var userID string
	if id, ok := opts.User.ID.(protocol.URLEncodedBase64); ok {
		userID = string(id)
	} else if id, ok := opts.User.ID.([]byte); ok {
		userID = string(id)
	}

	dto.PublicKey = PublicKeyCredentialCreationOptionsDto{
		Challenge:   string(opts.Challenge),
		Timeout:     opts.Timeout,
		Attestation: string(opts.Attestation),
		RelyingParty: RelyingPartyDto{
			ID:   opts.RelyingParty.ID,
			Name: opts.RelyingParty.Name,
		},
		User: UserEntityDto{
			ID:          userID,
			Name:        opts.User.Name,
			DisplayName: opts.User.DisplayName,
		},
	}

	// Convert pubKeyCredParams
	dto.PublicKey.PubKeyCredParams = make([]PubKeyCredParamDto, len(opts.Parameters))
	for i, param := range opts.Parameters {
		dto.PublicKey.PubKeyCredParams[i] = PubKeyCredParamDto{
			Type: string(param.Type),
			Alg:  int64(param.Algorithm),
		}
	}

	// Convert authenticatorSelection
	if opts.AuthenticatorSelection.UserVerification != "" ||
		opts.AuthenticatorSelection.AuthenticatorAttachment != "" ||
		opts.AuthenticatorSelection.ResidentKey != "" {
		dto.PublicKey.AuthSelection = &AuthenticatorSelectionCriteriaDto{
			AuthenticatorAttachment: string(opts.AuthenticatorSelection.AuthenticatorAttachment),
			RequireResidentKey:      opts.AuthenticatorSelection.RequireResidentKey != nil && *opts.AuthenticatorSelection.RequireResidentKey,
			ResidentKey:             string(opts.AuthenticatorSelection.ResidentKey),
			UserVerification:        string(opts.AuthenticatorSelection.UserVerification),
		}
	}

	// Convert excludeCredentials
	if len(opts.CredentialExcludeList) > 0 {
		dto.PublicKey.ExcludeCredentials = make([]PublicKeyCredentialDescriptorDto, len(opts.CredentialExcludeList))
		for i, cred := range opts.CredentialExcludeList {
			transports := make([]string, len(cred.Transport))
			for j, t := range cred.Transport {
				transports[j] = string(t)
			}
			dto.PublicKey.ExcludeCredentials[i] = PublicKeyCredentialDescriptorDto{
				Type:       string(cred.Type),
				ID:         string(cred.CredentialID),
				Transports: transports,
			}
		}
	}
}
