package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"

	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/error_code"
	mockgen "ya-tool-craft/internal/infra/repository_impl/mock_gen"
)

const (
	testUserID   = entity.UserIDEntity("test-user-id")
	testUserName = "testuser"
)

var testConfig = config.Config{
	WebAuthnRPName:       "TestRP",
	WebAuthnRPID:         "localhost",
	WebAuthnRPOrigin:     "http://localhost:8080",
	WebAuthnChallengeTTL: 300,
}

// newTestPasskeyService creates an AuthPasskeyService with all mocked dependencies.
func newTestPasskeyService(ctrl *gomock.Controller) (
	*AuthPasskeyService,
	*mockgen.MockIUserRepository,
	*mockgen.MockIAuthAccessTokenRepository,
	*mockgen.MockIAuthRefreshTokenRepository,
	*mockgen.MockIPasskeyRepository,
	*mockgen.MockICache,
) {
	userRepo := mockgen.NewMockIUserRepository(ctrl)
	accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
	refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
	passkeyRepo := mockgen.NewMockIPasskeyRepository(ctrl)
	cacheRepo := mockgen.NewMockICache(ctrl)

	svc, err := NewAuthPasskeyService(userRepo, accessRepo, refreshRepo, passkeyRepo, cacheRepo, testConfig)
	if err != nil {
		panic(fmt.Sprintf("failed to create test passkey service: %v", err))
	}

	return svc, userRepo, accessRepo, refreshRepo, passkeyRepo, cacheRepo
}

func testUser() entity.UserEntity {
	return entity.UserEntity{ID: testUserID, Name: testUserName}
}

// --- NewAuthPasskeyService ---

func TestNewAuthPasskeyService(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	t.Run("success with valid config", func(t *testing.T) {
		t.Parallel()
		ctrl := gomock.NewController(t)
		t.Cleanup(ctrl.Finish)

		svc, err := NewAuthPasskeyService(
			mockgen.NewMockIUserRepository(ctrl),
			mockgen.NewMockIAuthAccessTokenRepository(ctrl),
			mockgen.NewMockIAuthRefreshTokenRepository(ctrl),
			mockgen.NewMockIPasskeyRepository(ctrl),
			mockgen.NewMockICache(ctrl),
			testConfig,
		)
		require.NoError(t, err)
		require.NotNil(t, svc)
	})

	t.Run("stores config values correctly", func(t *testing.T) {
		t.Parallel()
		ctrl := gomock.NewController(t)
		t.Cleanup(ctrl.Finish)

		customConfig := config.Config{
			WebAuthnRPName:       "CustomRP",
			WebAuthnRPID:         "example.com",
			WebAuthnRPOrigin:     "https://example.com",
			WebAuthnChallengeTTL: 600,
		}

		svc, err := NewAuthPasskeyService(
			mockgen.NewMockIUserRepository(ctrl),
			mockgen.NewMockIAuthAccessTokenRepository(ctrl),
			mockgen.NewMockIAuthRefreshTokenRepository(ctrl),
			mockgen.NewMockIPasskeyRepository(ctrl),
			mockgen.NewMockICache(ctrl),
			customConfig,
		)
		require.NoError(t, err)
		require.NotNil(t, svc)
		require.Equal(t, customConfig, svc.config)
	})
}

// --- RegistrationChallenge ---

