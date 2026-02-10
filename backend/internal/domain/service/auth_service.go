package service

import (
	"context"
	"fmt"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/client"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/error_code"

	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/pkg/errors"
)

func NewAuthService(
	accessTokenRepo repository.IAuthAccessTokenRepository,
	refreshTokenRepo repository.IAuthRefreshTokenRepository,
	userRepo repository.IUserRepository,
	githubClient client.IGithubAuthClient,
	googleClient client.IGoogleAuthClient,
	twoFAService *TwoFAService,
) *AuthService {
	return &AuthService{
		accessTokenRepo:  accessTokenRepo,
		refreshTokenRepo: refreshTokenRepo,
		userRepo:         userRepo,
		githubClient:     githubClient,
		googleClient:     googleClient,
		twoFAService:     twoFAService,
	}
}

type AuthService struct {
	accessTokenRepo  repository.IAuthAccessTokenRepository
	refreshTokenRepo repository.IAuthRefreshTokenRepository
	userRepo         repository.IUserRepository
	githubClient     client.IGithubAuthClient
	googleClient     client.IGoogleAuthClient
	twoFAService     *TwoFAService
}

type AuthLoginResult struct {
	User         entity.UserEntity
	RefreshToken entity.RefreshToken
	AccessToken  entity.AccessToken
}

func (s *AuthService) Login(ctx context.Context, username, password string) (result AuthLoginResult, twoFAToken *string, credentialValid bool, err error) {
	user, ok, err := s.userRepo.ValidateCredentialsByUsername(ctx, username, password)
	if !ok {
		logger.Infof(ctx, "failed login attempt: username: %s", username)
		return AuthLoginResult{}, nil, false, nil
	}
	if err != nil {
		return AuthLoginResult{}, nil, false, errors.Wrapf(err, "fail to check username and password")
	}
	logger.Infof(ctx, "user login: username: %s userid: %s", username, user.ID)

	// Check if 2FA is required
	twoFAToken, err = s.twoFAService.Get2FAToken(ctx, user.ID)
	if err != nil {
		return AuthLoginResult{}, nil, false, errors.Wrapf(err, "fail to check 2fa status for user: %s", user.ID)
	}
	if twoFAToken != nil {
		// 2FA is required, return the token without issuing auth tokens
		logger.Infof(ctx, "2FA required for user: %s", user.ID)
		return AuthLoginResult{}, twoFAToken, true, nil
	}

	// No 2FA required, issue tokens normally
	refreshToken, err := s.refreshTokenRepo.IssueRefreshToken(ctx, user.ID)
	if err != nil {
		return AuthLoginResult{}, nil, false, errors.Wrapf(err, "fail to issue refresh token")
	}

	accessToken, err := s.accessTokenRepo.IssueAccessToken(ctx, user.ID, refreshToken.TokenHash)
	if err != nil {
		return AuthLoginResult{}, nil, false, errors.Wrapf(err, "fail to issue access token")
	}

	return AuthLoginResult{
		User:         user,
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
	}, nil, true, nil
}

func (s *AuthService) LoginOrCreateUserBySSO(ctx context.Context, provider string, providerOauthToken string) (result AuthLoginResult, twoFAToken *string, err error) {
	providerUserID, providerUsername, providerEmail, err := s.getSSOProviderUserInfo(provider, providerOauthToken)
	if err != nil {
		return AuthLoginResult{}, nil, err
	}

	user, userExists, err := s.userRepo.GetUserBySSO(ctx, provider, providerUserID)
	if err != nil {
		return AuthLoginResult{}, nil, errors.Wrapf(err, "fail to get user by SSO info, provider: %s, providerUserID: %s", provider, providerUserID)
	}
	// if user does not exist, create a new user
	if !userExists {
		// generate unique username: providerUsername_randomString
		randomSuffix, err := gonanoid.New(8)
		if err != nil {
			return AuthLoginResult{}, nil, errors.Wrap(err, "fail to generate random suffix for username")
		}
		uniqueUsername := fmt.Sprintf("%s_%s", providerUsername, randomSuffix)

		user, err = s.userRepo.CreateUserBySSO(ctx, provider, providerUserID, &uniqueUsername, providerEmail, []entity.UserRoleEntity{entity.UserRoleUser})
		if err != nil {
			return AuthLoginResult{}, nil, errors.Wrapf(err, "fail to create user by SSO")
		}
	}

	// Check if 2FA is required
	twoFAToken, err = s.twoFAService.Get2FAToken(ctx, user.ID)
	if err != nil {
		return AuthLoginResult{}, nil, errors.Wrapf(err, "fail to check 2fa status for user: %s", user.ID)
	}
	if twoFAToken != nil {
		// 2FA is required, return the token without issuing auth tokens
		logger.Infof(ctx, "2FA required for user: %s", user.ID)
		return AuthLoginResult{}, twoFAToken, nil
	}

	// No 2FA required, issue tokens normally
	refreshToken, err := s.refreshTokenRepo.IssueRefreshToken(ctx, user.ID)
	if err != nil {
		return AuthLoginResult{}, nil, errors.Wrapf(err, "fail to issue refresh token")
	}
	accessToken, err := s.accessTokenRepo.IssueAccessToken(ctx, user.ID, refreshToken.TokenHash)
	if err != nil {
		return AuthLoginResult{}, nil, errors.Wrapf(err, "fail to issue access token")
	}
	return AuthLoginResult{
		User:         user,
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
	}, nil, nil

}

