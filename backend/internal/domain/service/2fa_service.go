package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"strings"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/error_code"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"
	"github.com/pkg/errors"
	"github.com/pquerna/otp/totp"
)

func NewTwoFaService(
	twoFARepo repository.IAuth2FARepository,
	userRepo repository.IUserRepository,
	accessTokenRepo repository.IAuthAccessTokenRepository,
	refreshTokenRepo repository.IAuthRefreshTokenRepository,
	cacheRepo repository.ICache,
	config config.Config,
) (*TwoFAService, error) {
	return &TwoFAService{
		twoFARepo:        twoFARepo,
		userRepo:         userRepo,
		accessTokenRepo:  accessTokenRepo,
		refreshTokenRepo: refreshTokenRepo,
		cacheRepo:        cacheRepo,
		config:           config,
	}, nil
}

type TwoFAService struct {
	twoFARepo repository.IAuth2FARepository

	userRepo         repository.IUserRepository
	accessTokenRepo  repository.IAuthAccessTokenRepository
	refreshTokenRepo repository.IAuthRefreshTokenRepository
	cacheRepo        repository.ICache
	config           config.Config
}

const (
	totpCacheKeyPrefix       = "totp_pending:"
	totpCacheTTL             = 300 // 5 minutes
	totpVerifyCacheKeyPrefix = "totp_verify:"
	totpVerifyCacheTTL       = 300 // 5 minutes
	recoveryCodeWordCount    = 50
)

type TOTPSetupInfo struct {
	Token  string // random token for verification
	Secret string
	URL    string
	QRCode string // base64 encoded PNG image
}

// totpCacheData is the structure stored in cache
type totpCacheData struct {
	Token  string `json:"token"`
	Secret string `json:"secret"`
	UserID string `json:"user_id"`
}

// totpVerifyCacheData is the structure stored in cache for 2FA verification during sensitive operations
type totpVerifyCacheData struct {
	Token  string `json:"token"`
	UserID string `json:"user_id"`
}

// GenerateNewTOTPForUser generates a new TOTP secret for a user and caches it for verification
func (s *TwoFAService) GenerateNewTOTPForUser(ctx context.Context, userID entity.UserIDEntity, username string) (*TOTPSetupInfo, error) {
	// Check if user already has TOTP enabled
	_, exists, err := s.twoFARepo.GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP)
	if err != nil {
		return nil, errors.Wrap(err, "fail to check existing totp")
	}
	if exists {
		return nil, error_code.NewErrorWithErrorCodef(error_code.TwoFaAlreadyEnabled, "please remove existing TOTP before generating a new one")
	}

	// Generate TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      s.config.WebAuthnRPName,
		AccountName: username,
	})
	if err != nil {
		return nil, errors.Wrap(err, "fail to generate totp key")
	}

	secret := key.Secret()

	// Generate random token
	token := fmt.Sprintf("2fa-totp-%s", uuid.New().String())

	// Generate QR code image
	img, err := key.Image(200, 200)
	if err != nil {
		return nil, errors.Wrap(err, "fail to generate qr code image")
	}

	// Encode image to base64
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, errors.Wrap(err, "fail to encode qr code to png")
	}
	qrCode := base64.StdEncoding.EncodeToString(buf.Bytes())

	// Cache the data as JSON with TTL for later verification
	cacheData := totpCacheData{
		Token:  token,
		Secret: secret,
		UserID: string(userID),
	}
	cacheJSON, err := json.Marshal(cacheData)
	if err != nil {
		return nil, errors.Wrap(err, "fail to marshal totp cache data")
	}

	cacheKey := fmt.Sprintf("%s%s", totpCacheKeyPrefix, token)
	err = s.cacheRepo.SetWithTTL(ctx, cacheKey, string(cacheJSON), totpCacheTTL)
	if err != nil {
		return nil, errors.Wrap(err, "fail to cache totp secret")
	}

	return &TOTPSetupInfo{
		Token:  token,
		Secret: secret,
		URL:    key.URL(),
		QRCode: qrCode,
	}, nil
}

