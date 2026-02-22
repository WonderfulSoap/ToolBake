package service

import (
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"

	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/error_code"
	mockgen "ya-tool-craft/internal/infra/repository_impl/mock_gen"
)

func TestUserService_CreateUser(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const (
		username = "alice"
		password = "secret123"
	)

	tests := []struct {
		name                   string
		enableUserRegistration *bool
		setupMocks             func(ctx context.Context, userRepo *mockgen.MockIUserRepository)
		wantUser               entity.UserEntity
		wantErrSub             string
		wantErrCode            *error_code.ErrorCode
	}{
		{
			name: "registration disabled returns coded error",
			enableUserRegistration: func() *bool {
				enabled := false
				return &enabled
			}(),
			wantErrSub:  "user registration is not enabled",
			wantErrCode: &error_code.UserRegistrationIsNotEnabled,
		},
		{
			name: "GetByUsername error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{}, false, errors.New("db offline"))
			},
			wantErrSub: "fail to check existing user",
		},
		{
			name: "username already exists returns error code",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{Name: username}, true, nil)
			},
			wantErrSub: "username already exists",
		},
		{
			name: "Create error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					Create(ctx, username, []entity.UserRoleEntity{entity.UserRoleUser}).
					Return(entity.UserEntity{}, errors.New("insert failed"))
			},
			wantErrSub: "fail to create user",
		},
		{
			name: "UpdatePassword error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: "user-1", Name: username}
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					Create(ctx, username, []entity.UserRoleEntity{entity.UserRoleUser}).
					Return(user, nil)
				userRepo.EXPECT().
					UpdatePassword(ctx, user.ID, password).
					Return(errors.New("hash failed"))
			},
			wantErrSub: "fail to set user password",
		},
		{
			name: "successful creation returns user",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: "user-1", Name: username}
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					Create(ctx, username, []entity.UserRoleEntity{entity.UserRoleUser}).
					Return(user, nil)
				userRepo.EXPECT().
					UpdatePassword(ctx, user.ID, password).
					Return(nil)
			},
			wantUser: entity.UserEntity{ID: "user-1", Name: username},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)
			userRepo := mockgen.NewMockIUserRepository(ctrl)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo)
			}

			cfg := config.Config{ENABLE_USER_REGISTRATION: true}
			if tt.enableUserRegistration != nil {
				cfg.ENABLE_USER_REGISTRATION = *tt.enableUserRegistration
			}
			svc := NewUserService(userRepo, accessRepo, refreshRepo, cfg)

			user, err := svc.CreateUser(ctx, username, password)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
				if tt.wantErrCode != nil {
					var ecErr error_code.ErrorWithErrorCode
					require.True(t, errors.As(err, &ecErr))
					require.Equal(t, tt.wantErrCode.Code, ecErr.ErrorCode.Code)
				}
				require.Equal(t, entity.UserEntity{}, user)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantUser, user)
			}
		})
	}
}

func TestUserService_CheckUsernameExists(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const username = "bob"

	tests := []struct {
		name       string
		setupMocks func(ctx context.Context, userRepo *mockgen.MockIUserRepository)
		wantExists bool
		wantErrSub string
	}{
		{
			name: "GetByUsername error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{}, false, errors.New("db offline"))
			},
			wantErrSub: "fail to check username",
		},
		{
			name: "username does not exist",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{}, false, nil)
			},
			wantExists: false,
		},
		{
			name: "username exists",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByUsername(ctx, username).
					Return(entity.UserEntity{Name: username}, true, nil)
			},
			wantExists: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)
			userRepo := mockgen.NewMockIUserRepository(ctrl)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo)
			}

			svc := NewUserService(userRepo, accessRepo, refreshRepo, config.Config{ENABLE_USER_REGISTRATION: true})

			exists, err := svc.CheckUsernameExists(ctx, username)

			if tt.wantErrSub != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrSub)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantExists, exists)
			}
		})
	}
}