func TestAuthPasskeyService_RegistrationChallenge(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	tests := []struct {
		name       string
		setupMocks func(
			ctx context.Context,
			userRepo *mockgen.MockIUserRepository,
			passkeyRepo *mockgen.MockIPasskeyRepository,
			cacheRepo *mockgen.MockICache,
		)
		wantErr    bool
		wantErrSub string
		checkError func(t *testing.T, err error)
	}{
		{
			name: "success with no existing passkeys",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)
				cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).Return(nil)
			},
		},
		{
			name: "success with existing passkeys excluded",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{
					{ID: 1, CredentialID: []byte("cred-1")},
					{ID: 2, CredentialID: []byte("cred-2")},
				}, nil)
				cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).Return(nil)
			},
		},
		{
			name: "user not found returns coded error",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(entity.UserEntity{}, false, nil)
			},
			wantErr: true,
			checkError: func(t *testing.T, err error) {
				var ecErr error_code.ErrorWithErrorCode
				require.True(t, errors.As(err, &ecErr))
				require.Equal(t, error_code.UserNotFound.Code, ecErr.ErrorCode.Code)
			},
		},
		{
			name: "GetByID error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(entity.UserEntity{}, false, errors.New("db error"))
			},
			wantErr:    true,
			wantErrSub: "failed to get user",
		},
		{
			name: "GetByUserID error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return(nil, errors.New("passkey db error"))
			},
			wantErr:    true,
			wantErrSub: "failed to get existing passkeys",
		},
		{
			name: "cache SetWithTTL error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)
				cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).Return(errors.New("cache down"))
			},
			wantErr:    true,
			wantErrSub: "failed to store challenge in cache",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)
			tt.setupMocks(ctx, userRepo, passkeyRepo, cacheRepo)

			options, err := svc.RegistrationChallenge(ctx, testUserID)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrSub != "" {
					require.Contains(t, err.Error(), tt.wantErrSub)
				}
				if tt.checkError != nil {
					tt.checkError(t, err)
				}
				require.Nil(t, options)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, options)
			require.NotEmpty(t, options.Response.Challenge)
			require.Equal(t, "localhost", options.Response.RelyingParty.ID)
			userID, ok := options.Response.User.ID.(protocol.URLEncodedBase64)
			require.True(t, ok)
			require.Equal(t, []byte(testUserID), []byte(userID))
		})
	}
}

func TestAuthPasskeyService_RegistrationChallenge_CacheKeyFormat(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)

	expectedKeyPrefix := fmt.Sprintf("passkey:challenge:%s:register", testUserID)
	cacheRepo.EXPECT().
		SetWithTTL(ctx, expectedKeyPrefix, gomock.Any(), uint64(300)).
		Return(nil)

	options, err := svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)
	require.NotNil(t, options)
}

func TestAuthPasskeyService_RegistrationChallenge_SessionStoredAsJSON(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)

	var storedSession string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, _ string, value string, _ uint64) error {
			storedSession = value
			return nil
		})

	_, err := svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)

	// Verify stored session is valid JSON with expected structure
	var session webauthn.SessionData
	err = json.Unmarshal([]byte(storedSession), &session)
	require.NoError(t, err)
	require.NotEmpty(t, session.Challenge)
	require.Equal(t, []byte(testUserID), session.UserID)
}

func TestAuthPasskeyService_RegistrationChallenge_OverwritesPreviousChallenge(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	// First call
	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil).Times(2)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil).Times(2)

	cacheKey := fmt.Sprintf("passkey:challenge:%s:register", testUserID)
	// Same cache key used both times - second write overwrites first
	cacheRepo.EXPECT().SetWithTTL(ctx, cacheKey, gomock.Any(), uint64(300)).Return(nil).Times(2)

	_, err := svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)

	_, err = svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)
}

// --- FinishRegistration ---

