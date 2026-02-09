package repository

import (
	"context"
	"ya-tool-craft/internal/domain/entity"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_auth_access_token_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IAuthAccessTokenRepository
type IAuthAccessTokenRepository interface {
	IssueAccessToken(ctx context.Context, userID entity.UserIDEntity, relativeRefreshTokenHash string) (entity.AccessToken, error)
	ValidateAccessToken(ctx context.Context, token string) (entity.AccessToken, bool, error)
	DeleteAccessToken(ctx context.Context, token entity.AccessToken) error
	DeleteAllTokensByUserID(ctx context.Context, userID entity.UserIDEntity) error
}