func TestUserService_UpdateUser(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const userID = entity.UserIDEntity("user-1")

	tests := []struct {
		name        string
		params      struct{ Username *string }
		setupMocks  func(ctx context.Context, userRepo *mockgen.MockIUserRepository)
		wantErrSub  string
		wantErrCode *error_code.ErrorCode
	}{
		{
			name: "GetByID error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, errors.New("db offline"))
			},
			wantErrSub: "fail to get user by id",
		},
		{
			name: "user not found returns error code",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, nil)
			},
			wantErrSub:  "user not found",
			wantErrCode: &error_code.UserNotFound,
		},
		{
			name:   "new username already taken returns error code",
			params: struct{ Username *string }{Username: strPtr("newname")},
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: userID, Name: "oldname"}
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				userRepo.EXPECT().
					GetByUsername(ctx, "newname").
					Return(entity.UserEntity{}, true, nil)
			},
			wantErrSub:  "username already exists",
			wantErrCode: &error_code.UserAlreadyExists,
		},
		{
			name:   "checking new username error is wrapped",
			params: struct{ Username *string }{Username: strPtr("newname")},
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: userID, Name: "oldname"}
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				userRepo.EXPECT().
					GetByUsername(ctx, "newname").
					Return(entity.UserEntity{}, false, errors.New("db offline"))
			},
			wantErrSub: "fail to check username",
		},
		{
			name:   "Update error is wrapped",
			params: struct{ Username *string }{Username: strPtr("newname")},
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: userID, Name: "oldname"}
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				userRepo.EXPECT().
					GetByUsername(ctx, "newname").
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					Update(ctx, entity.UserEntity{ID: userID, Name: "newname"}).
					Return(errors.New("update failed"))
			},
			wantErrSub: "fail to update user",
		},
		{
			name:   "same username skips uniqueness check",
			params: struct{ Username *string }{Username: strPtr("oldname")},
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: userID, Name: "oldname"}
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				userRepo.EXPECT().
					Update(ctx, user).
					Return(nil)
			},
		},
		{
			name: "nil username skips update logic",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: userID, Name: "oldname"}
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				userRepo.EXPECT().
					Update(ctx, user).
					Return(nil)
			},
		},
		{
			name:   "successful update with new username",
			params: struct{ Username *string }{Username: strPtr("newname")},
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository) {
				user := entity.UserEntity{ID: userID, Name: "oldname"}
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(user, true, nil)
				userRepo.EXPECT().
					GetByUsername(ctx, "newname").
					Return(entity.UserEntity{}, false, nil)
				userRepo.EXPECT().
					Update(ctx, entity.UserEntity{ID: userID, Name: "newname"}).
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
			userRepo := mockgen.NewMockIUserRepository(ctrl)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo)
			}

			svc := NewUserService(userRepo, accessRepo, refreshRepo, config.Config{ENABLE_USER_REGISTRATION: true})

			err := svc.UpdateUser(ctx, userID, struct{ Username *string }{Username: tt.params.Username})

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

func TestUserService_DeleteUser(t *testing.T) {
	t.Parallel()

	logger.InitLogger(config.Config{})

	const userID = entity.UserIDEntity("user-1")

	tests := []struct {
		name        string
		setupMocks  func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository)
		wantErrSub  string
		wantErrCode *error_code.ErrorCode
	}{
		{
			name: "GetByID error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, errors.New("db offline"))
			},
			wantErrSub: "fail to get user by id",
		},
		{
			name: "user not found returns error code",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{}, false, nil)
			},
			wantErrSub:  "user not found",
			wantErrCode: &error_code.UserNotFound,
		},
		{
			name: "delete access tokens error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				accessRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(errors.New("redis down"))
			},
			wantErrSub: "fail to delete access tokens",
		},
		{
			name: "delete refresh tokens error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				accessRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(nil)
				refreshRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(errors.New("redis down"))
			},
			wantErrSub: "fail to delete refresh tokens",
		},
		{
			name: "DeleteUserWithAllData error is wrapped",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				accessRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(nil)
				refreshRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(nil)
				userRepo.EXPECT().
					DeleteUserWithAllData(ctx, userID).
					Return(errors.New("cascade failed"))
			},
			wantErrSub: "fail to delete user and related data",
		},
		{
			name: "successful deletion",
			setupMocks: func(ctx context.Context, userRepo *mockgen.MockIUserRepository, accessRepo *mockgen.MockIAuthAccessTokenRepository, refreshRepo *mockgen.MockIAuthRefreshTokenRepository) {
				userRepo.EXPECT().
					GetByID(ctx, userID).
					Return(entity.UserEntity{ID: userID}, true, nil)
				accessRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(nil)
				refreshRepo.EXPECT().
					DeleteAllTokensByUserID(ctx, userID).
					Return(nil)
				userRepo.EXPECT().
					DeleteUserWithAllData(ctx, userID).
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
			userRepo := mockgen.NewMockIUserRepository(ctrl)
			accessRepo := mockgen.NewMockIAuthAccessTokenRepository(ctrl)
			refreshRepo := mockgen.NewMockIAuthRefreshTokenRepository(ctrl)

			if tt.setupMocks != nil {
				tt.setupMocks(ctx, userRepo, accessRepo, refreshRepo)
			}

			svc := NewUserService(userRepo, accessRepo, refreshRepo, config.Config{ENABLE_USER_REGISTRATION: true})

			err := svc.DeleteUser(ctx, userID)

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

func strPtr(s string) *string {
	return &s
}
