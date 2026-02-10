package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"

	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	domain_client "ya-tool-craft/internal/domain/client"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/error_code"
	mockgen "ya-tool-craft/internal/infra/repository_impl/mock_gen"
	"ya-tool-craft/internal/utils"
)

type fakeGithubAuthClient struct {
	oauthTokenToAccessTokenFunc func(oauthToken string) (string, error)
	getUserInfoFunc             func(accessToken string) (entity.GithubUserInfoEntity, error)
}

func (f *fakeGithubAuthClient) OauthTokenToAccessToken(oauthToken string) (string, error) {
	if f.oauthTokenToAccessTokenFunc != nil {
		return f.oauthTokenToAccessTokenFunc(oauthToken)
	}
	return "", nil
}

func (f *fakeGithubAuthClient) GetUserInfo(accessToken string) (entity.GithubUserInfoEntity, error) {
	if f.getUserInfoFunc != nil {
		return f.getUserInfoFunc(accessToken)
	}
	return entity.GithubUserInfoEntity{}, nil
}

type fakeGoogleAuthClient struct {
	oauthCodeToAccessTokenFunc func(oauthCode string) (string, error)
	getUserInfoFunc            func(accessToken string) (entity.GoogleUserInfoEntity, error)
}

func (f *fakeGoogleAuthClient) OauthCodeToAccessToken(oauthCode string) (string, error) {
	if f.oauthCodeToAccessTokenFunc != nil {
		return f.oauthCodeToAccessTokenFunc(oauthCode)
	}
	return "", nil
}

func (f *fakeGoogleAuthClient) GetUserInfo(accessToken string) (entity.GoogleUserInfoEntity, error) {
	if f.getUserInfoFunc != nil {
		return f.getUserInfoFunc(accessToken)
	}
	return entity.GoogleUserInfoEntity{}, nil
}

// newTestAuthService creates an AuthService with all mocked dependencies.
func newTestAuthService(ctrl *gomock.Controller) (
	*AuthService,
	*mockgen.MockIAuthAccessTokenRepository,
	*mockgen.MockIAuthRefreshTokenRepository,
	*mockgen.MockIUserRepository,
	*mockgen.MockIAuth2FARepository,
	*mockgen.MockICache,
) {
	accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
	refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
	userRepo := mockgen.NewMockIUserRepository(ctrl)
	twoFARepo := mockgen.NewMockIAuth2FARepository(ctrl)
	cacheRepo := mockgen.NewMockICache(ctrl)

	twoFAService, _ := NewTwoFaService(twoFARepo, userRepo, accessRepo, refreshRepo, cacheRepo, config.Config{})
	svc := NewAuthService(accessRepo, refreshRepo, userRepo, nil, nil, twoFAService)

	return svc, accessRepo, refreshRepo, userRepo, twoFARepo, cacheRepo
}

func newTestAuthServiceWithSSOClients(
	ctrl *gomock.Controller,
	githubClient domain_client.IGithubAuthClient,
	googleClient domain_client.IGoogleAuthClient,
) (
	*AuthService,
	*mockgen.MockIAuthAccessTokenRepository,
	*mockgen.MockIAuthRefreshTokenRepository,
	*mockgen.MockIUserRepository,
	*mockgen.MockIAuth2FARepository,
	*mockgen.MockICache,
) {
	accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
	refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
	userRepo := mockgen.NewMockIUserRepository(ctrl)
	twoFARepo := mockgen.NewMockIAuth2FARepository(ctrl)
	cacheRepo := mockgen.NewMockICache(ctrl)

	twoFAService, _ := NewTwoFaService(twoFARepo, userRepo, accessRepo, refreshRepo, cacheRepo, config.Config{})
	svc := NewAuthService(accessRepo, refreshRepo, userRepo, githubClient, googleClient, twoFAService)

	return svc, accessRepo, refreshRepo, userRepo, twoFARepo, cacheRepo
}

