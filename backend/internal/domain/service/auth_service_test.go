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
	"ya-tool-craft/internal/domain/entity"
	mockgen "ya-tool-craft/internal/infra/repository_impl/mock_gen"
	"ya-tool-craft/internal/utils"
)

func TestAuthService_Login(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		username = "alice"
		password = "secret"
	)

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository)
		wantOK     bool
		wantErrSub string
		wantUser   entity.UserEntity
		wantTokens struct {
			refresh entity.RefreshToken
			access  entity.AccessToken
		}
	}{
		{
			name: "invalid credentials returns false without error",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(entity.UserEntity{}, false, nil)
				accessRepo.EXPECT().IssueAccessToken(gomock.Any(), gomock.Any(), gomock.Any()).Times(0)
				refreshRepo.EXPECT().IssueRefreshToken(gomock.Any(), gomock.Any()).Times(0)
			},
			wantOK:     false,
			wantErrSub: "",
		},
		{
			name: "credential lookup error wraps with context",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(entity.UserEntity{}, true, errors.New("db offline"))
			},
			wantOK:     false,
			wantErrSub: "fail to check username and password",
		},
		{
			name: "refresh token issuance failure",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: "user-1", Name: "Alice"}
				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(entity.RefreshToken{}, errors.New("cannot persist"))
			},
			wantOK:     false,
			wantErrSub: "fail to issue refresh token",
		},
		{
			name: "access token issuance failure",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: "user-2", Name: "Alice"}
				refresh := entity.NewRefreshToken(user.ID, "refresh-token", time.Unix(1, 0), time.Unix(10, 0))

				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, user.ID, refresh.TokenHash).
					Return(entity.AccessToken{}, errors.New("sign failure"))
			},
			wantOK:     false,
			wantErrSub: "fail to issue access token",
		},
		{
			name: "successful login returns tokens",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: "user-3", Name: "Alice"}
				refresh := entity.NewRefreshToken(user.ID, "refresh-token", time.Unix(100, 0), time.Unix(200, 0))
				access := entity.NewAccessToken(user.ID, "access-token", time.Unix(100, 0), time.Unix(150, 0), refresh.TokenHash)

				userRepo.EXPECT().
					ValidateCredentialsByUsername(ctx, username, password).
					Return(user, true, nil)
				refreshRepo.EXPECT().
					IssueRefreshToken(ctx, user.ID).
					Return(refresh, nil)
				accessRepo.EXPECT().
					IssueAccessToken(ctx, user.ID, refresh.TokenHash).
					Return(access, nil)
			},
			wantOK:   true,
			wantUser: entity.UserEntity{ID: "user-3", Name: "Alice"},
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
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
			userRepo := mockgen.NewMockIUserRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo, userRepo)
			}

			service := NewAuthService(accessRepo, refreshRepo, userRepo, nil, nil)

			result, ok, err := service.Login(ctx, username, password)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.wantOK, ok)

			if tt.wantOK {
				require.Equal(t, tt.wantUser, result.User)
				require.Equal(t, tt.wantTokens.refresh, result.RefreshToken)
				require.Equal(t, tt.wantTokens.access, result.AccessToken)
			} else {
				require.Equal(t, entity.UserEntity{}, result.User)
				require.Equal(t, entity.RefreshToken{}, result.RefreshToken)
				require.Equal(t, entity.AccessToken{}, result.AccessToken)
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
		setupMocks func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository)
		wantOK     bool
		wantErrSub string
		wantToken  entity.AccessToken
	}{
		{
			name: "validation error is wrapped",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				refreshRepo.EXPECT().
					ValidateRefreshToken(ctx, refreshToken).
					Return(entity.RefreshToken{}, false, errors.New("badger down"))
				accessRepo.EXPECT().IssueAccessToken(gomock.Any(), gomock.Any(), gomock.Any()).Times(0)
			},
			wantErrSub: "fail to validate refresh token",
		},
		{
			name: "invalid refresh token returns false",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
				refreshRepo.EXPECT().
					ValidateRefreshToken(ctx, refreshToken).
					Return(entity.RefreshToken{}, false, nil)
				accessRepo.EXPECT().IssueAccessToken(gomock.Any(), gomock.Any(), gomock.Any()).Times(0)
			},
			wantOK: false,
		},
		{
			name: "issuing access token error",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
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
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository, userRepo *mockgen.MockIUserRepository) {
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
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)
			userRepo := mockgen.NewMockIUserRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo, userRepo)
			}

			service := NewAuthService(accessRepo, refreshRepo, userRepo, nil, nil)

			token, ok, err := service.IssueNewAccessToken(ctx, refreshToken)

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

	const accessToken = "access-token"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository)
		wantOK     bool
		wantErrSub string
	}{
		{
			name: "validation error is wrapped",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessToken).
					Return(entity.AccessToken{}, false, errors.New("jwt failure"))
			},
			wantErrSub: "fail to validate access token",
		},
		{
			name: "invalid access token returns false without error",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessToken).
					Return(entity.AccessToken{}, false, nil)
			},
			wantOK: false,
		},
		{
			name: "deleting refresh token fails",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				token := entity.AccessToken{RelativeRefreshToken: "refresh-hash"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessToken).
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
			name: "deleting access token fails",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				token := entity.AccessToken{RelativeRefreshToken: "refresh-hash"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessToken).
					Return(token, true, nil)
				accessRepo.EXPECT().
					DeleteAccessToken(ctx, token).
					Return(errors.New("remove failure"))
			},
			wantErrSub: "fail to delete access token",
		},
		{
			name: "successful logout returns true",
			setupMocks: func(ctx context.Context, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				token := entity.AccessToken{RelativeRefreshToken: "refresh-hash"}
				accessRepo.EXPECT().
					ValidateAccessToken(ctx, accessToken).
					Return(token, true, nil)
				accessRepo.EXPECT().
					DeleteAccessToken(ctx, token).
					Return(nil)
				refreshRepo.EXPECT().
					DeleteRefreshTokenByHash(ctx, token.RelativeRefreshToken).
					Return(nil)
			},
			wantOK: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, accessRepo, refreshRepo)
			}

			service := NewAuthService(accessRepo, refreshRepo, mockgen.NewMockIUserRepository(ctrl), nil, nil)

			err := service.Logout(ctx, accessToken)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
			}

		})
	}
}
