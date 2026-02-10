package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/require"

	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/error_code"
	mockgen "ya-tool-craft/internal/infra/repository_impl/mock_gen"
)

// newTestTwoFAService creates a TwoFAService with all mocked dependencies.
func newTestTwoFAService(ctrl *gomock.Controller) (
	*TwoFAService,
	*mockgen.MockIAuth2FARepository,
	*mockgen.MockIUserRepository,
	*mockgen.MockIAuthAccessTokenRepository,
	*mockgen.MockIAuthRefreshTokenRepository,
	*mockgen.MockICache,
) {
	twoFARepo := mockgen.NewMockIAuth2FARepository(ctrl)
	userRepo := mockgen.NewMockIUserRepository(ctrl)
	accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
	refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
	cacheRepo := mockgen.NewMockICache(ctrl)

	svc, _ := NewTwoFaService(twoFARepo, userRepo, accessRepo, refreshRepo, cacheRepo, config.Config{
		WebAuthnRPName: "TestApp",
	})

	return svc, twoFARepo, userRepo, accessRepo, refreshRepo, cacheRepo
}

// generateTestTOTPSecret creates a real TOTP key and returns the secret and a valid code.
func generateTestTOTPSecret(t *testing.T) (string, string) {
	t.Helper()
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "TestApp",
		AccountName: "testuser",
	})
	require.NoError(t, err)

	code, err := totp.GenerateCode(key.Secret(), time.Now())
	require.NoError(t, err)

	return key.Secret(), code
}

func TestNewTwoFaService(t *testing.T) {
	t.Parallel()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, _, _ := newTestTwoFAService(ctrl)
	require.NotNil(t, svc)
}

func TestTwoFAService_GenerateNewTOTPForUser(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID   = entity.UserIDEntity("user-1")
		username = "alice"
	)

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache)
		wantErrSub string
		wantCode   *error_code.ErrorCode
	}{
		{
			name: "repo error checking existing TOTP is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("db down"))
			},
			wantErrSub: "fail to check existing totp",
		},
		{
			name: "TOTP already enabled returns error code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, true, nil)
			},
			wantErrSub: "please remove existing TOTP",
			wantCode:   &error_code.TwoFaAlreadyEnabled,
		},
		{
			name: "cache set error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(totpCacheTTL)).
					Return(errors.New("cache unavailable"))
			},
			wantErrSub: "fail to cache totp secret",
		},
		{
			name: "successful generation returns setup info",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(totpCacheTTL)).
					Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, cacheRepo)
			}

			result, err := svc.GenerateNewTOTPForUser(ctx, userID, username)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantCode.Code, ecErr.ErrorCode.Code)
				}
				require.Nil(t, result)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, result)
			require.NotEmpty(t, result.Token)
			require.True(t, strings.HasPrefix(result.Token, "2fa-totp-"))
			require.NotEmpty(t, result.Secret)
			require.NotEmpty(t, result.URL)
			require.NotEmpty(t, result.QRCode)
			require.Contains(t, result.URL, "otpauth://totp/")
		})
	}
}

func TestTwoFAService_GetPendingTOTPByToken(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const token = "2fa-totp-test-token"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, cacheRepo *mockgen.MockICache)
		wantExists bool
		wantErrSub string
		wantData   *totpCacheData
	}{
		{
			name: "cache get error is wrapped",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return("", false, errors.New("cache down"))
			},
			wantErrSub: "fail to get totp cache data",
		},
		{
			name: "token not found returns false",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return("", false, nil)
			},
			wantExists: false,
		},
		{
			name: "invalid JSON in cache returns error",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return("invalid-json{", true, nil)
			},
			wantErrSub: "fail to unmarshal totp cache data",
		},
		{
			name: "valid cache data returns correctly",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				data := totpCacheData{Token: token, Secret: "TESTSECRET", UserID: "user-1"}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
			},
			wantExists: true,
			wantData:   &totpCacheData{Token: token, Secret: "TESTSECRET", UserID: "user-1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, _, _, _, _, cacheRepo := newTestTwoFAService(ctrl)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, cacheRepo)
			}

			data, exists, err := svc.GetPendingTOTPByToken(ctx, token)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantExists, exists)
			if tt.wantData != nil {
				require.Equal(t, tt.wantData, data)
			}
		})
	}
}