func TestAuthService_Login(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		username = "alice"
		password = "secret"
	)

	tests := []struct {
		name       string
		setupMocks func(
			ctx context.Context,
			accessRepo *mockgen.MockIAuthAccessTokenRepository,
			refreshRepo *mockgen.MockIAuthRefreshTokenRepository,
			userRepo *mockgen.MockIUserRepository,
			twoFARepo *mockgen.MockIAuth2FARepository,
			cacheRepo *mockgen.MockICache,
		)
		wantCredentialValid bool
		wantTwoFAToken      bool
		wantErrSub          string
		wantUser            entity.UserEntity
		wantTokens          struct {
			refresh entity.RefreshToken
			access  entity.AccessToken
		}
	}{
		{
			name: "invalid credentials returns false without error",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(entity.UserEntity{}, false, nil)
			},
			wantCredentialValid: false,
		},
		{
			name: "credential lookup error wraps with context",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(entity.UserEntity{}, true, errors.New("db offline"))
			},
			wantErrSub: "fail to check username and password",
		},
		{
			name: "2FA check error is wrapped",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				user := entity.UserEntity{ID: "user-1", Name: "Alice"}
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("2fa db error"))
			},
			wantErrSub: "fail to check 2fa status",
		},
		{
			name: "2FA required returns twoFAToken without auth tokens",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				user := entity.UserEntity{ID: "user-1", Name: "Alice"}
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Verified: true, Secret: "secret"}, true, nil)
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
					Return(nil)
			},
			wantCredentialValid: true,
			wantTwoFAToken:      true,
		},
		{
			name: "refresh token issuance failure",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				user := entity.UserEntity{ID: "user-1", Name: "Alice"}
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(entity.RefreshToken{}, errors.New("cannot persist"))
			},
			wantErrSub: "fail to issue refresh token",
		},
		{
			name: "access token issuance failure",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				user := entity.UserEntity{ID: "user-2", Name: "Alice"}
				refresh := entity.NewRefreshToken(user.ID, "refresh-token", time.Unix(1, 0), time.Unix(10, 0))

				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, user.ID, refresh.TokenHash).
					Return(entity.AccessToken{}, errors.New("sign failure"))
			},
			wantErrSub: "fail to issue access token",
		},
		{
			name: "successful login returns tokens",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache) {
				user := entity.UserEntity{ID: "user-3", Name: "Alice"}
				refresh := entity.NewRefreshToken(user.ID, "refresh-token", time.Unix(100, 0), time.Unix(200, 0))
				access := entity.NewAccessToken(user.ID, "access-token", time.Unix(100, 0), time.Unix(150, 0), refresh.TokenHash)

				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, user.ID, refresh.TokenHash).
					Return(access, nil)
			},
			wantCredentialValid: true,
			wantUser:            entity.UserEntity{ID: "user-3", Name: "Alice"},
			wantTokens: struct {
				refresh entity.RefreshToken
				access  entity.AccessToken
			}{
				refresh: entity.NewRefreshToken("user-3", "refresh-token", time.Unix(100, 0), time.Unix(200, 0)),
				access:  entity.NewAccessToken("user-3", "access-token", time.Unix(100, 0), time.Unix(150, 0), utils.Sha256String("refresh-token")),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, accessRepo, refreshRepo, userRepo, twoFARepo, cacheRepo := newTestAuthService(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo, userRepo, twoFARepo, cacheRepo)
			}

			result, twoFAToken, credentialValid, err := svc.Login(ctx, username, password)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantCredentialValid, credentialValid)

			if tt.wantTwoFAToken {
				require.NotNil(t, twoFAToken)
				require.Equal(t, AuthLoginResult{}, result)
			} else {
				require.Nil(t, twoFAToken)
			}

			if tt.wantCredentialValid && !tt.wantTwoFAToken {
				require.Equal(t, tt.wantUser, result.User)
				require.Equal(t, tt.wantTokens.refresh, result.RefreshToken)
				require.Equal(t, tt.wantTokens.access, result.AccessToken)
			}
		})
	}
}