func TestAuthPasskeyService_FinishRegistration(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	tests := []struct {
		name       string
		setupMocks func(
			ctx context.Context,
			userRepo *mockgen.MockIUserRepository,
			passkeyRepo *mockgen.MockIPasskeyRepository,
			cacheRepo *mockgen.MockICache,
		)
		req        entity.PasskeyRegisterRequestEntity
		deviceName *string
		wantErr    bool
		wantErrSub string
		checkError func(t *testing.T, err error)
	}{
		{
			name: "user not found returns coded error",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(entity.UserEntity{}, false, nil)
			},
			wantErr: true,
			checkError: func(t *testing.T, err error) {
				var ecErr error_code.ErrorWithErrorCode
				require.True(t, errors.As(err, &ecErr))
				require.Equal(t, error_code.UserNotFound.Code, ecErr.ErrorCode.Code)
			},
		},
		{
			name: "GetByID error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(entity.UserEntity{}, false, errors.New("db error"))
			},
			wantErr:    true,
			wantErrSub: "failed to get user",
		},
		{
			name: "session not found in cache returns coded error",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				cacheRepo.EXPECT().Get(ctx, fmt.Sprintf("passkey:challenge:%s:register", testUserID)).
					Return("", false, nil)
			},
			wantErr: true,
			checkError: func(t *testing.T, err error) {
				var ecErr error_code.ErrorWithErrorCode
				require.True(t, errors.As(err, &ecErr))
				require.Equal(t, error_code.InvalidRequestParameters.Code, ecErr.ErrorCode.Code)
				require.Contains(t, err.Error(), "session not found or expired")
			},
		},
		{
			name: "cache Get error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				cacheRepo.EXPECT().Get(ctx, gomock.Any()).
					Return("", false, errors.New("cache down"))
			},
			wantErr:    true,
			wantErrSub: "failed to get passkey registration session",
		},
		{
			name: "invalid session JSON returns unmarshal error",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
				cacheRepo.EXPECT().Get(ctx, gomock.Any()).
					Return("not-valid-json{{{", true, nil)
			},
			wantErr:    true,
			wantErrSub: "failed to unmarshal passkey registration session",
		},
		{
			name: "GetByUserID error after session retrieval is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)

				sessionData := webauthn.SessionData{
					Challenge: "dGVzdC1jaGFsbGVuZ2U",
					UserID:    []byte(testUserID),
				}
				sessionJSON, _ := json.Marshal(sessionData)
				cacheRepo.EXPECT().Get(ctx, gomock.Any()).Return(string(sessionJSON), true, nil)
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return(nil, errors.New("passkey db error"))
			},
			wantErr:    true,
			wantErrSub: "failed to get existing passkeys",
		},
		{
			name: "invalid credential creation response returns coded error",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)

				sessionData := webauthn.SessionData{
					Challenge: "dGVzdC1jaGFsbGVuZ2U",
					UserID:    []byte(testUserID),
				}
				sessionJSON, _ := json.Marshal(sessionData)
				cacheRepo.EXPECT().Get(ctx, gomock.Any()).Return(string(sessionJSON), true, nil)
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)
			},
			req:     protocol.CredentialCreationResponse{}, // empty/invalid
			wantErr: true,
			checkError: func(t *testing.T, err error) {
				var ecErr error_code.ErrorWithErrorCode
				require.True(t, errors.As(err, &ecErr))
				require.Equal(t, error_code.InvalidRequestParameters.Code, ecErr.ErrorCode.Code)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)
			tt.setupMocks(ctx, userRepo, passkeyRepo, cacheRepo)

			result, err := svc.FinishRegistration(ctx, testUserID, tt.req, tt.deviceName)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrSub != "" {
					require.Contains(t, err.Error(), tt.wantErrSub)
				}
				if tt.checkError != nil {
					tt.checkError(t, err)
				}
				require.Equal(t, entity.PasskeyEntity{}, result)
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestAuthPasskeyService_FinishRegistration_SessionCacheKeyMatchesRegistration(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)

	// Verify the same cache key format is used for both registration and finish
	expectedKey := fmt.Sprintf("passkey:challenge:%s:register", testUserID)
	cacheRepo.EXPECT().Get(ctx, expectedKey).Return("", false, nil)

	_, err := svc.FinishRegistration(ctx, testUserID, protocol.CredentialCreationResponse{}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "session not found or expired")
}

// --- LoginChallenge ---

func TestAuthPasskeyService_LoginChallenge(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, cacheRepo *mockgen.MockICache)
		wantErr    bool
		wantErrSub string
	}{
		{
			name: "success returns credential assertion with challenge",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
					Return(nil)
			},
		},
		{
			name: "cache SetWithTTL error is wrapped",
			setupMocks: func(ctx context.Context, cacheRepo *mockgen.MockICache) {
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
					Return(errors.New("cache down"))
			},
			wantErr:    true,
			wantErrSub: "failed to store challenge in cache",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, _, _, _, _, cacheRepo := newTestPasskeyService(ctrl)
			tt.setupMocks(ctx, cacheRepo)

			options, err := svc.LoginChallenge(ctx)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				require.Nil(t, options)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, options)
			require.NotEmpty(t, options.Response.Challenge)
			require.Equal(t, "localhost", options.Response.RelyingPartyID)
		})
	}
}

func TestAuthPasskeyService_LoginChallenge_CacheKeyContainsChallenge(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	var capturedKey string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, key string, _ string, _ uint64) error {
			capturedKey = key
			return nil
		})

	_, err := svc.LoginChallenge(ctx)
	require.NoError(t, err)

	// Key should be in format passkey:challenge:<challenge>:login
	require.Contains(t, capturedKey, "passkey:challenge:")
	require.Contains(t, capturedKey, ":login")
}

func TestAuthPasskeyService_LoginChallenge_SessionStoredAsValidJSON(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	var storedSession string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, _ string, value string, _ uint64) error {
			storedSession = value
			return nil
		})

	_, err := svc.LoginChallenge(ctx)
	require.NoError(t, err)

	var session webauthn.SessionData
	err = json.Unmarshal([]byte(storedSession), &session)
	require.NoError(t, err)
	require.NotEmpty(t, session.Challenge)
}