func TestTwoFAService_ClearPendingTOTP(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const token = "2fa-totp-test-token"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, cacheRepo *mockgen.MockICache)
		wantErr    bool
	}{
		{
			name: "successful deletion",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Delete(ctx, "totp_pending:"+token).
					Return(nil)
			},
		},
		{
			name: "deletion error is returned",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Delete(ctx, "totp_pending:"+token).
					Return(errors.New("cache error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, _, _, _, _, cacheRepo := newTestTwoFAService(ctrl)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, cacheRepo)
			}

			err := svc.ClearPendingTOTP(ctx, token)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestTwoFAService_Get2FAInfo(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const userID = entity.UserIDEntity("user-1")

	now := time.Now()

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository)
		wantErrSub string
		wantResult []TwoFAInfo
	}{
		{
			name: "repo error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository) {
				twoFARepo.EXPECT().
					GetByUserID(ctx, userID).
					Return(nil, errors.New("db error"))
			},
			wantErrSub: "fail to get 2fa info",
		},
		{
			name: "empty list returns empty result",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository) {
				twoFARepo.EXPECT().
					GetByUserID(ctx, userID).
					Return([]entity.TwoFAEntity{}, nil)
			},
			wantResult: []TwoFAInfo{},
		},
		{
			name: "returns mapped 2FA info",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository) {
				twoFARepo.EXPECT().
					GetByUserID(ctx, userID).
					Return([]entity.TwoFAEntity{
						{Type: entity.TwoFATypeTOTP, Verified: true, CreatedAt: now},
					}, nil)
			},
			wantResult: []TwoFAInfo{
				{Type: entity.TwoFATypeTOTP, Enabled: true, CreatedAt: now},
			},
		},
		{
			name: "unverified 2FA shows as disabled",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository) {
				twoFARepo.EXPECT().
					GetByUserID(ctx, userID).
					Return([]entity.TwoFAEntity{
						{Type: entity.TwoFATypeTOTP, Verified: false, CreatedAt: now},
					}, nil)
			},
			wantResult: []TwoFAInfo{
				{Type: entity.TwoFATypeTOTP, Enabled: false, CreatedAt: now},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, _ := newTestTwoFAService(ctrl)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo)
			}

			result, err := svc.Get2FAInfo(ctx, userID)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantResult, result)
		})
	}
}

func TestTwoFAService_generateRecoveryCode(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, _, _ := newTestTwoFAService(ctrl)

	code := svc.generateRecoveryCode()
	require.NotEmpty(t, code)

	words := strings.Split(code, " ")
	require.Len(t, words, recoveryCodeWordCount)

	for _, word := range words {
		require.NotEmpty(t, word)
	}

	// Verify different calls produce different codes
	code2 := svc.generateRecoveryCode()
	require.NotEqual(t, code, code2)
}