func TestAuthService_IssueNewAccessToken(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const refreshToken = "refresh-token"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository)
		wantOK     bool
		wantErrSub string
		wantToken  entity.AccessToken
	}{
		{
			name: "validation error is wrapped",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				refreshRepo.EXPECT().
					ValidateRefreshToken(ctx, refreshToken).
					Return(entity.RefreshToken{}, false, errors.New("badger down"))
			},
			wantErrSub: "fail to validate refresh token",
		},
		{
			name: "invalid refresh token returns false",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				refreshRepo.EXPECT().
					ValidateRefreshToken(ctx, refreshToken).
					Return(entity.RefreshToken{}, false, nil)
			},
			wantOK: false,
		},
		{
			name: "issuing access token error",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				refresh := entity.NewRefreshToken("user-1", refreshToken, time.Unix(50, 0), time.Unix(100, 0))
				refreshRepo.EXPECT().
					ValidateRefreshToken(ctx, refreshToken).
					Return(refresh, true, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, refresh.UserID, refresh.TokenHash).
					Return(entity.AccessToken{}, errors.New("jwt failure"))
			},
			wantErrSub: "fail to issue access token",
		},
		{
			name: "successfully issues access token",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				refresh := entity.NewRefreshToken("user-2", refreshToken, time.Unix(10, 0), time.Unix(100, 0))
				access := entity.NewAccessToken(refresh.UserID, "access", time.Unix(20, 0), time.Unix(40, 0), refresh.TokenHash)

				refreshRepo.EXPECT().
					ValidateRefreshToken(ctx, refreshToken).
					Return(refresh, true, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, refresh.UserID, refresh.TokenHash).
					Return(access, nil)
			},
			wantOK:    true,
			wantToken: entity.NewAccessToken("user-2", "access", time.Unix(20, 0), time.Unix(40, 0), utils.Sha256String(refreshToken)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, accessRepo, refreshRepo, _, _, _ := newTestAuthService(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo)
			}

			token, ok, err := svc.IssueNewAccessToken(ctx, refreshToken)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.wantOK, ok)

			if tt.wantOK {
				require.Equal(t, tt.wantToken, token)
			} else {
				require.Equal(t, entity.AccessToken{}, token)
			}
		})
	}
}

func TestAuthService_Logout(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const accessTokenStr = "access-token"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository)
		wantErrSub string
	}{
		{
			name: "validation error is wrapped",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessTokenStr).
					Return(entity.AccessToken{}, false, errors.New("jwt failure"))
			},
			wantErrSub: "fail to validate access token",
		},
		{
			name: "invalid access token returns nil error",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessTokenStr).
					Return(entity.AccessToken{}, false, nil)
			},
		},
		{
			name: "deleting access token fails",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				token := entity.AccessToken{RelativeRefreshToken: "refresh-hash"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessTokenStr).
					Return(token, true, nil)
				accessRepo.EXPECT().
					DeleteAccessToken(ctx, token).
					Return(errors.New("remove failure"))
			},
			wantErrSub: "fail to delete access token",
		},
		{
			name: "deleting refresh token fails",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				token := entity.AccessToken{RelativeRefreshToken: "refresh-hash"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessTokenStr).
					Return(token, true, nil)
				accessRepo.EXPECT().
					DeleteAccessToken(ctx, token).
					Return(nil)
				refreshRepo.EXPECT().
					DeleteRefreshTokenByHash(ctx, token.RelativeRefreshToken).
					Return(errors.New("remove failure"))
			},
			wantErrSub: "fail to delete refresh token",
		},
		{
			name: "successful logout",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				token := entity.AccessToken{RelativeRefreshToken: "refresh-hash"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessTokenStr).
					Return(token, true, nil)
				accessRepo.EXPECT().
					DeleteAccessToken(ctx, token).
					Return(nil)
				refreshRepo.EXPECT().
					DeleteRefreshTokenByHash(ctx, token.RelativeRefreshToken).
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

			svc, accessRepo, refreshRepo, _, _, _ := newTestAuthService(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo)
			}

			err := svc.Logout(ctx, accessTokenStr)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestAuthService_ValidateAccessToken(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const tokenStr = "some-access-token"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository)
		wantValid  bool
		wantErrSub string
		wantToken  entity.AccessToken
	}{
		{
			name: "validation error is wrapped",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository) {
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, tokenStr).
					Return(entity.AccessToken{}, false, errors.New("jwt error"))
			},
			wantErrSub: "fail to validate access token",
		},
		{
			name: "invalid token returns false",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository) {
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, tokenStr).
					Return(entity.AccessToken{}, false, nil)
			},
			wantValid: false,
		},
		{
			name: "valid token returns token and true",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository) {
				token := entity.AccessToken{UserID: "user-1", RelativeRefreshToken: "rh"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, tokenStr).
					Return(token, true, nil)
			},
			wantValid: true,
			wantToken: entity.AccessToken{UserID: "user-1", RelativeRefreshToken: "rh"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, accessRepo, _, _, _, _ := newTestAuthService(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo)
			}

			token, valid, err := svc.ValidateAccessToken(ctx, tokenStr)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantValid, valid)
				if tt.wantValid {
					require.Equal(t, tt.wantToken, token)
				}
			}
		})
	}
}