// --- FinishLogin ---

func TestAuthPasskeyService_FinishLogin(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	tests := []struct {
		name       string
		req        entity.PasskeyLoginRequestEntity
		setupMocks func(
			ctx context.Context,
			userRepo *mockgen.MockIUserRepository,
			accessRepo *mockgen.MockIAuthAccessTokenRepository,
			refreshRepo *mockgen.MockIAuthRefreshTokenRepository,
			passkeyRepo *mockgen.MockIPasskeyRepository,
			cacheRepo *mockgen.MockICache,
		)
		wantErr    bool
		wantErrSub string
		checkError func(t *testing.T, err error)
	}{
		{
			name: "empty assertion response returns parse error",
			req:  protocol.CredentialAssertionResponse{},
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, passkeyRepo *mockgen.MockIPasskeyRepository, cacheRepo *mockgen.MockICache) {
			},
			wantErr: true,
			checkError: func(t *testing.T, err error) {
				var ecErr error_code.ErrorWithErrorCode
				require.True(t, errors.As(err, &ecErr))
				require.Equal(t, error_code.InvalidRequestParameters.Code, ecErr.ErrorCode.Code)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, userRepo, accessRepo, refreshRepo, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)
			tt.setupMocks(ctx, userRepo, accessRepo, refreshRepo, passkeyRepo, cacheRepo)

			accessToken, refreshToken, err := svc.FinishLogin(ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrSub != "" {
					require.Contains(t, err.Error(), tt.wantErrSub)
				}
				if tt.checkError != nil {
					tt.checkError(t, err)
				}
				require.Equal(t, entity.AccessToken{}, accessToken)
				require.Equal(t, entity.RefreshToken{}, refreshToken)
				return
			}

			require.NoError(t, err)
		})
	}
}

// --- GetPasskeys ---

func TestAuthPasskeyService_GetPasskeys(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository)
		wantErr    bool
		wantErrSub string
		wantResult []entity.PasskeyEntity
	}{
		{
			name: "success returns passkeys",
			setupMocks: func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository) {
				passkeys := []entity.PasskeyEntity{
					{ID: 1, UserID: testUserID, CredentialID: []byte("cred-1")},
					{ID: 2, UserID: testUserID, CredentialID: []byte("cred-2")},
				}
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return(passkeys, nil)
			},
			wantResult: []entity.PasskeyEntity{
				{ID: 1, UserID: testUserID, CredentialID: []byte("cred-1")},
				{ID: 2, UserID: testUserID, CredentialID: []byte("cred-2")},
			},
		},
		{
			name: "success returns empty list",
			setupMocks: func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository) {
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)
			},
			wantResult: []entity.PasskeyEntity{},
		},
		{
			name: "returns nil when no passkeys",
			setupMocks: func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository) {
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return(nil, nil)
			},
			wantResult: nil,
		},
		{
			name: "repo error is wrapped",
			setupMocks: func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository) {
				passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return(nil, errors.New("db error"))
			},
			wantErr:    true,
			wantErrSub: "failed to get passkeys",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, _, _, _, passkeyRepo, _ := newTestPasskeyService(ctrl)
			tt.setupMocks(ctx, passkeyRepo)

			result, err := svc.GetPasskeys(ctx, testUserID)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				require.Nil(t, result)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantResult, result)
		})
	}
}

// --- DeletePasskey ---

func TestAuthPasskeyService_DeletePasskey(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	tests := []struct {
		name       string
		passkeyID  int64
		setupMocks func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository)
		wantErr    bool
		wantErrSub string
	}{
		{
			name:      "success",
			passkeyID: 42,
			setupMocks: func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository) {
				passkeyRepo.EXPECT().Delete(ctx, int64(42), testUserID).Return(nil)
			},
		},
		{
			name:      "repo error is wrapped",
			passkeyID: 42,
			setupMocks: func(ctx context.Context, passkeyRepo *mockgen.MockIPasskeyRepository) {
				passkeyRepo.EXPECT().Delete(ctx, int64(42), testUserID).Return(errors.New("db error"))
			},
			wantErr:    true,
			wantErrSub: "failed to delete passkey",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, _, _, _, passkeyRepo, _ := newTestPasskeyService(ctrl)
			tt.setupMocks(ctx, passkeyRepo)

			err := svc.DeletePasskey(ctx, testUserID, tt.passkeyID)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				return
			}

			require.NoError(t, err)
		})
	}
}