func TestTwoFAService_VerifyAndEnableTOTP(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID = entity.UserIDEntity("user-1")
		token  = "2fa-totp-test-token"
	)

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string)
		useReal    bool // whether to use real TOTP secret + code
		code       string
		wantErrSub string
		wantCode   *error_code.ErrorCode
	}{
		{
			name: "repo error checking existing TOTP is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("db error"))
			},
			code:       "123456",
			wantErrSub: "fail to check existing totp",
		},
		{
			name: "TOTP already enabled returns error",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, true, nil)
			},
			code:       "123456",
			wantErrSub: "please remove existing TOTP",
			wantCode:   &error_code.TwoFaAlreadyEnabled,
		},
		{
			name: "expired or invalid token returns error",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return("", false, nil)
			},
			code:       "123456",
			wantErrSub: "TOTP setup session expired or invalid token",
		},
		{
			name: "cache error getting pending TOTP is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return("", false, errors.New("cache down"))
			},
			code:       "123456",
			wantErrSub: "fail to get pending totp data",
		},
		{
			name: "token belongs to different user returns error",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				data := totpCacheData{Token: token, Secret: "secret", UserID: "other-user"}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
			},
			code:       "123456",
			wantErrSub: "token does not belong to the current user",
		},
		{
			name: "invalid TOTP code returns error code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				data := totpCacheData{Token: token, Secret: secret, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
			},
			useReal:    true,
			code:       "000000", // deliberately wrong code
			wantErrSub: "please try again",
			wantCode:   &error_code.InvalidTotpCode,
		},
		{
			name: "create 2FA record error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				data := totpCacheData{Token: token, Secret: secret, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					Create(ctx, gomock.Any()).
					Return(errors.New("db error"))
			},
			useReal:    true,
			wantErrSub: "fail to save totp 2fa",
		},
		{
			name: "save recovery code error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				data := totpCacheData{Token: token, Secret: secret, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					Create(ctx, gomock.Any()).
					Return(nil)
				twoFARepo.EXPECT().
					SetRecoveryCode(ctx, userID, gomock.Any()).
					Return(errors.New("db error"))
			},
			useReal:    true,
			wantErrSub: "fail to save recovery code",
		},
		{
			name: "successful verification and enablement",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				data := totpCacheData{Token: token, Secret: secret, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					Create(ctx, gomock.Any()).
					Return(nil)
				twoFARepo.EXPECT().
					SetRecoveryCode(ctx, userID, gomock.Any()).
					Return(nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_pending:"+token).
					Return(nil)
			},
			useReal: true,
		},
		{
			name: "clear pending TOTP failure does not fail enablement",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				data := totpCacheData{Token: token, Secret: secret, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_pending:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					Create(ctx, gomock.Any()).
					Return(nil)
				twoFARepo.EXPECT().
					SetRecoveryCode(ctx, userID, gomock.Any()).
					Return(nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_pending:"+token).
					Return(errors.New("cache error"))
			},
			useReal: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)

			var secret, code string
			if tt.useReal {
				secret, code = generateTestTOTPSecret(t)
				if tt.code != "" {
					code = tt.code // override with deliberately wrong code
				}
			} else {
				secret = "FAKESECRET"
				code = tt.code
			}

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, cacheRepo, secret, code)
			}

			recoveryCode, err := svc.VerifyAndEnableTOTP(ctx, userID, token, code)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantCode.Code, ecErr.ErrorCode.Code)
				}
				require.Empty(t, recoveryCode)
				return
			}

			require.NoError(t, err)
			require.NotEmpty(t, recoveryCode)
			words := strings.Split(recoveryCode, " ")
			require.Len(t, words, recoveryCodeWordCount)
		})
	}
}

func TestTwoFAService_Get2FAToken(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const userID = entity.UserIDEntity("user-1")

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache)
		wantToken  bool
		wantErrSub string
	}{
		{
			name: "repo error checking TOTP is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("db error"))
			},
			wantErrSub: "fail to check 2fa status",
		},
		{
			name: "no TOTP enabled returns nil",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
			},
			wantToken: false,
		},
		{
			name: "TOTP not verified returns nil",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Verified: false}, true, nil)
			},
			wantToken: false,
		},
		{
			name: "cache set error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Verified: true}, true, nil)
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(totpVerifyCacheTTL)).
					Return(errors.New("cache error"))
			},
			wantErrSub: "fail to cache totp verify token",
		},
		{
			name: "successful token generation",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Verified: true}, true, nil)
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(totpVerifyCacheTTL)).
					Return(nil)
			},
			wantToken: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, cacheRepo)
			}

			token, err := svc.Get2FAToken(ctx, userID)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				return
			}

			require.NoError(t, err)
			if tt.wantToken {
				require.NotNil(t, token)
				require.True(t, strings.HasPrefix(*token, "2fa-totp-verify-"))
			} else {
				require.Nil(t, token)
			}
		})
	}
}

func TestTwoFAService_Verify2FAToken(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID = entity.UserIDEntity("user-1")
		token  = "2fa-totp-verify-test-token"
	)

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string)
		useReal    bool
		code       string
		wantErrSub string
		wantCode   *error_code.ErrorCode
		wantUserID entity.UserIDEntity
	}{
		{
			name: "cache error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return("", false, errors.New("cache down"))
			},
			code:       "123456",
			wantErrSub: "fail to get totp verify cache data",
		},
		{
			name: "expired or invalid token returns error code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return("", false, nil)
			},
			code:       "123456",
			wantErrSub: "2FA verification session expired or invalid token",
			wantCode:   &error_code.InvalidRequestParameters,
		},
		{
			name: "invalid cache JSON returns error",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return("{bad-json", true, nil)
			},
			code:       "123456",
			wantErrSub: "fail to unmarshal totp verify cache data",
		},
		{
			name: "2FA record not found returns error code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
			},
			code:       "123456",
			wantErrSub: "2FA is not enabled",
			wantCode:   &error_code.InvalidRequestParameters,
		},
		{
			name: "repo error getting 2FA record is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("db down"))
			},
			code:       "123456",
			wantErrSub: "fail to get 2fa record",
		},
		{
			name: "invalid TOTP code returns error code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
			},
			useReal:    true,
			code:       "000000",
			wantErrSub: "please try again",
			wantCode:   &error_code.InvalidTotpCode,
		},
		{
			name: "successful verification returns userID and clears token",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+token).
					Return(nil)
			},
			useReal:    true,
			wantUserID: userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)

			var secret, code string
			if tt.useReal {
				secret, code = generateTestTOTPSecret(t)
				if tt.code != "" {
					code = tt.code
				}
			} else {
				secret = "FAKESECRET"
				code = tt.code
			}

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, cacheRepo, secret, code)
			}

			resultUserID, err := svc.Verify2FAToken(ctx, token, code)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantCode.Code, ecErr.ErrorCode.Code)
				}
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantUserID, resultUserID)
		})
	}
}