func TestAuthService_GetUserSSOBindings(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const userID = entity.UserIDEntity("user-1")

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, userRepo *mockgen.MockIUserRepository)
		wantErrSub string
		wantResult []entity.UserSSOEntity
	}{
		{
			name: "error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return(nil, errors.New("db error"))
			},
			wantErrSub: "fail to get user sso bindings",
		},
		{
			name: "returns empty list",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{}, nil)
			},
			wantResult: []entity.UserSSOEntity{},
		},
		{
			name: "returns bindings",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				bindings := []entity.UserSSOEntity{
					{UserID: userID, Provider: "github", ProviderUserID: "123"},
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return(bindings, nil)
			},
			wantResult: []entity.UserSSOEntity{
				{UserID: userID, Provider: "github", ProviderUserID: "123"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			svc, _, _, userRepo, _, _ := newTestAuthService(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo)
			}

			result, err := svc.GetUserSSOBindings(ctx, userID)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantResult, result)
			}
		})
	}
}

func TestAuthService_DeleteUserSSOBinding(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID   = entity.UserIDEntity("user-1")
		provider = "github"
	)

	tests := []struct {
		name        string
		setupMocks  func(ctx context.Context, userRepo *mockgen.MockIUserRepository)
		wantErrSub  string
		wantErrCode *error_code.ErrorCode
	}{
		{
			name: "GetUserSSOBindings error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return(nil, errors.New("db error"))
			},
			wantErrSub: "fail to get user sso bindings",
		},
		{
			name: "cannot delete last binding",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{
						{Provider: "github"},
					}, nil)
			},
			wantErrSub:  "Cannot delete the last SSO binding",
			wantErrCode: &error_code.CannotDeleteLastSSOBinding,
		},
		{
			name: "cannot delete when no bindings",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{}, nil)
			},
			wantErrSub:  "Cannot delete the last SSO binding",
			wantErrCode: &error_code.CannotDeleteLastSSOBinding,
		},
		{
			name: "DeleteUserSSOBinding error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{
						{Provider: "github"},
						{Provider: "google"},
					}, nil)
				userRepo.EXPECT().
					DeleteUserSSOBinding(ctx, userID, provider).
					Return(errors.New("delete failed"))
			},
			wantErrSub: "fail to delete user sso binding",
		},
		{
			name: "successful deletion with multiple bindings",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{
						{Provider: "github"},
						{Provider: "google"},
					}, nil)
				userRepo.EXPECT().
					DeleteUserSSOBinding(ctx, userID, provider).
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

			svc, _, _, userRepo, _, _ := newTestAuthService(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo)
			}

			err := svc.DeleteUserSSOBinding(ctx, userID, provider)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantErrCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantErrCode.Code, ecErr.ErrorCode.Code)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestAuthService_LoginOrCreateUserBySSO(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		providerGithub = "github"
		oauthCode      = "oauth-code"
	)

	userInfoEmail := "octo@example.com"

	tests := []struct {
		name       string
		provider   string
		setupMocks func(
			ctx context.Context,
			accessRepo *mockgen.MockIAuthAccessTokenRepository,
			refreshRepo *mockgen.MockIAuthRefreshTokenRepository,
			userRepo *mockgen.MockIUserRepository,
			twoFARepo *mockgen.MockIAuth2FARepository,
			cacheRepo *mockgen.MockICache,
			githubClient *fakeGithubAuthClient,
			googleClient *fakeGoogleAuthClient,
		)
		wantErrSub     string
		wantTwoFAToken bool
		wantResult     AuthLoginResult
	}{
		{
			name:       "unsupported provider returns error",
			provider:   "unsupported",
			wantErrSub: "unsupported SSO provider",
		},
		{
			name:     "github oauth exchange error is returned",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					require.Equal(t, oauthCode, oauthToken)
					return "", errors.New("oauth exchange failed")
				}
			},
			wantErrSub: "fail to exchange oauth token to access token",
		},
		{
			name:     "get user by sso error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(42, "octocat", "Octo Cat", &userInfoEmail, ""), nil
				}
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "42").
					Return(entity.UserEntity{}, false, errors.New("db unavailable"))
			},
			wantErrSub: "fail to get user by SSO info",
		},
		{
			name:     "create user by sso error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(43, "octocat", "Octo Cat", &userInfoEmail, ""), nil
				}
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "43").
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					CreateUserBySSO(ctx, providerGithub, "43", gomock.Any(), &userInfoEmail, []entity.UserRoleEntity{entity.UserRoleUser}).
					Return(entity.UserEntity{}, errors.New("create failed"))
			},
			wantErrSub: "fail to create user by SSO",
		},
		{
			name:     "create new sso user and issue tokens",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(7, "octo", "Octo", &userInfoEmail, ""), nil
				}

				user := entity.UserEntity{ID: "user-sso-1", Name: "octo_any"}
				refresh := entity.NewRefreshToken(user.ID, "refresh-token", time.Unix(100, 0), time.Unix(200, 0))
				access := entity.NewAccessToken(user.ID, "access-token", time.Unix(100, 0), time.Unix(150, 0), refresh.TokenHash)

				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "7").
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					CreateUserBySSO(ctx, providerGithub, "7", gomock.Any(), &userInfoEmail, []entity.UserRoleEntity{entity.UserRoleUser}).
					Return(user, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, user.ID, refresh.TokenHash).
					Return(access, nil)
			},
			wantResult: AuthLoginResult{
				User:         entity.UserEntity{ID: "user-sso-1", Name: "octo_any"},
				RefreshToken: entity.NewRefreshToken("user-sso-1", "refresh-token", time.Unix(100, 0), time.Unix(200, 0)),
				AccessToken:  entity.NewAccessToken("user-sso-1", "access-token", time.Unix(100, 0), time.Unix(150, 0), utils.Sha256String("refresh-token")),
			},
		},
		{
			name:     "existing sso user with 2fa required returns twofa token",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(8, "octo2", "Octo 2", &userInfoEmail, ""), nil
				}

				user := entity.UserEntity{ID: "user-sso-2", Name: "octo2"}
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "8").
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{Verified: true, Secret: "secret"}, true, nil)
				cacheRepo.EXPECT().
					SetWithTTL(ctx, gomock.Any(), gomock.Any(), uint64(300)).
					Return(nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(gomock.Any(), gomock.Any()).
					Times(0)
				accessRepo.EXPECT().
					IssueAccessToken(gomock.Any(), gomock.Any(), gomock.Any()).
					Times(0)
			},
			wantTwoFAToken: true,
		},
		{
			name:     "2fa check error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(18, "octo18", "Octo 18", &userInfoEmail, ""), nil
				}
				user := entity.UserEntity{ID: "user-sso-18", Name: "octo18"}
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "18").
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, errors.New("2fa repo failed"))
			},
			wantErrSub: "fail to check 2fa status for user",
		},
		{
			name:     "refresh token issue error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(9, "octo3", "Octo 3", &userInfoEmail, ""), nil
				}

				user := entity.UserEntity{ID: "user-sso-3", Name: "octo3"}
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "9").
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(entity.RefreshToken{}, errors.New("refresh repo down"))
			},
			wantErrSub: "fail to issue refresh token",
		},
		{
			name:     "access token issue error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository, twoFARepo *mockgen.MockIAuth2FARepository, cacheRepo *mockgen.MockICache, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(10, "octo4", "Octo 4", &userInfoEmail, ""), nil
				}

				user := entity.UserEntity{ID: "user-sso-4", Name: "octo4"}
				refresh := entity.NewRefreshToken(user.ID, "refresh-token", time.Unix(100, 0), time.Unix(200, 0))
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "10").
					Return(user, true, nil)
				twoFARepo.EXPECT().
					GetByUserIDAndType(ctx, user.ID, entity.TwoFATypeTOTP).
					Return(entity.TwoFAEntity{}, false, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, user.ID, refresh.TokenHash).
					Return(entity.AccessToken{}, errors.New("jwt issue failed"))
			},
			wantErrSub: "fail to issue access token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)

			githubClient := &fakeGithubAuthClient{}
			googleClient := &fakeGoogleAuthClient{}

			svc, accessRepo, refreshRepo, userRepo, twoFARepo, cacheRepo := newTestAuthServiceWithSSOClients(ctrl, githubClient, googleClient)
			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo, userRepo, twoFARepo, cacheRepo, githubClient, googleClient)
			}

			result, twoFAToken, err := svc.LoginOrCreateUserBySSO(ctx, tt.provider, oauthCode)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				return
			}

			require.NoError(t, err)
			if tt.wantTwoFAToken {
				require.NotNil(t, twoFAToken)
				require.Equal(t, AuthLoginResult{}, result)
			} else {
				require.Nil(t, twoFAToken)
				require.Equal(t, tt.wantResult, result)
			}
		})
	}
}

