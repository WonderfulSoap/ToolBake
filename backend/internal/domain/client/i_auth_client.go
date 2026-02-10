package client

import "ya-tool-craft/internal/domain/entity"

// IGithubAuthClient defines GitHub OAuth capabilities used by the domain service.
type IGithubAuthClient interface {
	OauthTokenToAccessToken(oauthToken string) (string, error)
	GetUserInfo(accessToken string) (entity.GithubUserInfoEntity, error)
}

// IGoogleAuthClient defines Google OAuth capabilities used by the domain service.
type IGoogleAuthClient interface {
	OauthCodeToAccessToken(oauthCode string) (string, error)
	GetUserInfo(accessToken string) (entity.GoogleUserInfoEntity, error)
}