func TestTwoFAService_Verify2FATokenAndLogin(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID = entity.UserIDEntity("user-1")
		token  = "2fa-totp-verify-test-token"
	)

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string)
		useReal    bool
		code       string
		wantErrSub string
		wantCode   *error_code.ErrorCode
	}{
		{
			name: "verify2FAToken failure is propagated",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return("", false, nil)
			},
			code:       "123456",
			wantErrSub: "2FA verification session expired or invalid token",
		},
		{
			name: "user not found returns error code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+token).
					Return(nil)
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, nil)
			},
			useReal:    true,
			wantErrSub: "user not found",
			wantCode:   &error_code.UserNotFound,
		},
		{
			name: "user repo error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+token).
					Return(nil)
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, errors.New("db down"))
			},
			useReal:    true,
			wantErrSub: "fail to get user",
		},
		{
			name: "refresh token issuance error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+token).
					Return(nil)
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID, Name: "alice"}, true, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, userID).
					Return(entity.RefreshToken{}, errors.New("token error"))
			},
			useReal:    true,
			wantErrSub: "fail to issue refresh token",
		},
		{
			name: "access token issuance error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+token).
					Return(nil)
				user := entity.UserEntity{ID: userID, Name: "alice"}
				refresh := entity.NewRefreshToken(userID, "rt", time.Unix(1, 0), time.Unix(2, 0))
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, userID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, userID, refresh.TokenHash).
					Return(entity.AccessToken{}, errors.New("jwt error"))
			},
			useReal:    true,
			wantErrSub: "fail to issue access token",
		},
		{
			name: "successful login returns tokens",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, cacheRepo *mockgen.MockICache, secret string, code string) {
				data := totpVerifyCacheData{Token: token, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+token).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+token).
					Return(nil)
				user := entity.UserEntity{ID: userID, Name: "alice"}
				refresh := entity.NewRefreshToken(userID, "rt", time.Unix(100, 0), time.Unix(200, 0))
				access := entity.NewAccessToken(userID, "at", time.Unix(100, 0), time.Unix(150, 0), refresh.TokenHash)
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, userID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, userID, refresh.TokenHash).
					Return(access, nil)
			},
			useReal: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, userRepo, accessRepo, refreshRepo, cacheRepo := newTestTwoFAService(ctrl)

			var secret, code string
			if tt.useReal {
				secret, code = generateTestTOTPSecret(t)
				if tt.code != "" {
					code = tt.code
				}
			} else {
				secret = "FAKESECRET"
				code = tt.code
			}

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, userRepo, accessRepo, refreshRepo, cacheRepo, secret, code)
			}

			result, err := svc.Verify2FATokenAndLogin(ctx, token, code)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantCode.Code, ecErr.ErrorCode.Code)
				}
				return
			}

			require.NoError(t, err)
			require.Equal(t, userID, result.User.ID)
			require.NotEmpty(t, result.RefreshToken.Token)
			require.NotEmpty(t, result.AccessToken.Token)
		})
	}
}