func TestAuthService_AddSSOBindingForUser(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		userID         = entity.UserIDEntity("user-1")
		providerGithub = "github"
		oauthCode      = "oauth-code"
	)

	email := "octo@example.com"

	tests := []struct {
		name       string
		provider   string
		setupMocks func(
			ctx context.Context,
			userRepo *mockgen.MockIUserRepository,
			githubClient *fakeGithubAuthClient,
			googleClient *fakeGoogleAuthClient,
		)
		wantErrSub  string
		wantErrCode *error_code.ErrorCode
	}{
		{
			name:     "get user by id error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, errors.New("db error"))
			},
			wantErrSub: "fail to get user by id",
		},
		{
			name:     "user not found returns coded error",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, nil)
			},
			wantErrSub:  "user not exists",
			wantErrCode: &error_code.UserNotFound,
		},
		{
			name:     "unsupported provider returns error",
			provider: "unsupported",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
			},
			wantErrSub: "unsupported SSO provider",
		},
		{
			name:     "provider user info error is returned",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "", errors.New("oauth failed")
				}
			},
			wantErrSub: "fail to exchange oauth token to access token",
		},
		{
			name:     "get bindings error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(12, "octo", "Octo", &email, ""), nil
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return(nil, errors.New("db error"))
			},
			wantErrSub: "fail to get user sso bindings",
		},
		{
			name:     "provider already bound returns coded error",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(13, "octo", "Octo", &email, ""), nil
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{{Provider: providerGithub}}, nil)
			},
			wantErrSub:  "There is already a SSO provider",
			wantErrCode: &error_code.SSOProviderAccountAlreadyBinded,
		},
		{
			name:     "provider account already bound to another user",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(14, "octo", "Octo", &email, ""), nil
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{{Provider: "google"}}, nil)
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "14").
					Return(entity.UserEntity{ID: "another-user"}, true, nil)
			},
			wantErrSub:  "already binded to another user",
			wantErrCode: &error_code.SSOProviderAccountAlreadyBinded,
		},
		{
			name:     "get user by sso error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(17, "octo", "Octo", &email, ""), nil
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{{Provider: "google"}}, nil)
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "17").
					Return(entity.UserEntity{}, false, errors.New("lookup failed"))
			},
			wantErrSub: "fail to get user by SSO info",
		},
		{
			name:     "add binding error is wrapped",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(15, "octo", "Octo", &email, ""), nil
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{{Provider: "google"}}, nil)
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "15").
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					AddUserSSOBinding(ctx, userID, providerGithub, "15", gomock.Any(), &email).
					Return(errors.New("insert failed"))
			},
			wantErrSub: "fail to add user sso binding for provider",
		},
		{
			name:     "successfully add binding",
			provider: providerGithub,
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, githubClient *fakeGithubAuthClient, googleClient *fakeGoogleAuthClient) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				githubClient.oauthTokenToAccessTokenFunc = func(oauthToken string) (string, error) {
					return "github-access-token", nil
				}
				githubClient.getUserInfoFunc = func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.NewGithubUserInfoEntity(16, "octo", "Octo", &email, ""), nil
				}
				userRepo.EXPECT().
					GetUserSSOBindings(ctx, userID).
					Return([]entity.UserSSOEntity{{Provider: "google"}}, nil)
				userRepo.EXPECT().
					GetUserBySSO(ctx, providerGithub, "16").
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					AddUserSSOBinding(ctx, userID, providerGithub, "16", gomock.Any(), &email).
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

			githubClient := &fakeGithubAuthClient{}
			googleClient := &fakeGoogleAuthClient{}
			svc, _, _, userRepo, _, _ := newTestAuthServiceWithSSOClients(ctrl, githubClient, googleClient)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo, githubClient, googleClient)
			}

			err := svc.AddSSOBindingForUser(ctx, userID, tt.provider, oauthCode)
			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantErrCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantErrCode.Code, ecErr.ErrorCode.Code)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestAuthService_getSSOProviderUserInfo(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		provider         string
		oauthToken       string
		githubClient     *fakeGithubAuthClient
		googleClient     *fakeGoogleAuthClient
		wantProviderID   string
		wantUsername     string
		wantEmail        *string
		wantErrSubstring string
	}{
		{
			name:       "github exchange error is wrapped",
			provider:   "github",
			oauthToken: "oauth",
			githubClient: &fakeGithubAuthClient{
				oauthTokenToAccessTokenFunc: func(oauthToken string) (string, error) {
					return "", errors.New("exchange failed")
				},
			},
			googleClient:     &fakeGoogleAuthClient{},
			wantErrSubstring: "fail to exchange oauth token to access token",
		},
		{
			name:       "github get user info error is wrapped",
			provider:   "github",
			oauthToken: "oauth",
			githubClient: &fakeGithubAuthClient{
				oauthTokenToAccessTokenFunc: func(oauthToken string) (string, error) {
					return "access-token", nil
				},
				getUserInfoFunc: func(accessToken string) (entity.GithubUserInfoEntity, error) {
					return entity.GithubUserInfoEntity{}, errors.New("github api failed")
				},
			},
			googleClient:     &fakeGoogleAuthClient{},
			wantErrSubstring: "fail to get github user info by acccess token",
		},
		{
			name:       "github success maps id and fields",
			provider:   "github",
			oauthToken: "oauth",
			githubClient: &fakeGithubAuthClient{
				oauthTokenToAccessTokenFunc: func(oauthToken string) (string, error) {
					return "access-token", nil
				},
				getUserInfoFunc: func(accessToken string) (entity.GithubUserInfoEntity, error) {
					email := "gh@example.com"
					return entity.NewGithubUserInfoEntity(99, "octo", "Octo", &email, ""), nil
				},
			},
			googleClient:   &fakeGoogleAuthClient{},
			wantProviderID: "99",
			wantUsername:   "octo",
			wantEmail: func() *string {
				email := "gh@example.com"
				return &email
			}(),
		},
		{
			name:         "google exchange error is wrapped",
			provider:     "google",
			oauthToken:   "oauth",
			githubClient: &fakeGithubAuthClient{},
			googleClient: &fakeGoogleAuthClient{
				oauthCodeToAccessTokenFunc: func(oauthCode string) (string, error) {
					return "", errors.New("exchange failed")
				},
			},
			wantErrSubstring: "fail to exchange oauth code to access token",
		},
		{
			name:         "google get user info error is wrapped",
			provider:     "google",
			oauthToken:   "oauth",
			githubClient: &fakeGithubAuthClient{},
			googleClient: &fakeGoogleAuthClient{
				oauthCodeToAccessTokenFunc: func(oauthCode string) (string, error) {
					return "google-access", nil
				},
				getUserInfoFunc: func(accessToken string) (entity.GoogleUserInfoEntity, error) {
					return entity.GoogleUserInfoEntity{}, errors.New("google api failed")
				},
			},
			wantErrSubstring: "fail to get google user info by access token",
		},
		{
			name:         "google success with empty email maps nil email",
			provider:     "google",
			oauthToken:   "oauth",
			githubClient: &fakeGithubAuthClient{},
			googleClient: &fakeGoogleAuthClient{
				oauthCodeToAccessTokenFunc: func(oauthCode string) (string, error) {
					return "google-access", nil
				},
				getUserInfoFunc: func(accessToken string) (entity.GoogleUserInfoEntity, error) {
					return entity.NewGoogleUserInfoEntity("gid-1", "", true, "Google Name", "", "", "", ""), nil
				},
			},
			wantProviderID: "gid-1",
			wantUsername:   "Google Name",
			wantEmail:      nil,
		},
		{
			name:             "unsupported provider returns error",
			provider:         "unsupported",
			oauthToken:       "oauth",
			githubClient:     &fakeGithubAuthClient{},
			googleClient:     &fakeGoogleAuthClient{},
			wantErrSubstring: "unsupported SSO provider",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			svc := &AuthService{
				githubClient: tt.githubClient,
				googleClient: tt.googleClient,
			}

			gotProviderID, gotUsername, gotEmail, err := svc.getSSOProviderUserInfo(tt.provider, tt.oauthToken)
			if tt.wantErrSubstring != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSubstring)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantProviderID, gotProviderID)
			require.Equal(t, tt.wantUsername, gotUsername)
			require.Equal(t, tt.wantEmail, gotEmail)
		})
	}
}