// GetPendingTOTPByToken retrieves the pending TOTP data from cache by token
func (s *TwoFAService) GetPendingTOTPByToken(ctx context.Context, token string) (*totpCacheData, bool, error) {
	cacheKey := fmt.Sprintf("%s%s", totpCacheKeyPrefix, token)
	cacheJSON, exists, err := s.cacheRepo.Get(ctx, cacheKey)
	if err != nil {
		return nil, false, errors.Wrap(err, "fail to get totp cache data")
	}
	if !exists {
		return nil, false, nil
	}

	var cacheData totpCacheData
	if err := json.Unmarshal([]byte(cacheJSON), &cacheData); err != nil {
		return nil, false, errors.Wrap(err, "fail to unmarshal totp cache data")
	}

	return &cacheData, true, nil
}

// ClearPendingTOTP removes the pending TOTP data from cache by token
func (s *TwoFAService) ClearPendingTOTP(ctx context.Context, token string) error {
	cacheKey := fmt.Sprintf("%s%s", totpCacheKeyPrefix, token)
	return s.cacheRepo.Delete(ctx, cacheKey)
}

// TwoFAInfo represents the 2FA status for a user
type TwoFAInfo struct {
	Type      entity.TwoFAType
	Enabled   bool
	CreatedAt time.Time
}

// Get2FAInfo retrieves the 2FA information for a user
func (s *TwoFAService) Get2FAInfo(ctx context.Context, userID entity.UserIDEntity) ([]TwoFAInfo, error) {
	twoFAs, err := s.twoFARepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "fail to get 2fa info")
	}

	result := make([]TwoFAInfo, 0, len(twoFAs))
	for _, twoFA := range twoFAs {
		result = append(result, TwoFAInfo{
			Type:      twoFA.Type,
			Enabled:   twoFA.Verified,
			CreatedAt: twoFA.CreatedAt,
		})
	}

	return result, nil
}

// generateRecoveryCode generates a readable recovery code using random words
func (s *TwoFAService) generateRecoveryCode() string {
	words := make([]string, recoveryCodeWordCount)
	for i := 0; i < len(words); i++ {
		words[i] = gofakeit.Word()
	}
	return strings.Join(words, " ")
}

// VerifyAndEnableTOTP verifies the TOTP code and enables 2FA for the user
// It requires the token from GenerateNewTOTPForUser and the TOTP code from the authenticator app
// Returns the recovery code that can be used to disable 2FA
func (s *TwoFAService) VerifyAndEnableTOTP(ctx context.Context, userID entity.UserIDEntity, token string, code string) (recoveryCode string, err error) {
	// Check if user already has TOTP enabled
	_, exists, err := s.twoFARepo.GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP)
	if err != nil {
		return "", errors.Wrap(err, "fail to check existing totp")
	}
	if exists {
		return "", error_code.NewErrorWithErrorCodef(error_code.TwoFaAlreadyEnabled, "please remove existing TOTP before adding a new one")
	}

	// Get pending TOTP data from cache
	cacheData, exists, err := s.GetPendingTOTPByToken(ctx, token)
	if err != nil {
		return "", errors.Wrap(err, "fail to get pending totp data")
	}
	if !exists {
		return "", errors.New("TOTP setup session expired or invalid token, please regenerate a new TOTP")
	}

	// Verify that the token belongs to the current user
	if cacheData.UserID != string(userID) {
		return "", errors.Errorf("token does not belong to the current user: expected %s, got %s, token_id: %s", cacheData.UserID, userID, token)
	}

	// Verify the TOTP code
	valid := totp.Validate(code, cacheData.Secret)
	if !valid {
		return "", error_code.NewErrorWithErrorCodef(error_code.InvalidTotpCode, "please try again")
	}

	// Create 2FA record in database
	twoFAEntity := entity.NewTwoFAEntity(userID, entity.TwoFATypeTOTP, cacheData.Secret)
	twoFAEntity.Verified = true
	if err := s.twoFARepo.Create(ctx, twoFAEntity); err != nil {
		return "", errors.Wrap(err, "fail to save totp 2fa")
	}

	// Generate and save recovery code
	recoveryCode = s.generateRecoveryCode()
	if err := s.twoFARepo.SetRecoveryCode(ctx, userID, recoveryCode); err != nil {
		return "", errors.Wrap(err, "fail to save recovery code")
	}

	// Clear the pending TOTP from cache
	if err := s.ClearPendingTOTP(ctx, token); err != nil {
		// Log but don't fail - the 2FA is already enabled
		// The cache will expire anyway
	}

	return recoveryCode, nil
}