// --- Security Tests ---

func TestAuthPasskeyService_Security_CrossUserRegistrationIsolation(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	userA := entity.UserIDEntity("user-a")
	userB := entity.UserIDEntity("user-b")

	// User A starts registration
	userRepo.EXPECT().GetByID(ctx, userA).Return(entity.UserEntity{ID: userA, Name: "Alice"}, true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, userA).Return([]entity.PasskeyEntity{}, nil)

	var userACacheKey string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, key string, _ string, _ uint64) error {
			userACacheKey = key
			return nil
		})

	_, err := svc.RegistrationChallenge(ctx, userA)
	require.NoError(t, err)

	// User B starts registration
	userRepo.EXPECT().GetByID(ctx, userB).Return(entity.UserEntity{ID: userB, Name: "Bob"}, true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, userB).Return([]entity.PasskeyEntity{}, nil)

	var userBCacheKey string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, key string, _ string, _ uint64) error {
			userBCacheKey = key
			return nil
		})

	_, err = svc.RegistrationChallenge(ctx, userB)
	require.NoError(t, err)

	// Verify different cache keys for different users
	require.NotEqual(t, userACacheKey, userBCacheKey)
	require.Contains(t, userACacheKey, string(userA))
	require.Contains(t, userBCacheKey, string(userB))
}

func TestAuthPasskeyService_Security_FinishRegistration_DifferentUserCannotUseSession(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	attackerID := entity.UserIDEntity("attacker-id")

	// Attacker tries to finish registration - their cache key won't match victim's session
	userRepo.EXPECT().GetByID(ctx, attackerID).Return(entity.UserEntity{ID: attackerID, Name: "Attacker"}, true, nil)

	// Cache lookup uses attacker's user ID, so they get their own (nonexistent) session
	expectedKey := fmt.Sprintf("passkey:challenge:%s:register", attackerID)
	cacheRepo.EXPECT().Get(ctx, expectedKey).Return("", false, nil)

	_, err := svc.FinishRegistration(ctx, attackerID, protocol.CredentialCreationResponse{}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "session not found or expired")
}

func TestAuthPasskeyService_Security_ExpiredSessionRejected(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	// Simulate expired session: cache returns not found (TTL expired)
	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
	cacheRepo.EXPECT().Get(ctx, gomock.Any()).Return("", false, nil)

	_, err := svc.FinishRegistration(ctx, testUserID, protocol.CredentialCreationResponse{}, nil)
	require.Error(t, err)

	var ecErr error_code.ErrorWithErrorCode
	require.True(t, errors.As(err, &ecErr))
	require.Equal(t, error_code.InvalidRequestParameters.Code, ecErr.ErrorCode.Code)
	require.Contains(t, err.Error(), "session not found or expired")
}

func TestAuthPasskeyService_Security_LoginChallengeUniquePerCall(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	var challenges []string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, _ string, value string, _ uint64) error {
			var session webauthn.SessionData
			_ = json.Unmarshal([]byte(value), &session)
			challenges = append(challenges, session.Challenge)
			return nil
		}).Times(3)

	for i := 0; i < 3; i++ {
		_, err := svc.LoginChallenge(ctx)
		require.NoError(t, err)
	}

	// All challenges must be unique (no replay)
	require.Len(t, challenges, 3)
	require.NotEqual(t, challenges[0], challenges[1])
	require.NotEqual(t, challenges[1], challenges[2])
	require.NotEqual(t, challenges[0], challenges[2])
}

func TestAuthPasskeyService_Security_RegistrationChallengeUnique(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil).Times(3)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil).Times(3)

	var challenges []string
	cacheRepo.EXPECT().
		SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
		DoAndReturn(func(_ context.Context, _ string, value string, _ uint64) error {
			var session webauthn.SessionData
			_ = json.Unmarshal([]byte(value), &session)
			challenges = append(challenges, session.Challenge)
			return nil
		}).Times(3)

	for i := 0; i < 3; i++ {
		_, err := svc.RegistrationChallenge(ctx, testUserID)
		require.NoError(t, err)
	}

	// All challenges must be unique
	require.Len(t, challenges, 3)
	require.NotEqual(t, challenges[0], challenges[1])
	require.NotEqual(t, challenges[1], challenges[2])
	require.NotEqual(t, challenges[0], challenges[2])
}

