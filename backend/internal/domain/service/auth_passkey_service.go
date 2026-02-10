package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/error_code"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/pkg/errors"
)

const passkeyChallengePrefix = "passkey:challenge:"

func NewAuthPasskeyService(
	userRepo repository.IUserRepository,
	accessTokenRepo repository.IAuthAccessTokenRepository,
	refreshTokenRepo repository.IAuthRefreshTokenRepository,
	passkeyRepo repository.IPasskeyRepository,
	cacheRepo repository.ICache,
	config config.Config,
) (*AuthPasskeyService, error) {
	wconfig := &webauthn.Config{
		RPDisplayName: config.WebAuthnRPName,
		RPID:          config.WebAuthnRPID,
		RPOrigins:     []string{config.WebAuthnRPOrigin},
	}

	w, err := webauthn.New(wconfig)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create webauthn instance")
	}

	return &AuthPasskeyService{
		userRepo:         userRepo,
		accessTokenRepo:  accessTokenRepo,
		refreshTokenRepo: refreshTokenRepo,
		passkeyRepo:      passkeyRepo,
		cacheRepo:        cacheRepo,
		webauthn:         w,
		config:           config,
	}, nil
}

type AuthPasskeyService struct {
	userRepo         repository.IUserRepository
	accessTokenRepo  repository.IAuthAccessTokenRepository
	refreshTokenRepo repository.IAuthRefreshTokenRepository
	passkeyRepo      repository.IPasskeyRepository
	cacheRepo        repository.ICache
	webauthn         *webauthn.WebAuthn
	config           config.Config
}

// webauthnUser implements webauthn.User interface
type webauthnUser struct {
	id          []byte
	name        string
	displayName string
	credentials []webauthn.Credential
}

func (u *webauthnUser) WebAuthnID() []byte                         { return u.id }
func (u *webauthnUser) WebAuthnName() string                       { return u.name }
func (u *webauthnUser) WebAuthnDisplayName() string                { return u.displayName }
func (u *webauthnUser) WebAuthnCredentials() []webauthn.Credential { return u.credentials }

// RegistrationChallenge generates challenge for passkey registration
func (s *AuthPasskeyService) RegistrationChallenge(ctx context.Context, userID entity.UserIDEntity) (*protocol.CredentialCreation, error) {
	// Get user info
	user, exists, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	if !exists {
		return nil, error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "user not found")
	}

	// Get existing credentials to exclude
	existingPasskeys, err := s.passkeyRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get existing passkeys")
	}

	credentials := make([]webauthn.Credential, len(existingPasskeys))
	for i, pk := range existingPasskeys {
		credentials[i] = webauthn.Credential{
			ID: pk.CredentialID,
		}
	}

	// Create webauthn user
	wuser := &webauthnUser{
		id:          []byte(userID),
		name:        user.Name,
		displayName: user.Name,
		credentials: credentials,
	}

	// Generate registration options
	options, session, err := s.webauthn.BeginRegistration(
		wuser,
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{
			ResidentKey:      protocol.ResidentKeyRequirementRequired,
			UserVerification: protocol.VerificationPreferred,
		}),
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin registration")
	}

	// Store session in cache
	sessionBytes, err := json.Marshal(session)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal session")
	}

	// Use userID as part of key to allow only one active registration flow per user.
	// If user requests a new challenge, the previous one will be overwritten intentionally.
	cacheKey := fmt.Sprintf("%s%s:register", passkeyChallengePrefix, userID)
	if err := s.cacheRepo.SetWithTTL(ctx, cacheKey, string(sessionBytes), uint64(s.config.WebAuthnChallengeTTL)); err != nil {
		return nil, errors.Wrap(err, "failed to store challenge in cache")
	}

	return options, nil
}