// Get2FAToken checks if user has 2FA enabled and returns a token for verification
// Returns nil if 2FA is not enabled for the user
func (s *TwoFAService) Get2FAToken(ctx context.Context, userID entity.UserIDEntity) (*string, error) {
	// Check if user has TOTP enabled
	twoFA, exists, err := s.twoFARepo.GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP)
	if err != nil {
		return nil, errors.Wrap(err, "fail to check 2fa status")
	}
	if !exists || !twoFA.Verified {
		return nil, nil
	}

	// Generate random token
	token := fmt.Sprintf("2fa-totp-verify-%s", uuid.New().String())

	// Cache the data for later verification
	cacheData := totpVerifyCacheData{
		Token:  token,
		UserID: string(userID),
	}
	cacheJSON, err := json.Marshal(cacheData)
	if err != nil {
		return nil, errors.Wrap(err, "fail to marshal totp verify cache data")
	}

	cacheKey := fmt.Sprintf("%s%s", totpVerifyCacheKeyPrefix, token)
	err = s.cacheRepo.SetWithTTL(ctx, cacheKey, string(cacheJSON), totpVerifyCacheTTL)
	if err != nil {
		return nil, errors.Wrap(err, "fail to cache totp verify token")
	}

	return &token, nil
}

// Verify2FAToken verifies the TOTP code for sensitive operations
// Returns userID if verification passed
func (s *TwoFAService) Verify2FAToken(ctx context.Context, token string, code string) (entity.UserIDEntity, error) {
	cacheKey := fmt.Sprintf("%s%s", totpVerifyCacheKeyPrefix, token)
	cacheJSON, exists, err := s.cacheRepo.Get(ctx, cacheKey)
	if err != nil {
		return "", errors.Wrap(err, "fail to get totp verify cache data")
	}
	if !exists {
		return "", error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "2FA verification session expired or invalid token")
	}

	var cacheData totpVerifyCacheData
	if err := json.Unmarshal([]byte(cacheJSON), &cacheData); err != nil {
		return "", errors.Wrap(err, "fail to unmarshal totp verify cache data")
	}

	userID := entity.UserIDEntity(cacheData.UserID)

	// Get secret from database
	twoFA, exists, err := s.twoFARepo.GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP)
	if err != nil {
		return "", errors.Wrap(err, "fail to get 2fa record")
	}
	if !exists {
		return "", error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "2FA is not enabled")
	}

	// Verify the TOTP code
	valid := totp.Validate(code, twoFA.Secret)
	if !valid {
		return "", error_code.NewErrorWithErrorCodef(error_code.InvalidTotpCode, "please try again")
	}

	// Clear the token after successful verification
	_ = s.cacheRepo.Delete(ctx, cacheKey)

	return userID, nil
}

// TwoFALoginResult represents the result of a successful 2FA login
type TwoFALoginResult struct {
	User         entity.UserEntity
	RefreshToken entity.RefreshToken
	AccessToken  entity.AccessToken
}

// Verify2FATokenAndLogin verifies the TOTP code and issues tokens for login
func (s *TwoFAService) Verify2FATokenAndLogin(ctx context.Context, token string, code string) (TwoFALoginResult, error) {
	userID, err := s.Verify2FAToken(ctx, token, code)
	if err != nil {
		return TwoFALoginResult{}, err
	}

	// Get user info
	user, exists, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return TwoFALoginResult{}, errors.Wrap(err, "fail to get user")
	}
	if !exists {
		return TwoFALoginResult{}, error_code.NewErrorWithErrorCodef(error_code.UserNotFound, "user not found")
	}

	// Issue tokens
	refreshToken, err := s.refreshTokenRepo.IssueRefreshToken(ctx, userID)
	if err != nil {
		return TwoFALoginResult{}, errors.Wrap(err, "fail to issue refresh token")
	}

	accessToken, err := s.accessTokenRepo.IssueAccessToken(ctx, userID, refreshToken.TokenHash)
	if err != nil {
		return TwoFALoginResult{}, errors.Wrap(err, "fail to issue access token")
	}

	return TwoFALoginResult{
		User:         user,
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
	}, nil
}