func TestAuthPasskeyService_Security_DeletePasskey_RequiresCorrectUserID(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, passkeyRepo, _ := newTestPasskeyService(ctrl)

	// Verify that Delete is called with both passkeyID AND userID
	// This ensures a user can only delete their own passkeys
	passkeyRepo.EXPECT().Delete(ctx, int64(42), testUserID).Return(nil)

	err := svc.DeletePasskey(ctx, testUserID, 42)
	require.NoError(t, err)
}

func TestAuthPasskeyService_Security_RegistrationChallenge_UsesConfiguredTTL(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	customConfig := config.Config{
		WebAuthnRPName:       "TestRP",
		WebAuthnRPID:         "localhost",
		WebAuthnRPOrigin:     "http://localhost:8080",
		WebAuthnChallengeTTL: 600,
	}

	userRepo := mockgen.NewMockIUserRepository(ctrl)
	accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
	refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
	passkeyRepo := mockgen.NewMockIPasskeyRepository(ctrl)
	cacheRepo := mockgen.NewMockICache(ctrl)

	svc, err := NewAuthPasskeyService(userRepo, accessRepo, refreshRepo, passkeyRepo, cacheRepo, customConfig)
	require.NoError(t, err)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)

	// Verify TTL uses config value 600 instead of default 300
	cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(600)).Return(nil)

	_, err = svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)
}

func TestAuthPasskeyService_Security_LoginChallenge_UsesConfiguredTTL(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	customConfig := config.Config{
		WebAuthnRPName:       "TestRP",
		WebAuthnRPID:         "localhost",
		WebAuthnRPOrigin:     "http://localhost:8080",
		WebAuthnChallengeTTL: 120,
	}

	userRepo := mockgen.NewMockIUserRepository(ctrl)
	accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
	refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
	passkeyRepo := mockgen.NewMockIPasskeyRepository(ctrl)
	cacheRepo := mockgen.NewMockICache(ctrl)

	svc, err := NewAuthPasskeyService(userRepo, accessRepo, refreshRepo, passkeyRepo, cacheRepo, customConfig)
	require.NoError(t, err)

	cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(120)).Return(nil)

	_, err = svc.LoginChallenge(ctx)
	require.NoError(t, err)
}

func TestAuthPasskeyService_Security_RegistrationChallenge_SetsUserIDCorrectly(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)
	cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).Return(nil)

	options, err := svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)
	require.NotNil(t, options)

	// Verify the user entity in the response matches the authenticated user
	userID, ok := options.Response.User.ID.(protocol.URLEncodedBase64)
	require.True(t, ok)
	require.Equal(t, []byte(testUserID), []byte(userID))
	require.Equal(t, testUserName, options.Response.User.DisplayName)
}

func TestAuthPasskeyService_Security_RegistrationChallenge_RequiresResidentKey(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, userRepo, _, _, passkeyRepo, cacheRepo := newTestPasskeyService(ctrl)

	userRepo.EXPECT().GetByID(ctx, testUserID).Return(testUser(), true, nil)
	passkeyRepo.EXPECT().GetByUserID(ctx, testUserID).Return([]entity.PasskeyEntity{}, nil)
	cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).Return(nil)

	options, err := svc.RegistrationChallenge(ctx, testUserID)
	require.NoError(t, err)

	// Verify ResidentKey requirement is set to "required" for discoverable credentials
	require.Equal(t, protocol.ResidentKeyRequirementRequired, options.Response.AuthenticatorSelection.ResidentKey)
	require.Equal(t, protocol.VerificationPreferred, options.Response.AuthenticatorSelection.UserVerification)
}

func TestAuthPasskeyService_Security_LoginChallenge_RequiresUserVerification(t *testing.T) {
	t.Parallel()
	logger.InitLogger(config.Config{})

	ctx := context.Background()
	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	svc, _, _, _, _, cacheRepo := newTestPasskeyService(ctrl)

	cacheRepo.EXPECT().SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).Return(nil)

	options, err := svc.LoginChallenge(ctx)
	require.NoError(t, err)

	// Verify user verification is set to preferred
	require.Equal(t, protocol.VerificationPreferred, options.Response.UserVerification)
}

// --- boolPtr helper ---

func TestBoolPtr(t *testing.T) {
	t.Parallel()

	trueVal := boolPtr(true)
	require.NotNil(t, trueVal)
	require.True(t, *trueVal)

	falseVal := boolPtr(false)
	require.NotNil(t, falseVal)
	require.False(t, *falseVal)

	// Verify they point to different memory
	require.NotSame(t, trueVal, falseVal)
}