// FinishRegistration verifies the passkey registration response and stores the new credential.
func (s *AuthPasskeyService) FinishRegistration(ctx context.Context, userID entity.UserIDEntity, req entity.PasskeyRegisterRequestEntity, deviceName *string) (entity.PasskeyEntity, error) {
	user, exists, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to get user")
	}
	if !exists {
		return entity.PasskeyEntity{}, error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "user not found")
	}

	cacheKey := fmt.Sprintf("%s%s:register", passkeyChallengePrefix, userID)
	sessionJSON, ok, err := s.cacheRepo.Get(ctx, cacheKey)
	if err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to get passkey registration session")
	}
	if !ok {
		return entity.PasskeyEntity{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "passkey registration session not found or expired")
	}

	var session webauthn.SessionData
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to unmarshal passkey registration session")
	}

	existingPasskeys, err := s.passkeyRepo.GetByUserID(ctx, userID)
	if err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to get existing passkeys")
	}

	credentials := make([]webauthn.Credential, len(existingPasskeys))
	for i, pk := range existingPasskeys {
		credentials[i] = webauthn.Credential{
			ID: pk.CredentialID,
		}
	}

	wuser := &webauthnUser{
		id:          []byte(userID),
		name:        user.Name,
		displayName: user.Name,
		credentials: credentials,
	}

	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to marshal passkey registration payload")
	}

	parsedResponse, err := protocol.ParseCredentialCreationResponseBytes(payloadBytes)
	if err != nil {
		return entity.PasskeyEntity{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "%s", err.Error())
	}

	credential, err := s.webauthn.CreateCredential(wuser, session, parsedResponse)
	if err != nil {
		return entity.PasskeyEntity{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "%s", err.Error())
	}

	logger.Debugf(ctx, "Passkey registration credential parsed: id_len=%d, backup_eligible=%t, backup_state=%t, user_verified=%t, user_present=%t",
		len(credential.ID),
		credential.Flags.BackupEligible,
		credential.Flags.BackupState,
		credential.Flags.UserVerified,
		credential.Flags.UserPresent,
	)

	if _, exists, err := s.passkeyRepo.GetByCredentialID(ctx, credential.ID); err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to check existing passkey credential")
	} else if exists {
		return entity.PasskeyEntity{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "credential already registered")
	}

	var transports *string
	if len(credential.Transport) > 0 {
		items := make([]string, len(credential.Transport))
		for i, t := range credential.Transport {
			items[i] = string(t)
		}
		joined := strings.Join(items, ",")
		transports = &joined
	}

	passkey := entity.NewPasskeyEntity(
		userID,
		credential.ID,
		credential.PublicKey,
		int64(credential.Authenticator.SignCount),
		credential.Authenticator.AAGUID,
		transports,
		deviceName,
		boolPtr(credential.Flags.BackupEligible),
		boolPtr(credential.Flags.BackupState),
	)

	if err := s.passkeyRepo.Create(ctx, passkey); err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to store passkey")
	}

	if err := s.cacheRepo.Delete(ctx, cacheKey); err != nil {
		return entity.PasskeyEntity{}, errors.Wrap(err, "failed to delete passkey registration session")
	}

	return passkey, nil
}

// LoginChallenge generates challenge for passkey login (discoverable credentials)
func (s *AuthPasskeyService) LoginChallenge(ctx context.Context) (*protocol.CredentialAssertion, error) {
	options, session, err := s.webauthn.BeginDiscoverableLogin(
		webauthn.WithUserVerification(protocol.VerificationPreferred),
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin discoverable login")
	}

	sessionBytes, err := json.Marshal(session)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal session")
	}

	// Use challenge as cache key since we don't have userID for discoverable login
	cacheKey := fmt.Sprintf("%s%s:login", passkeyChallengePrefix, session.Challenge)
	if err := s.cacheRepo.SetWithTTL(ctx, cacheKey, string(sessionBytes), uint64(s.config.WebAuthnChallengeTTL)); err != nil {
		return nil, errors.Wrap(err, "failed to store challenge in cache")
	}

	return options, nil
}

// GetPasskeys retrieves all passkeys for a user
func (s *AuthPasskeyService) GetPasskeys(ctx context.Context, userID entity.UserIDEntity) ([]entity.PasskeyEntity, error) {
	passkeys, err := s.passkeyRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get passkeys")
	}
	return passkeys, nil
}

// DeletePasskey deletes a passkey for a user by passkey ID
func (s *AuthPasskeyService) DeletePasskey(ctx context.Context, userID entity.UserIDEntity, passkeyID int64) error {
	if err := s.passkeyRepo.Delete(ctx, passkeyID, userID); err != nil {
		return errors.Wrap(err, "failed to delete passkey")
	}
	return nil
}