// Delete2FA deletes a 2FA record for a user by type after verifying the code
// The code can be either a TOTP code or a recovery code
func (s *TwoFAService) Delete2FA(ctx context.Context, userID entity.UserIDEntity, twoFAType entity.TwoFAType, code string) error {
	twoFA, exists, err := s.twoFARepo.GetByUserIDAndType(ctx, userID, twoFAType)
	if err != nil {
		return errors.Wrap(err, "fail to check existing 2fa")
	}
	if !exists {
		return error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "2FA of type %s is not enabled", twoFAType)
	}

	// Verify the code - try TOTP first, then recovery code
	codeValid := false
	if twoFAType == entity.TwoFATypeTOTP {
		codeValid = totp.Validate(code, twoFA.Secret)
	}

	// If TOTP code is not valid, try recovery code
	if !codeValid {
		recoveryCode, err := s.twoFARepo.GetRecoveryCode(ctx, userID)
		if err != nil {
			return errors.Wrap(err, "fail to get recovery code")
		}
		if recoveryCode != nil && *recoveryCode == code {
			codeValid = true
		}
	}

	if !codeValid {
		return error_code.NewErrorWithErrorCodef(error_code.InvalidTotpCode, "invalid code, please try again")
	}

	// Delete the 2FA record
	if err := s.twoFARepo.Delete(ctx, userID, twoFAType); err != nil {
		return errors.Wrap(err, "fail to delete 2fa")
	}

	// Clear the recovery code
	if err := s.twoFARepo.ClearRecoveryCode(ctx, userID); err != nil {
		// Log but don't fail - the 2FA is already deleted
	}

	return nil
}

// Remove2FAByRecoveryCode verifies the 2FA token and recovery code, then removes 2FA
// This is used when a user has lost their authenticator but has the recovery code
func (s *TwoFAService) Remove2FAByRecoveryCode(ctx context.Context, twoFAToken string, recoveryCode string) error {
	// Verify the 2FA token to get the userID
	cacheKey := fmt.Sprintf("%s%s", totpVerifyCacheKeyPrefix, twoFAToken)
	cacheJSON, exists, err := s.cacheRepo.Get(ctx, cacheKey)
	if err != nil {
		return errors.Wrap(err, "fail to get totp verify cache data")
	}
	if !exists {
		return error_code.NewErrorWithErrorCodef(error_code.InvalidRequestParameters, "2FA verification session expired or invalid token")
	}

	var cacheData totpVerifyCacheData
	if err := json.Unmarshal([]byte(cacheJSON), &cacheData); err != nil {
		return errors.Wrap(err, "fail to unmarshal totp verify cache data")
	}

	userID := entity.UserIDEntity(cacheData.UserID)

	// Verify the recovery code
	storedRecoveryCode, err := s.twoFARepo.GetRecoveryCode(ctx, userID)
	if err != nil {
		return errors.Wrap(err, "fail to get recovery code")
	}
	if storedRecoveryCode == nil || *storedRecoveryCode != recoveryCode {
		return error_code.NewErrorWithErrorCodef(error_code.InvalidRecoveryCode, "invalid recovery code")
	}

	// Delete the 2FA record
	if err := s.twoFARepo.Delete(ctx, userID, entity.TwoFATypeTOTP); err != nil {
		return errors.Wrap(err, "fail to delete 2fa")
	}

	// Clear the recovery code
	if err := s.twoFARepo.ClearRecoveryCode(ctx, userID); err != nil {
		// Log but don't fail - the 2FA is already deleted
	}

	// Clear the 2FA token from cache
	_ = s.cacheRepo.Delete(ctx, cacheKey)

	return nil
}