func (s *AuthService) AddSSOBindingForUser(ctx context.Context, userID entity.UserIDEntity, provider string, providerOauthToken string) error {
	// check if user exists first
	_, userExists, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return errors.Wrapf(err, "fail to get user by id")
	}
	if !userExists {
		return error_code.NewErrorWithErrorCode(error_code.UserNotFound, "user not exists")
	}

	providerUserID, providerUsername, providerEmail, err := s.getSSOProviderUserInfo(provider, providerOauthToken)
	if err != nil {
		return err
	}

	// check binding
	bindings, err := s.userRepo.GetUserSSOBindings(ctx, userID)
	if err != nil {
		return errors.Wrapf(err, "fail to get user sso bindings")
	}
	for _, binding := range bindings {
		// user have to remove existing binding first
		if binding.Provider == provider {
			return error_code.NewErrorWithErrorCode(error_code.SSOProviderAccountAlreadyBinded, "There is already a SSO provider '%s' account binded to the user, please remove it first", provider)
		}
	}

	// check if provider user id already binded to another user

	_, exists, err := s.userRepo.GetUserBySSO(ctx, provider, providerUserID)
	if err != nil {
		return errors.Wrapf(err, "fail to get user by SSO info, provider: %s, providerUserID: %s", provider, providerUserID)
	}
	if exists {
		return error_code.NewErrorWithErrorCode(error_code.SSOProviderAccountAlreadyBinded, "Your SSO provider '%s' account is already binded to another user", provider)
	}

	// add bindings
	if err := s.userRepo.AddUserSSOBinding(ctx, userID, provider, providerUserID, &providerUsername, providerEmail); err != nil {
		return errors.Wrapf(err, "fail to add user sso binding for provider: %s", provider)
	}

	return nil

}

func (s *AuthService) ValidateAccessToken(ctx context.Context, token string) (entity.AccessToken, bool, error) {
	accessToken, valid, err := s.accessTokenRepo.ValidateAccessToken(ctx, token)
	if err != nil {
		return entity.AccessToken{}, false, errors.Wrapf(err, "fail to validate access token")
	}
	return accessToken, valid, nil
}

func (s *AuthService) IssueNewAccessToken(ctx context.Context, refreshToken string) (entity.AccessToken, bool, error) {
	refresh, valid, err := s.refreshTokenRepo.ValidateRefreshToken(ctx, refreshToken)
	if err != nil {
		return entity.AccessToken{}, false, errors.Wrapf(err, "fail to validate refresh token")
	}
	if !valid {
		return entity.AccessToken{}, false, nil
	}

	accessToken, err := s.accessTokenRepo.IssueAccessToken(ctx, refresh.UserID, refresh.TokenHash)
	if err != nil {
		return entity.AccessToken{}, false, errors.Wrapf(err, "fail to issue access token")
	}

	return accessToken, true, nil
}

func (s *AuthService) Logout(ctx context.Context, token string) error {
	accessToken, valid, err := s.ValidateAccessToken(ctx, token)
	if err != nil {
		return err
	}
	if !valid {
		return nil
	}

	if err := s.accessTokenRepo.DeleteAccessToken(ctx, accessToken); err != nil {
		return errors.Wrapf(err, "fail to delete access token")
	}

	if err := s.refreshTokenRepo.DeleteRefreshTokenByHash(ctx, accessToken.RelativeRefreshToken); err != nil {
		return errors.Wrap(err, "fail to delete refresh token")
	}

	return nil
}

func (s *AuthService) GetUserSSOBindings(ctx context.Context, userID entity.UserIDEntity) ([]entity.UserSSOEntity, error) {
	bindings, err := s.userRepo.GetUserSSOBindings(ctx, userID)
	if err != nil {
		return nil, errors.Wrapf(err, "fail to get user sso bindings")
	}
	return bindings, nil
}

func (s *AuthService) DeleteUserSSOBinding(ctx context.Context, userID entity.UserIDEntity, provider string) error {
	// Get current SSO bindings count for the user
	bindings, err := s.userRepo.GetUserSSOBindings(ctx, userID)
	if err != nil {
		return errors.Wrapf(err, "fail to get user sso bindings")
	}

	// Prevent deletion if user has only one or fewer bindings
	if len(bindings) <= 1 {
		return error_code.NewErrorWithErrorCode(error_code.CannotDeleteLastSSOBinding, "Cannot delete the last SSO binding. User must have at least one login method.")
	}

	if err := s.userRepo.DeleteUserSSOBinding(ctx, userID, provider); err != nil {
		return errors.Wrapf(err, "fail to delete user sso binding")
	}
	return nil
}

func (s *AuthService) getSSOProviderUserInfo(provider string, providerOauthToken string) (providerUserID string, providerUsername string, providerEmail *string, err error) {
	switch provider {
	case "github":
		accessToken, err := s.githubClient.OauthTokenToAccessToken(providerOauthToken)
		if err != nil {
			return "", "", nil, errors.Wrapf(err, "fail to exchange oauth token to access token")
		}
		githubUserInfo, err := s.githubClient.GetUserInfo(accessToken)
		if err != nil {
			return "", "", nil, errors.Wrapf(err, "fail to get github user info by acccess token")
		}
		// int64 to string
		return fmt.Sprintf("%d", githubUserInfo.ID), githubUserInfo.Login, githubUserInfo.Email, nil
	case "google":
		accessToken, err := s.googleClient.OauthCodeToAccessToken(providerOauthToken)
		if err != nil {
			return "", "", nil, errors.Wrapf(err, "fail to exchange oauth code to access token")
		}
		googleUserInfo, err := s.googleClient.GetUserInfo(accessToken)
		if err != nil {
			return "", "", nil, errors.Wrapf(err, "fail to get google user info by access token")
		}
		var email *string
		if googleUserInfo.Email != "" {
			email = &googleUserInfo.Email
		}
		return googleUserInfo.ID, googleUserInfo.Name, email, nil
	default:
		return "", "", nil, errors.Errorf("unsupported SSO provider: %s", provider)
	}
}