// FinishLogin verifies the passkey login response and returns tokens
func (s *AuthPasskeyService) FinishLogin(ctx context.Context, req entity.PasskeyLoginRequestEntity) (entity.AccessToken, entity.RefreshToken, error) {
	parsedResponse, err := req.Parse()
	if err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "%s", err.Error())
	}

	logger.Debugf(ctx, "Passkey login response parsed: raw_id_len=%d, backup_eligible=%t, backup_state=%t, user_verified=%t, user_present=%t",
		len(parsedResponse.RawID),
		parsedResponse.Response.AuthenticatorData.Flags.HasBackupEligible(),
		parsedResponse.Response.AuthenticatorData.Flags.HasBackupState(),
		parsedResponse.Response.AuthenticatorData.Flags.HasUserVerified(),
		parsedResponse.Response.AuthenticatorData.Flags.HasUserPresent(),
	)

	// Get session from cache using challenge
	challenge := parsedResponse.Response.CollectedClientData.Challenge
	cacheKey := fmt.Sprintf("%s%s:login", passkeyChallengePrefix, challenge)
	sessionJSON, ok, err := s.cacheRepo.Get(ctx, cacheKey)
	if err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to get passkey login session")
	}
	if !ok {
		return entity.AccessToken{}, entity.RefreshToken{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "passkey login session not found or expired")
	}

	var session webauthn.SessionData
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to unmarshal passkey login session")
	}

	// Variables to capture user info from the handler
	var foundUserID entity.UserIDEntity
	var foundPasskey entity.PasskeyEntity

	// User handler for discoverable login - looks up user by userHandle (which is userID)
	userHandler := func(rawID, userHandle []byte) (webauthn.User, error) {
		userID := entity.UserIDEntity(userHandle)

		user, exists, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get user")
		}
		if !exists {
			return nil, error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "user not found")
		}

		// Get user's passkeys to find the matching credential
		passkeys, err := s.passkeyRepo.GetByUserID(ctx, userID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get user passkeys")
		}

		var credentials []webauthn.Credential
		for _, pk := range passkeys {
			var transports []protocol.AuthenticatorTransport
			if pk.Transports != nil {
				for _, t := range strings.Split(*pk.Transports, ",") {
					transports = append(transports, protocol.AuthenticatorTransport(t))
				}
			}

			credential := webauthn.Credential{
				ID:              pk.CredentialID,
				PublicKey:       pk.PublicKey,
				AttestationType: "",
				Transport:       transports,
				Authenticator: webauthn.Authenticator{
					AAGUID:    pk.AAGUID,
					SignCount: uint32(pk.SignCount),
				},
			}

			if pk.BackupEligible != nil {
				credential.Flags.BackupEligible = *pk.BackupEligible
			}
			if pk.BackupState != nil {
				credential.Flags.BackupState = *pk.BackupState
			}

			// Check if this is the credential being used
			if string(pk.CredentialID) == string(rawID) {
				if pk.BackupEligible == nil {
					credential.Flags.BackupEligible = parsedResponse.Response.AuthenticatorData.Flags.HasBackupEligible()
				}
				if pk.BackupState == nil {
					credential.Flags.BackupState = parsedResponse.Response.AuthenticatorData.Flags.HasBackupState()
				}
				foundPasskey = pk
			}

			credentials = append(credentials, credential)
		}

		foundUserID = userID

		return &webauthnUser{
			id:          []byte(userID),
			name:        user.Name,
			displayName: user.Name,
			credentials: credentials,
		}, nil
	}

	// Validate the login
	credential, err := s.webauthn.ValidateDiscoverableLogin(userHandler, session, parsedResponse)
	if err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "%s", err.Error())
	}

	// Ensure we found the matching passkey
	if foundPasskey.ID == 0 {
		return entity.AccessToken{}, entity.RefreshToken{}, error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "passkey credential not found")
	}

	// Update sign count
	if err := s.passkeyRepo.UpdateSignCount(ctx, foundPasskey.ID, int64(credential.Authenticator.SignCount)); err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to update sign count")
	}

	// Update last used at
	if err := s.passkeyRepo.UpdateLastUsedAt(ctx, foundPasskey.ID); err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to update last used at")
	}

	// Delete session from cache
	if err := s.cacheRepo.Delete(ctx, cacheKey); err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to delete passkey login session")
	}

	// Generate tokens
	refreshToken, err := s.refreshTokenRepo.IssueRefreshToken(ctx, foundUserID)
	if err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to create refresh token")
	}

	accessToken, err := s.accessTokenRepo.IssueAccessToken(ctx, foundUserID, refreshToken.TokenHash)
	if err != nil {
		return entity.AccessToken{}, entity.RefreshToken{}, errors.Wrap(err, "failed to create access token")
	}

	return accessToken, refreshToken, nil
}

func boolPtr(value bool) *bool {
	return &value
}