func TestTwoFAService_Delete2FA(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const userID = entity.UserIDEntity("user-1")

	tests := []struct {
		name       string
		code       string
		setupMocks func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string)
		useReal    bool
		wantErrSub string
		wantCode   *error_code.ErrorCode
	}{
		{
			name: "repo error checking existing 2FA is wrapped",
			code: "123456",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("db down"))
			},
			wantErrSub: "fail to check existing 2fa",
		},
		{
			name: "2FA not enabled returns error code",
			code: "123456",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
			},
			wantErrSub: "2FA of type",
			wantCode:   &error_code.InvalidRequestParameters,
		},
		{
			name: "invalid TOTP code and no recovery code returns error",
			code: "000000",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(nil, nil)
			},
			useReal:    true,
			wantErrSub: "invalid code, please try again",
			wantCode:   &error_code.InvalidTotpCode,
		},
		{
			name: "invalid TOTP code and wrong recovery code returns error",
			code: "wrong-recovery-code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				rc := "correct-recovery-code"
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(&rc, nil)
			},
			useReal:    true,
			wantErrSub: "invalid code, please try again",
			wantCode:   &error_code.InvalidTotpCode,
		},
		{
			name: "recovery code lookup error is wrapped",
			code: "000000",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(nil, errors.New("db error"))
			},
			useReal:    true,
			wantErrSub: "fail to get recovery code",
		},
		{
			name: "delete with valid TOTP code succeeds",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(nil)
				twoFARepo.EXPECT().
					ClearRecoveryCode(ctx, userID).
					Return(nil)
			},
			useReal: true,
		},
		{
			name: "delete with valid recovery code succeeds",
			code: "my-recovery-code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				rc := "my-recovery-code"
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(&rc, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(nil)
				twoFARepo.EXPECT().
					ClearRecoveryCode(ctx, userID).
					Return(nil)
			},
			useReal: true,
		},
		{
			name: "delete 2FA record error is wrapped",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(errors.New("db error"))
			},
			useReal:    true,
			wantErrSub: "fail to delete 2fa",
		},
		{
			name: "clear recovery code failure does not fail deletion",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, secret string) {
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(nil)
				twoFARepo.EXPECT().
					ClearRecoveryCode(ctx, userID).
					Return(errors.New("cache error"))
			},
			useReal: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, _ := newTestTwoFAService(ctrl)

			var secret, code string
			if tt.useReal {
				secret, code = generateTestTOTPSecret(t)
				if tt.code != "" {
					code = tt.code
				}
			} else {
				secret = "FAKESECRET"
				code = tt.code
			}

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, secret)
			}

			err := svc.Delete2FA(ctx, userID, entity.TwoFATypeTOTP, code)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantCode.Code, ecErr.ErrorCode.Code)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestTwoFAService_Remove2FAByRecoveryCode(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID      = entity.UserIDEntity("user-1")
		twoFAToken  = "2fa-totp-verify-test-token"
		recoveryStr = "correct recovery code words"
	)

	tests := []struct {
		name         string
		recoveryCode string
		setupMocks   func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache)
		wantErrSub   string
		wantCode     *error_code.ErrorCode
	}{
		{
			name:         "cache error is wrapped",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return("", false, errors.New("cache down"))
			},
			wantErrSub: "fail to get totp verify cache data",
		},
		{
			name:         "expired or invalid token returns error code",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return("", false, nil)
			},
			wantErrSub: "2FA verification session expired or invalid token",
			wantCode:   &error_code.InvalidRequestParameters,
		},
		{
			name:         "invalid cache JSON returns error",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return("{bad", true, nil)
			},
			wantErrSub: "fail to unmarshal totp verify cache data",
		},
		{
			name:         "recovery code fetch error is wrapped",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				data := totpVerifyCacheData{Token: twoFAToken, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(nil, errors.New("db error"))
			},
			wantErrSub: "fail to get recovery code",
		},
		{
			name:         "nil stored recovery code returns error code",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				data := totpVerifyCacheData{Token: twoFAToken, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return(string(jsonData), true, nil)
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(nil, nil)
			},
			wantErrSub: "invalid recovery code",
			wantCode:   &error_code.InvalidRecoveryCode,
		},
		{
			name:         "wrong recovery code returns error code",
			recoveryCode: "wrong code",
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				data := totpVerifyCacheData{Token: twoFAToken, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return(string(jsonData), true, nil)
				rc := recoveryStr
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(&rc, nil)
			},
			wantErrSub: "invalid recovery code",
			wantCode:   &error_code.InvalidRecoveryCode,
		},
		{
			name:         "delete 2FA error is wrapped",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				data := totpVerifyCacheData{Token: twoFAToken, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return(string(jsonData), true, nil)
				rc := recoveryStr
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(&rc, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(errors.New("delete failed"))
			},
			wantErrSub: "fail to delete 2fa",
		},
		{
			name:         "successful removal clears everything",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				data := totpVerifyCacheData{Token: twoFAToken, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return(string(jsonData), true, nil)
				rc := recoveryStr
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(&rc, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(nil)
				twoFARepo.EXPECT().
					ClearRecoveryCode(ctx, userID).
					Return(nil)
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+twoFAToken).
					Return(nil)
			},
		},
		{
			name:         "clear recovery code failure does not fail removal",
			recoveryCode: recoveryStr,
			setupMocks: func(ctx context.Context, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				data := totpVerifyCacheData{Token: twoFAToken, UserID: string(userID)}
				jsonData, _ := json.Marshal(data)
				cacheRepo.EXPECT().
					Get(ctx, "totp_verify:"+twoFAToken).
					Return(string(jsonData), true, nil)
				rc := recoveryStr
				twoFARepo.EXPECT().
					GetRecoveryCode(ctx, userID).
					Return(&rc, nil)
				twoFARepo.EXPECT().
					Delete(ctx, userID, entity.TwoFATypeTOTP).
					Return(nil)
				twoFARepo.EXPECT().
					ClearRecoveryCode(ctx, userID).
					Return(errors.New("cache error"))
				cacheRepo.EXPECT().
					Delete(ctx, "totp_verify:"+twoFAToken).
					Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, twoFARepo, cacheRepo)
			}

			err := svc.Remove2FAByRecoveryCode(ctx, twoFAToken, tt.recoveryCode)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantCode.Code, ecErr.ErrorCode.Code)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

// === Security-focused tests ===

func TestTwoFAService_Security_VerifyAndEnableTOTP_TokenUserMismatch(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	// Verify that a valid token belonging to user-A cannot be used by user-B
	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)

	const (
		attackerID = entity.UserIDEntity("attacker")
		victimID   = entity.UserIDEntity("victim")
		token      = "2fa-totp-stolen-token"
	)

	twoFARepo.EXPECT().
		GetByUserIDAndType(ctx, attackerID, entity.TwoFATypeTOTP).
		Return(entity.TwoFAEntity{}, false, nil)

	data := totpCacheData{Token: token, Secret: "SECRETXYZ", UserID: string(victimID)}
	jsonData, _ := json.Marshal(data)
	cacheRepo.EXPECT().
		Get(ctx, "totp_pending:"+token).
		Return(string(jsonData), true, nil)

	_, err := svc.VerifyAndEnableTOTP(ctx, attackerID, token, "123456")
	require.Error(t, err)
	require.Contains(t, err.Error(), "token does not belong to the current user")
}

func TestTwoFAService_Security_Verify2FAToken_DoesNotConsumeOnFailure(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	// Verify that token is NOT deleted when TOTP code is invalid.
	// This is a security concern: allows unlimited brute-force attempts within TTL window.
	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)

	const (
		userID = entity.UserIDEntity("user-1")
		token  = "2fa-totp-verify-token"
	)

	secret, _ := generateTestTOTPSecret(t)

	data := totpVerifyCacheData{Token: token, UserID: string(userID)}
	jsonData, _ := json.Marshal(data)
	cacheRepo.EXPECT().
		Get(ctx, "totp_verify:"+token).
		Return(string(jsonData), true, nil)
	twoFARepo.EXPECT().
		GetByUserIDAndType(ctx, userID, entity.TwoFATypeTOTP).
		Return(entity.TwoFAEntity{Secret: secret, Verified: true}, true, nil)
	// Note: cacheRepo.Delete is NOT expected to be called — token persists after failure

	_, err := svc.Verify2FAToken(ctx, token, "000000")
	require.Error(t, err)

	var ecErr error_code.ErrorWithErrorCode
	require.True(t, errors.As(err, &ecErr))
	require.Equal(t, error_code.InvalidTotpCode.Code, ecErr.ErrorCode.Code)
}

func TestTwoFAService_Security_Remove2FAByRecoveryCode_NoUserIDInToken(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	// Verify behavior when cache data has empty userID
	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, twoFARepo, _, _, _, cacheRepo := newTestTwoFAService(ctrl)

	const twoFAToken = "2fa-totp-verify-empty-user"

	data := totpVerifyCacheData{Token: twoFAToken, UserID: ""}
	jsonData, _ := json.Marshal(data)
	cacheRepo.EXPECT().
		Get(ctx, "totp_verify:"+twoFAToken).
		Return(string(jsonData), true, nil)
	twoFARepo.EXPECT().
		GetRecoveryCode(ctx, entity.UserIDEntity("")).
		Return(nil, nil)

	err := svc.Remove2FAByRecoveryCode(ctx, twoFAToken, "some-code")
	require.Error(t, err)

	var ecErr error_code.ErrorWithErrorCode
	require.True(t, errors.As(err, &ecErr))
	require.Equal(t, error_code.InvalidRecoveryCode.Code, ecErr.ErrorCode.Code)
}
